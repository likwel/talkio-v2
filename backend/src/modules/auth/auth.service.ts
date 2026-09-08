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
