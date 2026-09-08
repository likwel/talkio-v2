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
