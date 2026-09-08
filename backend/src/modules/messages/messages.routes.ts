import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireChannelAccess } from '../channels/channels.routes';
import { getIO } from '../../realtime/socket';
import { forbidden, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';

const router = Router();

const authorSelect = { id: true, fullName: true, avatarUrl: true, presenceStatus: true } as const;
const parentSelect = {
  select: { id: true, body: true, author: { select: { id: true, fullName: true } } },
} as const;
const messageInclude = {
  author: { select: authorSelect },
  attachments: true,
  parent: parentSelect,
  call: { select: { roomId: true, type: true, status: true, startedAt: true, endedAt: true } },
} as const;

router.get(
  '/',
  validate(
    z.object({
      channelId: z.string(),
      cursor: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(30),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { channelId, cursor, limit } = req.query as unknown as {
      channelId: string;
      cursor?: string;
      limit: number;
    };
    await requireChannelAccess(req.user!.id, channelId);

    const messages = await prisma.message.findMany({
      where: { channelId },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    res.json({
      items: page.reverse(),
      nextCursor: hasMore ? page[0]?.id : null,
    });
  }),
);

const attachmentSchema = z.object({
  url: z.string().max(500),
  name: z.string().max(200),
  mimeType: z.string().max(150),
  size: z.number().int().nonnegative().max(2 * 1024 * 1024),
});

router.post(
  '/',
  validate(
    z
      .object({
        channelId: z.string(),
        body: z.string().max(4000).optional().default(''),
        parentId: z.string().optional(),
        forwardedFrom: z.string().max(120).optional(),
        attachments: z.array(attachmentSchema).max(10).optional(),
      })
      .refine((v) => v.body.trim().length > 0 || (v.attachments?.length ?? 0) > 0, {
        message: 'Message vide',
      }),
  ),
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.body.channelId);

    const message = await prisma.message.create({
      data: {
        channelId: req.body.channelId,
        authorId: req.user!.id,
        body: req.body.body,
        parentId: req.body.parentId,
        forwardedFrom: req.body.forwardedFrom ?? null,
        ...(req.body.attachments?.length
          ? { attachments: { create: req.body.attachments } }
          : {}),
      },
      include: messageInclude,
    });

    const io = getIO();
    io?.to(`channel:${req.body.channelId}`).emit('message:new', message);

    // Notification globale : chaque membre du canal (sauf l'auteur) sur sa room `user:<id>`.
    const members = await prisma.channelMember.findMany({
      where: { channelId: req.body.channelId, userId: { not: req.user!.id } },
      select: { userId: true },
    });
    const notify = {
      channelId: req.body.channelId,
      workspaceId: channel.workspaceId,
      isDirect: channel.type === 'DIRECT',
      from: { id: message.author.id, fullName: message.author.fullName },
      preview: message.body.slice(0, 140) || 'Piece jointe',
      createdAt: message.createdAt,
    };
    members.forEach((m) => io?.to(`user:${m.userId}`).emit('message:notify', notify));

    if (!message.parentId) {
      runAutomations(channel.workspaceId, 'message.keyword', {
        message: { body: message.body, id: message.id },
        author: message.author.fullName,
        summary: `Message de ${message.author.fullName} : ${message.body}`,
      });
    }
    res.status(201).json(message);
  }),
);

router.patch(
  '/:id',
  validate(z.object({ body: z.string().min(1).max(4000) })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Message introuvable');
    if (existing.authorId !== req.user!.id) throw forbidden('Vous ne pouvez modifier que vos messages');

    const message = await prisma.message.update({
      where: { id: req.params.id },
      data: { body: req.body.body, editedAt: new Date() },
      include: messageInclude,
    });
    getIO()?.to(`channel:${existing.channelId}`).emit('message:updated', message);
    res.json(message);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Message introuvable');
    if (existing.authorId !== req.user!.id) throw forbidden('Vous ne pouvez supprimer que vos messages');
    await prisma.message.delete({ where: { id: req.params.id } });
    getIO()?.to(`channel:${existing.channelId}`).emit('message:deleted', { id: req.params.id });
    res.status(204).end();
  }),
);

export default router;
