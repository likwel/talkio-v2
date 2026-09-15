import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { notFound } from '../../lib/http';

const router = Router();

const TRIGGERS = [
  'form.response.created',
  'card.moved.done',
  'card.created',
  'card.overdue',
  'meal.measurement.created',
  'message.keyword',
  'message.command',
  'message.created',
  'member.joined',
  'channel.created',
  'schedule.daily',
] as const;
const ACTIONS = [
  'message.post',
  'message.reply',
  'message.broadcast',
  'card.create',
  'meal.activity.create',
  'meal.activity.sync',
  'webhook.post',
  'http.request',
] as const;

const bodySchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(2).max(120),
  enabled: z.boolean().default(true),
  triggerType: z.enum(TRIGGERS),
  triggerConfig: z.record(z.any()).default({}),
  actionType: z.enum(ACTIONS),
  actionConfig: z.record(z.any()).default({}),
});

router.get(
  '/',
  validate(z.object({ workspaceId: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(req.user!.id, workspaceId);
    const rows = await prisma.automation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  }),
);

router.post(
  '/',
  validate(bodySchema),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const row = await prisma.automation.create({
      data: { ...req.body, createdById: req.user!.id },
    });
    res.status(201).json(row);
  }),
);

router.patch(
  '/:id',
  validate(bodySchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.automation.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Automatisation introuvable');
    await requireWorkspaceMember(req.user!.id, existing.workspaceId);
    const { workspaceId, ...data } = req.body;
    const row = await prisma.automation.update({ where: { id: req.params.id }, data });
    res.json(row);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.automation.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Automatisation introuvable');
    await requireWorkspaceMember(req.user!.id, existing.workspaceId);
    await prisma.automation.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

export default router;
