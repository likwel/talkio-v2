import { createHash, randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { badRequest, conflict, unauthorized } from '../../lib/http';

function tokensFor(user: { id: string; email: string }) {
  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email }),
    refreshToken: signRefreshToken({ sub: user.id, email: user.email }),
  };
}

async function persistRefreshToken(userId: string, token: string) {
  const decoded = verifyRefreshToken(token);
  const expiresAt = new Date((decoded as unknown as { exp: number }).exp * 1000);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
}

const publicUser = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  presenceStatus: true,
  createdAt: true,
} as const;

export async function register(input: { email: string; password: string; fullName: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('Un compte existe deja avec cet email');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
    },
    select: publicUser,
  });

  // Espace personnel : dépôt par défaut des Projets / MEAL / Collecte + messagerie de base.
  const rnd = Math.random().toString(36).slice(2, 8);
  await prisma.workspace.create({
    data: {
      name: 'Personnel',
      slug: `perso-${user.id.slice(0, 6)}-${rnd}`,
      isPersonal: true,
      members: { create: { userId: user.id, role: 'OWNER' } },
      channels: { create: { name: 'general', type: 'PUBLIC', topic: 'Notes personnelles' } },
    },
  });

  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user, ...tokens };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw unauthorized('Identifiants invalides');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Identifiants invalides');

  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
}

export async function refresh(token: string) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized('Refresh token invalide');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized('Session expiree, reconnectez-vous');
  }

  await prisma.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  });

  const tokens = tokensFor({ id: payload.sub, email: payload.email });
  await persistRefreshToken(payload.sub, tokens.refreshToken);
  return tokens;
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function me(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUser });
}

export function updateProfile(userId: string, input: { fullName?: string; avatarUrl?: string | null }) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
    },
    select: publicUser,
  });
}

const RESET_TTL_MIN = 60;
const hashResetToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

/**
 * Demande de reinitialisation : cree un jeton a usage unique (1h).
 * Reponse volontairement identique que le compte existe ou non.
 * Aucun service d'email n'etant configure, le lien est journalise cote serveur
 * et renvoye dans `devToken` hors production pour faciliter les tests.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return { ok: true as const };

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashResetToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000),
    },
  });

  const base = process.env.APP_URL ?? 'http://localhost:5173';
  // eslint-disable-next-line no-console
  console.log(`[password-reset] ${email} -> ${base}/reset-password?token=${token}`);

  return {
    ok: true as const,
    ...(process.env.NODE_ENV === 'production' ? {} : { devToken: token }),
  };
}

/** Applique un nouveau mot de passe a partir d'un jeton valide, puis l'invalide. */
export async function resetPassword(rawToken: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest('Lien de reinitialisation invalide ou expire');
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  // Deconnecte les sessions existantes
  await prisma.refreshToken.updateMany({
    where: { userId: record.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw badRequest('Mot de passe actuel incorrect');
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  // Invalide les autres sessions
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
