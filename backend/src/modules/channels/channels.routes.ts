import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';
import { getIO } from '../../realtime/socket';

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
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { isPersonal: true },
    });

    const baseWhere = {
      workspaceId,
      AND: [
        { OR: [{ type: 'PUBLIC' as const }, { members: { some: { userId: me } } }] },
        // Salon masque si ma permission "vue" a ete retiree.
        { NOT: { members: { some: { userId: me, canView: false } } } },
      ],
    };
    // Espace personnel : on y agrège TOUTES ses conversations directes,
    // quel que soit l'espace où elles ont été créées.
    const where = ws?.isPersonal
      ? { OR: [baseWhere, { type: 'DIRECT' as const, members: { some: { userId: me } } }] }
      : baseWhere;

    const channels = await prisma.channel.findMany({
      where,
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
    const directWs = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { isPersonal: true },
    });
    const isPersonalWs = !!directWs?.isPersonal;

    const memberIds = [me, ...others];

    // 1:1 -> reutilise la conversation existante. Depuis l'espace personnel,
    // on cherche la conversation dans N'IMPORTE quel espace (évite les doublons).
    if (others.length === 1) {
      const existing = await prisma.channel.findFirst({
        where: {
          ...(isPersonalWs ? {} : { workspaceId }),
          type: 'DIRECT',
          name: null,
          members: { every: { userId: { in: memberIds } } },
          AND: [{ members: { some: { userId: me } } }, { members: { some: { userId: others[0] } } }],
        },
        include: memberInclude,
      });
      if (existing && existing.members.length === 2) return res.json(existing);
    }

    if (isPersonalWs) {
      // Espace personnel : les autres doivent être des amis. On les rattache en
      // invités (GUEST) : accès à la conversation, sans voir l'espace personnel.
      const fr = await prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: me, addresseeId: { in: others } },
            { addresseeId: me, requesterId: { in: others } },
          ],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = new Set(
        fr.flatMap((f) => [f.requesterId, f.addresseeId]).filter((id) => id !== me),
      );
      for (const id of others) {
        if (!friendIds.has(id)) throw forbidden('Vous devez être amis pour démarrer cette conversation');
      }
      await prisma.workspaceMember.createMany({
        data: others.map((userId) => ({ workspaceId, userId, role: 'GUEST' as const })),
        skipDuplicates: true,
      });
    } else {
      await Promise.all(others.map((id) => requireWorkspaceMember(id, workspaceId)));
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
    const added = await prisma.channelMember.createMany({
      data: req.body.userIds.map((userId: string) => ({ channelId: channel.id, userId })),
      skipDuplicates: true,
    });
    const full = await prisma.channel.findUnique({ where: { id: channel.id }, include: memberInclude });

    if (added.count > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: req.body.userIds } },
        select: { id: true, fullName: true },
      });
      for (const u of users) {
        runAutomations(channel.workspaceId, 'member.joined', {
          channelId: channel.id,
          channel: channel.name ?? '',
          user: u.fullName,
          userId: u.id,
          actorId: req.user!.id,
          summary: `${u.fullName} a rejoint ${channel.name ?? 'le salon'}`,
        });
      }
    }
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

// --- Chiffrement de bout en bout (DM / groupes privés) --------------------

const keyEnvelope = z.object({
  userId: z.string(),
  ephemeralPublicKey: z.string().min(1).max(4000),
  iv: z.string().min(1).max(400),
  wrappedKey: z.string().min(1).max(4000),
});

/**
 * Active (ou fait tourner) le chiffrement d'une conversation : le client fournit
 * la clé de conversation, chiffrée séparément pour chaque membre. Le serveur ne
 * voit que des enveloppes opaques.
 */
router.post(
  '/:id/e2ee',
  validate(z.object({ version: z.number().int().min(1), keys: z.array(keyEnvelope).min(1).max(200) })),
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.params.id);
    if (channel.type === 'PUBLIC') throw badRequest('Le chiffrement est réservé aux conversations privées');
    if (req.body.version <= channel.e2eeVersion) throw badRequest('Version de clé obsolète');

    const members = await prisma.channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    const provided = new Set(req.body.keys.map((k: z.infer<typeof keyEnvelope>) => k.userId));
    for (const id of memberIds) {
      if (!provided.has(id)) throw badRequest('Clé manquante pour un membre de la conversation');
    }

    await prisma.$transaction([
      prisma.channelKey.deleteMany({ where: { channelId: channel.id, version: req.body.version } }),
      prisma.channelKey.createMany({
        data: req.body.keys
          .filter((k: z.infer<typeof keyEnvelope>) => memberIds.has(k.userId))
          .map((k: z.infer<typeof keyEnvelope>) => ({
            channelId: channel.id,
            userId: k.userId,
            version: req.body.version,
            ephemeralPublicKey: k.ephemeralPublicKey,
            iv: k.iv,
            wrappedKey: k.wrappedKey,
          })),
      }),
      prisma.channel.update({
        where: { id: channel.id },
        data: {
          e2ee: true,
          e2eeVersion: req.body.version,
          e2eeSince: channel.e2eeSince ?? new Date(),
        },
      }),
    ]);

    getIO()?.to(`channel:${channel.id}`).emit('channel:e2ee', {
      channelId: channel.id,
      version: req.body.version,
    });
    res.json({ ok: true, version: req.body.version });
  }),
);

/** Les enveloppes de clé de l'utilisateur courant pour cette conversation. */
router.get(
  '/:id/e2ee/keys',
  asyncHandler(async (req, res) => {
    await requireChannelAccess(req.user!.id, req.params.id);
    const keys = await prisma.channelKey.findMany({
      where: { channelId: req.params.id, userId: req.user!.id },
      orderBy: { version: 'asc' },
      select: { version: true, ephemeralPublicKey: true, iv: true, wrappedKey: true },
    });
    res.json(keys);
  }),
);

export { requireChannelAccess };
export default router;
