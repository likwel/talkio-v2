import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';

const router = Router();

async function requireChannelAccess(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw notFound('Canal introuvable');
  await requireWorkspaceMember(userId, channel.workspaceId);
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (channel.type !== 'PUBLIC' && !member) throw forbidden('Canal prive');
  // Permission de lecture retiree pour ce membre dans ce salon.
  if (member && member.canRead === false) throw forbidden('Lecture non autorisee dans ce salon');
  return channel;
}

router.get(
  '/',
  validate(z.object({ workspaceId: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(me, workspaceId);
    const channels = await prisma.channel.findMany({
      where: {
        workspaceId,
        AND: [
          { OR: [{ type: 'PUBLIC' }, { members: { some: { userId: me } } }] },
          // Salon masque si ma permission "vue" a ete retiree.
          { NOT: { members: { some: { userId: me, canView: false } } } },
        ],
      },
      include: {
        _count: { select: { messages: true, members: true } },
        members: {
          select: {
            userId: true,
            lastReadAt: true,
            canView: true,
            canRead: true,
            canWrite: true,
            isAdmin: true,
            user: { select: { id: true, fullName: true, avatarUrl: true, presenceStatus: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Nombre de membres "actifs" par salon : tous les membres de l'espace pour un
    // salon non direct, moins ceux dont la vue a ete retiree.
    const wsMemberCount = await prisma.workspaceMember.count({ where: { workspaceId } });

    // Nombre de messages non lus par salon (base sur ChannelMember.lastReadAt).
    const myMemberships = await prisma.channelMember.findMany({
      where: { userId: me, channelId: { in: channels.map((c) => c.id) } },
      select: { channelId: true, lastReadAt: true },
    });
    const lastReadByChannel = new Map(myMemberships.map((m) => [m.channelId, m.lastReadAt]));
    const unreadEntries = await Promise.all(
      channels.map(async (c) => {
        if (!lastReadByChannel.has(c.id)) return [c.id, 0] as const;
        const lastReadAt = lastReadByChannel.get(c.id) ?? undefined;
        const count = await prisma.message.count({
          where: {
            channelId: c.id,
            parentId: null,
            authorId: { not: me },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
        return [c.id, count] as const;
      }),
    );
    const unreadByChannel = new Map(unreadEntries);

    res.json(
      channels.map((c) => {
        const deactivated = c.members.filter((m) => m.canView === false).length;
        const activeMemberCount =
          c.type === 'DIRECT' ? c._count.members : Math.max(0, wsMemberCount - deactivated);
        return { ...c, unreadCount: unreadByChannel.get(c.id) ?? 0, activeMemberCount };
      }),
    );
  }),
);

// Marque le salon comme lu (met a jour ChannelMember.lastReadAt).
router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: req.user!.id } },
      update: { lastReadAt: new Date() },
      create: { channelId: channel.id, userId: req.user!.id, lastReadAt: new Date() },
    });
    res.status(204).end();
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
        createdById: req.user!.id,
        members: { create: { userId: req.user!.id, isAdmin: true } },
      },
    });
    runAutomations(req.body.workspaceId, 'channel.created', {
      channel: { name: channel.name, id: channel.id },
      summary: `Nouveau salon « ${channel.name ?? ''} »`,
    });
    res.status(201).json(channel);
  }),
);

const memberInclude = {
  members: {
    select: {
      userId: true,
      lastReadAt: true,
      canView: true,
      canRead: true,
      canWrite: true,
      isAdmin: true,
      user: { select: { id: true, fullName: true, avatarUrl: true, presenceStatus: true } },
    },
  },
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
        createdById: me,
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
      wallpaper: z.string().max(40).nullable().optional(),
      readReceipts: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);

    // Les accuses de lecture ne sont modifiables que par le createur de la conversation.
    if (
      req.body.readReceipts !== undefined &&
      channel.createdById &&
      channel.createdById !== req.user!.id
    ) {
      throw forbidden('Seul le createur de la conversation peut modifier les accuses de lecture');
    }

    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.topic !== undefined ? { topic: req.body.topic } : {}),
        ...(req.body.color !== undefined ? { color: req.body.color } : {}),
        ...(req.body.wallpaper !== undefined ? { wallpaper: req.body.wallpaper } : {}),
        ...(req.body.readReceipts !== undefined ? { readReceipts: req.body.readReceipts } : {}),
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

/**
 * Permissions d'un membre de l'espace pour ce salon : vue / lecture / ecriture.
 * Cree (upsert) une ligne ChannelMember portant les surcharges. On ne retire
 * jamais un membre de l'espace : on desactive seulement ses acces.
 */
router.patch(
  '/:id/members/:userId/permissions',
  validate(
    z.object({
      canView: z.boolean().optional(),
      canRead: z.boolean().optional(),
      canWrite: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);
    if (channel.type === 'DIRECT') throw badRequest('Permissions non applicables a une conversation directe');
    await requireWorkspaceMember(req.params.userId, channel.workspaceId);

    const data = {
      ...(req.body.canView !== undefined ? { canView: req.body.canView } : {}),
      ...(req.body.canRead !== undefined ? { canRead: req.body.canRead } : {}),
      ...(req.body.canWrite !== undefined ? { canWrite: req.body.canWrite } : {}),
    };
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: req.params.userId } },
      update: data,
      create: { channelId: channel.id, userId: req.params.userId, ...data },
    });
    const full = await prisma.channel.findUnique({ where: { id: channel.id }, include: memberInclude });
    res.json(full);
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
