import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/http';
import { getIO } from '../../realtime/socket';

const router = Router();

const publicUser = {
  id: true,
  fullName: true,
  email: true,
  avatarUrl: true,
  presenceStatus: true,
  createdAt: true,
} as const;

/** Statut de presence choisi par l'utilisateur (En ligne / Absent / Occupe / Invisible). */
router.patch(
  '/me/status',
  validate(z.object({ status: z.enum(['ONLINE', 'AWAY', 'BUSY', 'INVISIBLE']) })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { presenceStatus: req.body.status },
      select: { id: true, presenceStatus: true },
    });
    getIO()?.emit('presence:changed', { userId: user.id, status: user.presenceStatus });
    res.json(user);
  }),
);

/** Profil public d'une personne + relation d'amitie avec l'utilisateur courant. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: publicUser });
    if (!user) throw notFound('Utilisateur introuvable');

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: me, addresseeId: user.id },
          { requesterId: user.id, addresseeId: me },
        ],
      },
    });

    let friendState: 'none' | 'friends' | 'incoming' | 'outgoing' | 'self' = 'none';
    if (user.id === me) friendState = 'self';
    else if (friendship?.status === 'ACCEPTED') friendState = 'friends';
    else if (friendship?.status === 'PENDING')
      friendState = friendship.addresseeId === me ? 'incoming' : 'outgoing';

    const [mine, theirs] = await Promise.all([
      prisma.workspaceMember.findMany({ where: { userId: me }, select: { workspaceId: true } }),
      prisma.workspaceMember.findMany({ where: { userId: user.id }, select: { workspaceId: true } }),
    ]);
    const shared = new Set(mine.map((m) => m.workspaceId));
    const sharedWorkspaces = await prisma.workspace.findMany({
      where: { id: { in: theirs.map((t) => t.workspaceId).filter((id) => shared.has(id)) } },
      select: { id: true, name: true, color: true },
    });

    res.json({ ...user, friendState, friendshipId: friendship?.id ?? null, sharedWorkspaces });
  }),
);

export default router;
