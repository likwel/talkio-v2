import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireChannelAccess } from '../channels/channels.routes';
import { getIO } from '../../realtime/socket';
import { forbidden, notFound } from '../../lib/http';

const router = Router();

const authorSelect = { id: true, fullName: true, avatarUrl: true } as const;

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
      where: { channelId, parentId: null },
      include: { author: { select: authorSelect }, attachments: true, _count: { select: { replies: true } } },
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

router.post(
  '/',
  validate(
    z.object({
      channelId: z.string(),
      body: z.string().min(1).max(4000),
      parentId: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireChannelAccess(req.user!.id, req.body.channelId);

    const message = await prisma.message.create({
      data: {
        channelId: req.body.channelId,
        authorId: req.user!.id,
        body: req.body.body,
        parentId: req.body.parentId,
      },
      include: { author: { select: authorSelect }, attachments: true },
    });

    getIO()?.to(`channel:${req.body.channelId}`).emit('message:new', message);
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
      include: { author: { select: authorSelect }, attachments: true },
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
