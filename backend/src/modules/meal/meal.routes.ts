import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { myWorkspaceIds, requireWorkspaceMember } from '../../lib/access';
import { badRequest, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';
import { createNotification } from '../../lib/notify';
import { getIO } from '../../realtime/socket';

const router = Router();

async function actorName(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  return u?.fullName ?? 'Quelqu’un';
}

/**
 * Alerte de retard : notifie le responsable (et le porteur du projet) des
 * activites dont l'echeance est depassee, une seule fois par activite.
 * Sans planificateur dedie, la verification se fait a chaque consultation
 * du projet (declenche naturellement des qu'une equipe suit son plan de travail).
 */
async function checkOverdueActivities(project: {
  id: string;
  name: string;
  createdById: string;
  activities: { id: string; title: string; status: string; dueDate: Date | null; assigneeId: string | null; overdueNotifiedAt: Date | null }[];
}) {
  const now = new Date();
  const overdue = project.activities.filter(
    (a) =>
      a.dueDate &&
      a.dueDate < now &&
      a.status !== 'DONE' &&
      a.status !== 'CANCELLED' &&
      !a.overdueNotifiedAt,
  );
  if (overdue.length === 0) return;

  for (const a of overdue) {
    const recipients = new Set<string>();
    if (a.assigneeId) recipients.add(a.assigneeId);
    recipients.add(project.createdById);
    for (const userId of recipients) {
      await createNotification({
        userId,
        type: 'ACTIVITY_OVERDUE',
        title: `Activite en retard : ${a.title}`,
        body: project.name,
        link: `/meal/projects/${project.id}?t=workplan`,
        entityType: 'activity',
        entityId: a.id,
      });
    }
  }
  await prisma.activity.updateMany({
    where: { id: { in: overdue.map((a) => a.id) } },
    data: { overdueNotifiedAt: now },
  });
}

/** Charge un projet et verifie que l'utilisateur est membre de son espace. */
async function loadProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound('Projet introuvable');
  await requireWorkspaceMember(userId, project.workspaceId);
  return project;
}

type ChildModel =
  | 'mealIndicator'
  | 'activity'
  | 'budgetLine'
  | 'risk'
  | 'feedbackEntry'
  | 'lesson'
  | 'periodReport'
  | 'mealMeasurement'
  | 'indicatorTarget'
  | 'qualitativeInquiry';

/** Remonte au projet a partir d'un enregistrement enfant (par son id). */
async function projectOfChild(model: ChildModel, id: string, userId: string) {
  const viaIndicator = model === 'mealMeasurement' || model === 'indicatorTarget';
  const select = viaIndicator
    ? { indicator: { select: { project: { select: { id: true, workspaceId: true } } } } }
    : { project: { select: { id: true, workspaceId: true } } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = await (prisma[model] as any).findUnique({ where: { id }, select });
  const project = viaIndicator ? row?.indicator?.project : row?.project;
  if (!project) throw notFound('Element introuvable');
  await requireWorkspaceMember(userId, project.workspaceId);
  return project as { id: string; workspaceId: string };
}

// ======================================================================
//  Projets
// ======================================================================

router.get(
  '/projects',
  validate(z.object({ workspaceId: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const where = req.query.workspaceId
      ? { workspaceId: String(req.query.workspaceId) }
      : { workspaceId: { in: await myWorkspaceIds(req.user!.id) } };
    if (req.query.workspaceId) await requireWorkspaceMember(req.user!.id, String(req.query.workspaceId));

    const projects = await prisma.project.findMany({
      where,
      include: {
        workspace: { select: { id: true, name: true, color: true, isPersonal: true } },
        _count: {
          select: { indicators: true, forms: true, activities: true, risks: true, feedback: true },
        },
        budgetLines: { select: { planned: true, spent: true } },
        activities: { select: { status: true } },
        indicators: {
          select: { target: true, measurements: { select: { value: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const shaped = projects.map((p) => {
      const planned = p.budgetLines.reduce((s, b) => s + b.planned, 0);
      const spent = p.budgetLines.reduce((s, b) => s + b.spent, 0);
      const activitiesDone = p.activities.filter((a) => a.status === 'DONE').length;
      const indProgress = p.indicators
        .map((i) => {
          if (!i.target) return null;
          const achieved = i.measurements.reduce((s, m) => s + m.value, 0);
          return Math.min(100, Math.round((achieved / i.target) * 100));
        })
        .filter((v): v is number => v != null);
      const avgIndicator =
        indProgress.length > 0
          ? Math.round(indProgress.reduce((s, v) => s + v, 0) / indProgress.length)
          : null;
      const { budgetLines, activities, indicators, ...rest } = p;
      void budgetLines;
      void activities;
      void indicators;
      return {
        ...rest,
        budget: { planned, spent, rate: planned ? Math.round((spent / planned) * 100) : null },
        activitiesDone,
        avgIndicator,
      };
    });

    res.json(shaped);
  }),
);

const projectBody = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
  description: z.string().optional(),
  goal: z.string().optional(),
  donor: z.string().optional(),
  sector: z.string().optional(),
  location: z.string().optional(),
  currency: z.string().max(8).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  health: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

router.post(
  '/projects',
  validate(projectBody.extend({ workspaceId: z.string() })),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const project = await prisma.project.create({
      data: { ...req.body, createdById: req.user!.id },
    });
    res.status(201).json(project);
  }),
);

router.patch(
  '/projects/:id',
  validate(projectBody.partial()),
  asyncHandler(async (req, res) => {
    await loadProject(req.params.id, req.user!.id);
    const project = await prisma.project.update({ where: { id: req.params.id }, data: req.body });
    res.json(project);
  }),
);

router.delete(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    await loadProject(req.params.id, req.user!.id);
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

/** Membres de l'espace du projet (pour les listes deroulantes responsable / propietaire). */
router.get(
  '/projects/:id/members',
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: project.workspaceId },
      select: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { user: { fullName: 'asc' } },
    });
    res.json(members.map((m) => m.user));
  }),
);

router.get(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const base = await loadProject(req.params.id, req.user!.id);
    const project = await prisma.project.findUnique({
      where: { id: base.id },
      include: {
        _count: { select: { forms: true } },
        indicators: {
          orderBy: [{ level: 'asc' }, { code: 'asc' }],
          include: {
            measurements: { orderBy: { periodStart: 'asc' } },
            targets: { orderBy: { period: 'asc' } },
          },
        },
        activities: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          include: {
            assignee: { select: { id: true, fullName: true, avatarUrl: true } },
            card: { select: { id: true, title: true, column: { select: { name: true, boardId: true, board: { select: { name: true } } } } } },
          },
        },
        budgetLines: { orderBy: { createdAt: 'asc' } },
        risks: { orderBy: { createdAt: 'desc' }, include: { owner: { select: { id: true, fullName: true } } } },
        feedback: { orderBy: { receivedAt: 'desc' } },
        lessons: { orderBy: { createdAt: 'desc' } },
        reports: { orderBy: { period: 'desc' } },
        qualitativeInquiries: { orderBy: { createdAt: 'desc' } },
      },
    });

    const indicators = project!.indicators.map((ind) => {
      const achieved = ind.measurements.reduce((sum, m) => sum + m.value, 0);
      const progress = ind.target ? Math.round((achieved / ind.target) * 100) : null;
      const disagg = ind.measurements.reduce(
        (acc, m) => ({
          female: acc.female + (m.female ?? 0),
          male: acc.male + (m.male ?? 0),
          youth: acc.youth + (m.youth ?? 0),
          disability: acc.disability + (m.disability ?? 0),
        }),
        { female: 0, male: 0, youth: 0, disability: 0 },
      );
      return { ...ind, achieved, progress, disagg };
    });

    const planned = project!.budgetLines.reduce((s, b) => s + b.planned, 0);
    const spent = project!.budgetLines.reduce((s, b) => s + b.spent, 0);

    checkOverdueActivities(project!).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[meal] verification retard echouee', err);
    });

    res.json({
      ...project,
      indicators,
      budgetTotals: { planned, spent, rate: planned ? Math.round((spent / planned) * 100) : null },
    });
  }),
);

// ======================================================================
//  Indicateurs (cadre logique) + cibles periodiques
// ======================================================================

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
      assumptions: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
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
      code: z.string().optional(),
      name: z.string().optional(),
      level: z.enum(['IMPACT', 'OUTCOME', 'OUTPUT', 'ACTIVITY']).optional(),
      unit: z.string().nullable().optional(),
      baseline: z.number().nullable().optional(),
      target: z.number().nullable().optional(),
      meansOfVerification: z.string().nullable().optional(),
      assumptions: z.string().nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await projectOfChild('mealIndicator', req.params.indicatorId, req.user!.id);
    const indicator = await prisma.mealIndicator.update({
      where: { id: req.params.indicatorId },
      data: req.body,
    });
    res.json(indicator);
  }),
);

router.delete(
  '/indicators/:indicatorId',
  asyncHandler(async (req, res) => {
    await projectOfChild('mealIndicator', req.params.indicatorId, req.user!.id);
    await prisma.mealIndicator.delete({ where: { id: req.params.indicatorId } });
    res.status(204).end();
  }),
);

router.put(
  '/indicators/:indicatorId/targets',
  validate(z.object({ period: z.string().min(4).max(12), target: z.number() })),
  asyncHandler(async (req, res) => {
    await projectOfChild('mealIndicator', req.params.indicatorId, req.user!.id);
    const row = await prisma.indicatorTarget.upsert({
      where: { indicatorId_period: { indicatorId: req.params.indicatorId, period: req.body.period } },
      update: { target: req.body.target },
      create: { indicatorId: req.params.indicatorId, period: req.body.period, target: req.body.target },
    });
    res.json(row);
  }),
);

router.delete(
  '/targets/:targetId',
  asyncHandler(async (req, res) => {
    await projectOfChild('indicatorTarget', req.params.targetId, req.user!.id);
    await prisma.indicatorTarget.delete({ where: { id: req.params.targetId } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Mesures / releves (avec ventilation beneficiaires)
// ======================================================================

router.post(
  '/indicators/:indicatorId/measurements',
  validate(
    z.object({
      value: z.number(),
      periodStart: z.coerce.date(),
      periodEnd: z.coerce.date(),
      location: z.string().optional(),
      note: z.string().optional(),
      source: z.string().optional(),
      female: z.number().optional(),
      male: z.number().optional(),
      youth: z.number().optional(),
      disability: z.number().optional(),
      verified: z.boolean().optional(),
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
        source: req.body.source,
        female: req.body.female,
        male: req.body.male,
        youth: req.body.youth,
        disability: req.body.disability,
        verified: req.body.verified ?? false,
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
    // Suivi : le porteur du projet est notifie d'un nouveau releve.
    await createNotification({
      userId: indicator.project.createdById,
      actorId: req.user!.id,
      type: 'MEASUREMENT_ADDED',
      title: `${await actorName(req.user!.id)} a enregistre un releve`,
      body: `${indicator.project.name} — ${indicator.code} ${indicator.name} : ${measurement.value}`,
      link: `/meal/projects/${indicator.project.id}?t=logframe`,
      entityType: 'indicator',
      entityId: indicator.id,
    });
    res.status(201).json(measurement);
  }),
);

router.patch(
  '/measurements/:measurementId',
  validate(
    z.object({
      value: z.number().optional(),
      location: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      female: z.number().nullable().optional(),
      male: z.number().nullable().optional(),
      youth: z.number().nullable().optional(),
      disability: z.number().nullable().optional(),
      verified: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await projectOfChild('mealMeasurement', req.params.measurementId, req.user!.id);
    const row = await prisma.mealMeasurement.update({
      where: { id: req.params.measurementId },
      data: req.body,
    });
    res.json(row);
  }),
);

router.delete(
  '/measurements/:measurementId',
  asyncHandler(async (req, res) => {
    await projectOfChild('mealMeasurement', req.params.measurementId, req.user!.id);
    await prisma.mealMeasurement.delete({ where: { id: req.params.measurementId } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Plan de travail (activites)
// ======================================================================

const activityBody = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  indicatorId: z.string().nullable().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'DELAYED', 'CANCELLED']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  location: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

router.post(
  '/projects/:id/activities',
  validate(activityBody),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const row = await prisma.activity.create({ data: { ...req.body, projectId: project.id } });
    if (row.assigneeId) {
      await createNotification({
        userId: row.assigneeId,
        actorId: req.user!.id,
        type: 'PROJECT_ASSIGNED',
        title: `${await actorName(req.user!.id)} vous a assigne une activite`,
        body: `${project.name} — ${row.title}`,
        link: `/meal/projects/${project.id}?t=workplan`,
        entityType: 'activity',
        entityId: row.id,
      });
    }
    res.status(201).json(row);
  }),
);

router.patch(
  '/activities/:activityId',
  validate(activityBody.partial()),
  asyncHandler(async (req, res) => {
    await projectOfChild('activity', req.params.activityId, req.user!.id);
    const before = await prisma.activity.findUnique({
      where: { id: req.params.activityId },
      select: { assigneeId: true },
    });
    const row = await prisma.activity.update({
      where: { id: req.params.activityId },
      data: req.body,
      include: {
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (row.assigneeId && row.assigneeId !== before?.assigneeId) {
      await createNotification({
        userId: row.assigneeId,
        actorId: req.user!.id,
        type: 'PROJECT_ASSIGNED',
        title: `${await actorName(req.user!.id)} vous a assigne une activite`,
        body: `${row.project.name} — ${row.title}`,
        link: `/meal/projects/${row.project.id}?t=workplan`,
        entityType: 'activity',
        entityId: row.id,
      });
    }
    res.json(row);
  }),
);

router.delete(
  '/activities/:activityId',
  asyncHandler(async (req, res) => {
    await projectOfChild('activity', req.params.activityId, req.user!.id);
    await prisma.activity.delete({ where: { id: req.params.activityId } });
    res.status(204).end();
  }),
);

/**
 * Alignement calendrier (phase Planification) : cree ou met a jour un evenement
 * dans l'agenda personnel de l'utilisateur, aux dates de l'activite.
 */
router.post(
  '/activities/:activityId/sync-calendar',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const project = await projectOfChild('activity', req.params.activityId, me);
    const activity = await prisma.activity.findUnique({ where: { id: req.params.activityId } });
    if (!activity) throw notFound('Activite introuvable');
    if (!activity.startDate && !activity.dueDate) {
      throw notFound("Cette activite n'a ni date de debut ni echeance");
    }
    const fullProject = await prisma.project.findUnique({ where: { id: project.id }, select: { name: true } });

    // setUTCHours (et non setHours) : les dates d'activite sont des dates UTC
    // « nues » (minuit UTC) — passer par l'heure locale du serveur decalerait
    // l'evenement d'un jour des que le fuseau serveur n'est pas UTC+0.
    const starts = activity.startDate ?? activity.dueDate!;
    const ends = activity.dueDate ?? activity.startDate!;
    const startsAt = new Date(starts);
    const endsAt = new Date(ends.getTime() > starts.getTime() ? ends : starts);
    endsAt.setUTCHours(23, 59, 59, 0);
    startsAt.setUTCHours(0, 0, 0, 0);

    let calendar = await prisma.calendar.findFirst({
      where: { workspaceId: project.workspaceId, ownerId: me },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!calendar) {
      calendar = await prisma.calendar.create({
        data: { workspaceId: project.workspaceId, ownerId: me, name: 'Mon agenda', isDefault: true },
      });
    }

    const eventData = {
      calendarId: calendar.id,
      title: `📋 ${activity.title}`,
      description: `Plan de travail MEAL — ${fullProject?.name ?? ''}${activity.description ? `\n\n${activity.description}` : ''}`,
      location: activity.location ?? undefined,
      allDay: true,
      startsAt,
      endsAt,
      createdById: me,
    };

    const event = activity.calendarEventId
      ? await prisma.calendarEvent.update({ where: { id: activity.calendarEventId }, data: eventData })
      : await prisma.calendarEvent.create({ data: eventData });

    if (!activity.calendarEventId) {
      await prisma.activity.update({ where: { id: activity.id }, data: { calendarEventId: event.id } });
    }
    getIO()?.to(`calendar:${project.workspaceId}`).emit('calendar:changed', { change: 'created', event });
    res.status(201).json({ calendarEventId: event.id });
  }),
);

router.delete(
  '/activities/:activityId/sync-calendar',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const project = await projectOfChild('activity', req.params.activityId, me);
    const activity = await prisma.activity.findUnique({ where: { id: req.params.activityId } });
    if (!activity?.calendarEventId) return res.status(204).end();
    await prisma.calendarEvent.delete({ where: { id: activity.calendarEventId } }).catch(() => null);
    await prisma.activity.update({ where: { id: activity.id }, data: { calendarEventId: null } });
    getIO()?.to(`calendar:${project.workspaceId}`).emit('calendar:changed', { change: 'deleted', event: { id: activity.calendarEventId } });
    res.status(204).end();
  }),
);

/**
 * Lien Projet (Kanban) <-> Suivi-evaluation : rattache une tache existante a
 * l'activite. Des lors, le statut de la carte (colonne "termine" ou non)
 * pilote automatiquement le statut de l'activite (voir POST /cards/:id/move).
 */
router.post(
  '/activities/:activityId/link-card',
  validate(z.object({ cardId: z.string() })),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const project = await projectOfChild('activity', req.params.activityId, me);
    const card = await prisma.card.findUnique({
      where: { id: req.body.cardId },
      include: { column: { include: { board: true } } },
    });
    if (!card) throw notFound('Tache introuvable');
    await requireWorkspaceMember(me, card.column.board.workspaceId);
    if (card.column.board.workspaceId !== project.workspaceId) {
      throw badRequest('La tache doit appartenir au meme espace de travail que le projet');
    }
    const already = await prisma.activity.findUnique({ where: { cardId: card.id } });
    if (already && already.id !== req.params.activityId) {
      throw badRequest('Cette tache est deja liee a une autre activite');
    }
    const activity = await prisma.activity.update({
      where: { id: req.params.activityId },
      data: { cardId: card.id },
      include: { assignee: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.json({
      ...activity,
      card: { id: card.id, title: card.title, boardId: card.column.boardId, boardName: card.column.board.name, columnName: card.column.name },
    });
  }),
);

router.delete(
  '/activities/:activityId/link-card',
  asyncHandler(async (req, res) => {
    await projectOfChild('activity', req.params.activityId, req.user!.id);
    await prisma.activity.update({ where: { id: req.params.activityId }, data: { cardId: null } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Budget
// ======================================================================

const budgetBody = z.object({
  label: z.string().min(1),
  donor: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  planned: z.number().min(0).optional(),
  spent: z.number().min(0).optional(),
  note: z.string().nullable().optional(),
});

router.post(
  '/projects/:id/budget',
  validate(budgetBody),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const row = await prisma.budgetLine.create({ data: { ...req.body, projectId: project.id } });
    res.status(201).json(row);
  }),
);

router.patch(
  '/budget/:lineId',
  validate(budgetBody.partial()),
  asyncHandler(async (req, res) => {
    await projectOfChild('budgetLine', req.params.lineId, req.user!.id);
    const row = await prisma.budgetLine.update({ where: { id: req.params.lineId }, data: req.body });
    res.json(row);
  }),
);

router.delete(
  '/budget/:lineId',
  asyncHandler(async (req, res) => {
    await projectOfChild('budgetLine', req.params.lineId, req.user!.id);
    await prisma.budgetLine.delete({ where: { id: req.params.lineId } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Registre des risques
// ======================================================================

const riskBody = z.object({
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  mitigation: z.string().nullable().optional(),
  status: z.enum(['OPEN', 'MITIGATED', 'CLOSED']).optional(),
  ownerId: z.string().nullable().optional(),
});

router.post(
  '/projects/:id/risks',
  validate(riskBody),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const row = await prisma.risk.create({ data: { ...req.body, projectId: project.id } });
    if (row.ownerId) {
      await createNotification({
        userId: row.ownerId,
        actorId: req.user!.id,
        type: 'RISK_ASSIGNED',
        title: `${await actorName(req.user!.id)} vous a confie un risque`,
        body: `${project.name} — ${row.title}`,
        link: `/meal/projects/${project.id}?t=accountability`,
        entityType: 'risk',
        entityId: row.id,
      });
    }
    res.status(201).json(row);
  }),
);

router.patch(
  '/risks/:riskId',
  validate(riskBody.partial()),
  asyncHandler(async (req, res) => {
    await projectOfChild('risk', req.params.riskId, req.user!.id);
    const before = await prisma.risk.findUnique({
      where: { id: req.params.riskId },
      select: { ownerId: true },
    });
    const row = await prisma.risk.update({
      where: { id: req.params.riskId },
      data: req.body,
      include: {
        owner: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (row.ownerId && row.ownerId !== before?.ownerId) {
      await createNotification({
        userId: row.ownerId,
        actorId: req.user!.id,
        type: 'RISK_ASSIGNED',
        title: `${await actorName(req.user!.id)} vous a confie un risque`,
        body: `${row.project.name} — ${row.title}`,
        link: `/meal/projects/${row.project.id}?t=accountability`,
        entityType: 'risk',
        entityId: row.id,
      });
    }
    res.json(row);
  }),
);

router.delete(
  '/risks/:riskId',
  asyncHandler(async (req, res) => {
    await projectOfChild('risk', req.params.riskId, req.user!.id);
    await prisma.risk.delete({ where: { id: req.params.riskId } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Redevabilite : retours & plaintes
// ======================================================================

const feedbackBody = z.object({
  type: z.enum(['COMPLAINT', 'SUGGESTION', 'QUESTION', 'APPRECIATION']).optional(),
  channel: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sensitive: z.boolean().optional(),
  summary: z.string().min(2),
  detail: z.string().nullable().optional(),
  reporter: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED']).optional(),
  resolution: z.string().nullable().optional(),
  receivedAt: z.coerce.date().optional(),
});

router.post(
  '/projects/:id/feedback',
  validate(feedbackBody),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const row = await prisma.feedbackEntry.create({ data: { ...req.body, projectId: project.id } });
    res.status(201).json(row);
  }),
);

router.patch(
  '/feedback/:entryId',
  validate(feedbackBody.partial()),
  asyncHandler(async (req, res) => {
    await projectOfChild('feedbackEntry', req.params.entryId, req.user!.id);
    const patch: Record<string, unknown> = { ...req.body };
    if (req.body.status === 'RESOLVED' || req.body.status === 'CLOSED') patch.resolvedAt = new Date();
    if (req.body.status === 'NEW' || req.body.status === 'IN_REVIEW') patch.resolvedAt = null;
    const row = await prisma.feedbackEntry.update({ where: { id: req.params.entryId }, data: patch });
    res.json(row);
  }),
);

router.delete(
  '/feedback/:entryId',
  asyncHandler(async (req, res) => {
    await projectOfChild('feedbackEntry', req.params.entryId, req.user!.id);
    await prisma.feedbackEntry.delete({ where: { id: req.params.entryId } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Apprentissage : lecons apprises
// ======================================================================

const lessonBody = z.object({
  title: z.string().min(2),
  category: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
  insight: z.string().min(2),
  recommendation: z.string().nullable().optional(),
});

router.post(
  '/projects/:id/lessons',
  validate(lessonBody),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const row = await prisma.lesson.create({ data: { ...req.body, projectId: project.id } });
    res.status(201).json(row);
  }),
);

router.patch(
  '/lessons/:lessonId',
  validate(lessonBody.partial()),
  asyncHandler(async (req, res) => {
    await projectOfChild('lesson', req.params.lessonId, req.user!.id);
    const row = await prisma.lesson.update({ where: { id: req.params.lessonId }, data: req.body });
    res.json(row);
  }),
);

router.delete(
  '/lessons/:lessonId',
  asyncHandler(async (req, res) => {
    await projectOfChild('lesson', req.params.lessonId, req.user!.id);
    await prisma.lesson.delete({ where: { id: req.params.lessonId } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Rapports de periode
// ======================================================================

const reportBody = z.object({
  period: z.string().min(4).max(16),
  title: z.string().min(2),
  narrative: z.string().nullable().optional(),
  achievements: z.string().nullable().optional(),
  challenges: z.string().nullable().optional(),
});

router.post(
  '/projects/:id/reports',
  validate(reportBody),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const row = await prisma.periodReport.create({ data: { ...req.body, projectId: project.id } });
    res.status(201).json(row);
  }),
);

router.patch(
  '/reports/:reportId',
  validate(reportBody.partial()),
  asyncHandler(async (req, res) => {
    await projectOfChild('periodReport', req.params.reportId, req.user!.id);
    const row = await prisma.periodReport.update({ where: { id: req.params.reportId }, data: req.body });
    res.json(row);
  }),
);

router.delete(
  '/reports/:reportId',
  asyncHandler(async (req, res) => {
    await projectOfChild('periodReport', req.params.reportId, req.user!.id);
    await prisma.periodReport.delete({ where: { id: req.params.reportId } });
    res.status(204).end();
  }),
);

// ======================================================================
//  Qualitative Inquiry Planning Sheet (QuIPS)
// ======================================================================

const quipsBody = z.object({
  code: z.string().max(60).nullable().optional(),
  title: z.string().min(2),
  status: z.enum(['DRAFT', 'FINAL']).optional(),

  sourceDocuments: z.string().nullable().optional(),
  evidenceGaps: z.string().nullable().optional(),
  collaborators: z.string().nullable().optional(),
  reviewers: z.string().nullable().optional(),
  stakeholders: z.string().nullable().optional(),

  purpose: z.string().nullable().optional(),
  objectives: z.string().nullable().optional(),
  researchQuestions: z.string().nullable().optional(),
  dataTypes: z.array(z.string().max(40)).max(10).optional(),

  dataSources: z.string().nullable().optional(),
  samplingStrategy: z.string().nullable().optional(),
  dataCollectionTools: z.string().nullable().optional(),

  teamComposition: z.string().nullable().optional(),
  frequencyTiming: z.string().nullable().optional(),
  trainingRequirements: z.string().nullable().optional(),
  dataManagement: z.string().nullable().optional(),
  implementationTimeline: z.string().nullable().optional(),

  dataAnalysisPlan: z.string().nullable().optional(),
  disaggregatedBy: z.string().nullable().optional(),
  deliverables: z.string().nullable().optional(),
  utilizationApplication: z.string().nullable().optional(),

  limitationsRisks: z.string().nullable().optional(),
  ethicalReviewStatus: z.string().nullable().optional(),
});

router.post(
  '/projects/:id/quips',
  validate(quipsBody),
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id, req.user!.id);
    const row = await prisma.qualitativeInquiry.create({
      data: { ...req.body, projectId: project.id, createdById: req.user!.id },
    });
    res.status(201).json(row);
  }),
);

router.get(
  '/quips/:quipsId',
  asyncHandler(async (req, res) => {
    await projectOfChild('qualitativeInquiry', req.params.quipsId, req.user!.id);
    const row = await prisma.qualitativeInquiry.findUnique({ where: { id: req.params.quipsId } });
    res.json(row);
  }),
);

router.patch(
  '/quips/:quipsId',
  validate(quipsBody.partial()),
  asyncHandler(async (req, res) => {
    await projectOfChild('qualitativeInquiry', req.params.quipsId, req.user!.id);
    const row = await prisma.qualitativeInquiry.update({ where: { id: req.params.quipsId }, data: req.body });
    res.json(row);
  }),
);

router.delete(
  '/quips/:quipsId',
  asyncHandler(async (req, res) => {
    await projectOfChild('qualitativeInquiry', req.params.quipsId, req.user!.id);
    await prisma.qualitativeInquiry.delete({ where: { id: req.params.quipsId } });
    res.status(204).end();
  }),
);

export default router;
