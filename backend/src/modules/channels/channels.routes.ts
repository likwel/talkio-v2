import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { badRequest, forbidden, notFound } from '../../lib/http';

const router = Router();

async function requireChannelAccess(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw notFound('Canal introuvable');
  await requireWorkspaceMember(userId, channel.workspaceId);
  if (channel.type !== 'PUBLIC') {
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) throw forbidden('Canal prive');
  }
  return channel;
}

router.get(
  '/',
  validate(z.object({ workspaceId: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(req.user!.id, workspaceId);
    const channels = await prisma.channel.findMany({
      where: {
        workspaceId,
        OR: [{ type: 'PUBLIC' }, { members: { some: { userId: req.user!.id } } }],
      },
      include: {
        _count: { select: { messages: true, members: true } },
        members: {
          select: { userId: true, user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(channels);
  }),
);

router.post(
  '/',
  validate(
    z.object({
      workspaceId: z.string(),
      name: z.string().min(1).max(80),
      topic: z.string().max(280).optional(),
      type: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const channel = await prisma.channel.create({
      data: {
        workspaceId: req.body.workspaceId,
        name: req.body.name,
        topic: req.body.topic,
        type: req.body.type,
        members: { create: { userId: req.user!.id, isAdmin: true } },
      },
    });
    res.status(201).json(channel);
  }),
);

const memberInclude = {
  members: { select: { userId: true, user: { select: { id: true, fullName: true, avatarUrl: true } } } },
} as const;

/** Cree (ou retrouve) une conversation directe 1:1 ou de groupe. */
router.post(
  '/direct',
  validate(
    z.object({
      workspaceId: z.string(),
      // accepte `userId` (1:1) ou `userIds` (groupe)
      userId: z.string().optional(),
      userIds: z.array(z.string()).min(1).max(30).optional(),
      name: z.string().max(80).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { workspaceId, name } = req.body as { workspaceId: string; name?: string };
    const others = Array.from(
      new Set([...(req.body.userIds ?? []), ...(req.body.userId ? [req.body.userId] : [])].filter((id: string) => id !== me)),
    ) as string[];
    if (others.length === 0) throw badRequest('Au moins un participant est requis');

    await requireWorkspaceMember(me, workspaceId);
    await Promise.all(others.map((id) => requireWorkspaceMember(id, workspaceId)));

    const memberIds = [me, ...others];

    // 1:1 -> reutilise la conversation existante
    if (others.length === 1) {
      const existing = await prisma.channel.findFirst({
        where: {
          workspaceId,
          type: 'DIRECT',
          name: null,
          members: { every: { userId: { in: memberIds } } },
          AND: [{ members: { some: { userId: me } } }, { members: { some: { userId: others[0] } } }],
        },
        include: memberInclude,
      });
      if (existing && existing.members.length === 2) return res.json(existing);
    }

    const channel = await prisma.channel.create({
      data: {
        workspaceId,
        type: 'DIRECT',
        name: others.length > 1 ? name?.trim() || null : null,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: memberInclude,
    });
    return res.status(201).json(channel);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await requireChannelAccess(req.user!.id, req.params.id);
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.id },
      include: memberInclude,
    });
    res.json(channel);
  }),
);

router.patch(
  '/:id',
  validate(
    z.object({
      name: z.string().min(1).max(80).nullable().optional(),
      topic: z.string().max(280).nullable().optional(),
      color: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .nullable()
        .optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);
    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.topic !== undefined ? { topic: req.body.topic } : {}),
        ...(req.body.color !== undefined ? { color: req.body.color } : {}),
      },
      include: memberInclude,
    });
    res.json(updated);
  }),
);

router.post(
  '/:id/members',
  validate(z.object({ userIds: z.array(z.string()).min(1).max(50) })),
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);
    await Promise.all(req.body.userIds.map((uid: string) => requireWorkspaceMember(uid, channel.workspaceId)));
    await prisma.channelMember.createMany({
      data: req.body.userIds.map((userId: string) => ({ channelId: channel.id, userId })),
      skipDuplicates: true,
    });
    const full = await prisma.channel.findUnique({ where: { id: channel.id }, include: memberInclude });
    res.status(201).json(full);
  }),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);
    if (channel.type === 'DIRECT') throw badRequest('Impossible de retirer un membre d\'une conversation directe');
    await prisma.channelMember.deleteMany({
      where: { channelId: channel.id, userId: req.params.userId },
    });
    res.status(204).end();
  }),
);

router.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);
    const member = await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: req.user!.id } },
      update: {},
      create: { channelId: channel.id, userId: req.user!.id },
    });
    res.json(member);
  }),
);

export { requireChannelAccess };
export default router;
