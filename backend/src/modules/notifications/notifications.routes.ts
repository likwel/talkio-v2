import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';

const router = Router();

const actorSelect = { id: true, fullName: true, avatarUrl: true } as const;

/** Liste paginee (30 par page, `before` = curseur ISO sur createdAt) + compteur non lus. */
router.get(
  '/',
  validate(z.object({ before: z.string().optional(), limit: z.coerce.number().min(1).max(50).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const take = Number(req.query.limit ?? 30);
    const before = req.query.before ? new Date(String(req.query.before)) : undefined;
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: me, ...(before ? { createdAt: { lt: before } } : {}) },
        include: { actor: { select: actorSelect } },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      prisma.notification.count({ where: { userId: me, readAt: null } }),
    ]);
    res.json({ items, unread, nextBefore: items.length === take ? items[items.length - 1].createdAt : null });
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({ where: { userId: req.user!.id, readAt: null } });
    res.json({ count });
  }),
);

/** Marque une notification (ou toutes) comme lue. */
router.post(
  '/read',
  validate(z.object({ id: z.string().optional(), all: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    if (req.body.all) {
      await prisma.notification.updateMany({
        where: { userId: me, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (req.body.id) {
      await prisma.notification.updateMany({
        where: { id: req.body.id, userId: me, readAt: null },
        data: { readAt: new Date() },
      });
    }
    const count = await prisma.notification.count({ where: { userId: me, readAt: null } });
    res.json({ unread: count });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.status(204).end();
  }),
);

/** Vide toutes les notifications de l'utilisateur. */
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await prisma.notification.deleteMany({ where: { userId: req.user!.id } });
    res.status(204).end();
  }),
);

export default router;
