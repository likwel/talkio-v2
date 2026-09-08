import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';

const router = Router();

// --- Projets --------------------------------------------------------------

router.get(
  '/projects',
  validate(z.object({ workspaceId: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(req.user!.id, workspaceId);
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: { _count: { select: { indicators: true, forms: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  }),
);

router.post(
  '/projects',
  validate(
    z.object({
      workspaceId: z.string(),
      name: z.string().min(2),
      code: z.string().optional(),
      description: z.string().optional(),
      donor: z.string().optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const project = await prisma.project.create({
      data: { ...req.body, createdById: req.user!.id },
    });
    res.status(201).json(project);
  }),
);

router.get(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        indicators: {
          orderBy: [{ level: 'asc' }, { code: 'asc' }],
          include: {
            measurements: { orderBy: { periodStart: 'asc' } },
          },
        },
      },
    });
    if (!project) throw notFound('Projet introuvable');
    await requireWorkspaceMember(req.user!.id, project.workspaceId);

    const indicators = project.indicators.map((ind) => {
      const achieved = ind.measurements.reduce((sum, m) => sum + m.value, 0);
      const progress = ind.target ? Math.round((achieved / ind.target) * 100) : null;
      return { ...ind, achieved, progress };
    });

    res.json({ ...project, indicators });
  }),
);

// --- Indicateurs (cadre logique) ---------------------------------------

router.post(
  '/projects/:id/indicators',
  validate(
    z.object({
      code: z.string().min(1),
      name: z.string().min(2),
      level: z.enum(['IMPACT', 'OUTCOME', 'OUTPUT', 'ACTIVITY']).default('OUTCOME'),
      unit: z.string().optional(),
      baseline: z.number().optional(),
      target: z.number().optional(),
      disaggregation: z.array(z.string()).default([]),
      meansOfVerification: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw notFound('Projet introuvable');
    await requireWorkspaceMember(req.user!.id, project.workspaceId);
    const indicator = await prisma.mealIndicator.create({
      data: { ...req.body, projectId: project.id },
    });
    res.status(201).json(indicator);
  }),
);

router.patch(
  '/indicators/:indicatorId',
  validate(
    z.object({
      name: z.string().optional(),
      unit: z.string().nullable().optional(),
      baseline: z.number().nullable().optional(),
      target: z.number().nullable().optional(),
      meansOfVerification: z.string().nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const indicator = await prisma.mealIndicator.update({
      where: { id: req.params.indicatorId },
      data: req.body,
    });
    res.json(indicator);
  }),
);

// --- Mesures / relevés -----------------------------------------------------

router.post(
  '/indicators/:indicatorId/measurements',
  validate(
    z.object({
      value: z.number(),
      periodStart: z.coerce.date(),
      periodEnd: z.coerce.date(),
      location: z.string().optional(),
      note: z.string().optional(),
      dimensions: z.record(z.any()).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const indicator = await prisma.mealIndicator.findUnique({
      where: { id: req.params.indicatorId },
      include: { project: true },
    });
    if (!indicator) throw notFound('Indicateur introuvable');
    await requireWorkspaceMember(req.user!.id, indicator.project.workspaceId);
    const measurement = await prisma.mealMeasurement.create({
      data: {
        indicatorId: indicator.id,
        value: req.body.value,
        periodStart: req.body.periodStart,
        periodEnd: req.body.periodEnd,
        location: req.body.location,
        note: req.body.note,
        dimensions: req.body.dimensions,
        recordedById: req.user!.id,
      },
    });
    runAutomations(indicator.project.workspaceId, 'meal.measurement.created', {
      indicator: { name: indicator.name, code: indicator.code },
      measurement: { value: measurement.value, location: measurement.location ?? '' },
      summary: `Mesure MEAL : ${indicator.name} = ${measurement.value}${
        measurement.location ? ` (${measurement.location})` : ''
      }`,
    });
    res.status(201).json(measurement);
  }),
);

router.delete(
  '/measurements/:measurementId',
  asyncHandler(async (req, res) => {
    await prisma.mealMeasurement.delete({ where: { id: req.params.measurementId } });
    res.status(204).end();
  }),
);

export default router;
