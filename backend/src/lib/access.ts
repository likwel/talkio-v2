import { prisma } from './prisma';
import { forbidden } from './http';

/** Verifie que l'utilisateur est membre du workspace, renvoie son role. */
export async function requireWorkspaceMember(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw forbidden("Vous n'etes pas membre de cet espace de travail");
  return member;
}

export async function requireWorkspaceAdmin(userId: string, workspaceId: string) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
    throw forbidden('Action reservee aux administrateurs');
  }
  return member;
}

/**
 * Ids des espaces dont l'utilisateur est membre — hors espaces personnels
 * d'autrui (où il n'est qu'invité pour un message direct).
 */
export async function myWorkspaceIds(userId: string): Promise<string[]> {
  const rows = await prisma.workspaceMember.findMany({
    where: { userId, OR: [{ role: 'OWNER' }, { workspace: { isPersonal: false } }] },
    select: { workspaceId: true },
  });
  return rows.map((r) => r.workspaceId);
}

/**
 * Espace personnel de l'utilisateur (dépôt par défaut des Projets / MEAL / Collecte).
 * Créé à la volée s'il n'existe pas encore.
 */
export async function getOrCreatePersonalWorkspace(userId: string) {
  const existing = await prisma.workspace.findFirst({
    where: { isPersonal: true, members: { some: { userId, role: 'OWNER' } } },
  });
  if (existing) return existing;
  const rnd = Math.random().toString(36).slice(2, 8);
  return prisma.workspace.create({
    data: {
      name: 'Personnel',
      slug: `perso-${userId.slice(0, 6)}-${rnd}`,
      isPersonal: true,
      members: { create: { userId, role: 'OWNER' } },
      channels: { create: { name: 'general', type: 'PUBLIC', topic: 'Notes personnelles' } },
    },
  });
}
