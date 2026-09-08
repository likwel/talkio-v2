import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { getIO } from '../../realtime/socket';

const router = Router();

type CalendarChange = 'created' | 'updated' | 'deleted';

/** Diffuse une modification d'agenda aux clients abonnes a l'espace de travail. */
function broadcast(workspaceId: string, change: CalendarChange, event: unknown) {
  getIO()?.to(`calendar:${workspaceId}`).emit('calendar:changed', { change, event });
}

const PALETTE = ['#0cae36', '#63e6be', '#0ea5e9', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#6366f1'];

/** Renvoie les agendas de l'utilisateur dans l'espace, en creant un agenda par defaut si besoin. */
async function ensureCalendars(userId: string, workspaceId: string) {
  const calendars = await prisma.calendar.findMany({
    where: { workspaceId, ownerId: userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  if (calendars.length > 0) return calendars;
  const created = await prisma.calendar.create({
    data: { workspaceId, ownerId: userId, name: 'Mon agenda', color: PALETTE[0], isDefault: true },
  });
  return [created];
}

async function ownedCalendar(userId: string, calendarId: string) {
  const calendar = await prisma.calendar.findUnique({ where: { id: calendarId } });
  if (!calendar) throw notFound('Agenda introuvable');
  if (calendar.ownerId !== userId) throw forbidden('Cet agenda ne vous appartient pas');
  return calendar;
}

// --- Agendas -------------------------------------------------------------

router.get(
  '/calendars',
  validate(z.object({ workspaceId: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(req.user!.id, workspaceId);
    res.json(await ensureCalendars(req.user!.id, workspaceId));
  }),
);

router.post(
  '/calendars',
  validate(
    z.object({
      workspaceId: z.string(),
      name: z.string().min(1).max(80),
      color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const count = await prisma.calendar.count({ where: { workspaceId: req.body.workspaceId, ownerId: req.user!.id } });
    const calendar = await prisma.calendar.create({
      data: {
        workspaceId: req.body.workspaceId,
        ownerId: req.user!.id,
        name: req.body.name,
        color: req.body.color ?? PALETTE[count % PALETTE.length],
      },
    });
    broadcast(calendar.workspaceId, 'created', { calendar });
    res.status(201).json(calendar);
  }),
);

router.patch(
  '/calendars/:id',
  validate(
    z.object({
      name: z.string().min(1).max(80).optional(),
      color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      isVisible: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await ownedCalendar(req.user!.id, req.params.id);
    const calendar = await prisma.calendar.update({ where: { id: req.params.id }, data: req.body });
    broadcast(calendar.workspaceId, 'updated', { calendar });
    res.json(calendar);
  }),
);

router.delete(
  '/calendars/:id',
  asyncHandler(async (req, res) => {
    const calendar = await ownedCalendar(req.user!.id, req.params.id);
    if (calendar.isDefault) throw badRequest("Impossible de supprimer l'agenda par defaut");
    await prisma.calendar.delete({ where: { id: calendar.id } });
    broadcast(calendar.workspaceId, 'deleted', { calendar: { id: calendar.id } });
    res.status(204).end();
  }),
);

// --- Evenements --------------------------------------------------------

const eventInclude = {
  calendar: { select: { id: true, name: true, color: true, ownerId: true } },
  attendees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
} as const;

router.get(
  '/events',
  validate(
    z.object({
      workspaceId: z.string(),
      from: z.coerce.date(),
      to: z.coerce.date(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { workspaceId, from, to } = req.query as unknown as { workspaceId: string; from: Date; to: Date };
    await requireWorkspaceMember(req.user!.id, workspaceId);
    const events = await prisma.calendarEvent.findMany({
      where: {
        calendar: { workspaceId, ownerId: req.user!.id },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      include: eventInclude,
      orderBy: { startsAt: 'asc' },
    });
    res.json(events);
  }),
);

const eventBody = z.object({
  calendarId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  location: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean().default(false),
  attendeeIds: z.array(z.string()).optional(),
});

router.post(
  '/events',
  validate(eventBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof eventBody>;
    if (body.endsAt <= body.startsAt) throw badRequest('La fin doit etre apres le debut');
    const calendar = await ownedCalendar(req.user!.id, body.calendarId);
    const event = await prisma.calendarEvent.create({
      data: {
        calendarId: body.calendarId,
        title: body.title,
        description: body.description,
        location: body.location,
        color: body.color,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        allDay: body.allDay,
        createdById: req.user!.id,
        attendees: body.attendeeIds?.length
          ? { create: body.attendeeIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: eventInclude,
    });
    broadcast(calendar.workspaceId, 'created', event);
    res.status(201).json(event);
  }),
);

router.patch(
  '/events/:id',
  validate(eventBody.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id }, include: { calendar: true } });
    if (!existing) throw notFound('Evenement introuvable');
    if (existing.calendar.ownerId !== req.user!.id) throw forbidden('Action non autorisee');

    const { attendeeIds, calendarId, ...rest } = req.body as z.infer<typeof eventBody>;
    if (calendarId && calendarId !== existing.calendarId) {
      await ownedCalendar(req.user!.id, calendarId);
    }
    const start = rest.startsAt ?? existing.startsAt;
    const end = rest.endsAt ?? existing.endsAt;
    if (end <= start) throw badRequest('La fin doit etre apres le debut');

    const event = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(calendarId ? { calendarId } : {}),
        ...(attendeeIds
          ? {
              attendees: {
                deleteMany: {},
                create: attendeeIds.map((userId) => ({ userId })),
              },
            }
          : {}),
      },
      include: eventInclude,
    });
    broadcast(existing.calendar.workspaceId, 'updated', event);
    res.json(event);
  }),
);

router.delete(
  '/events/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id }, include: { calendar: true } });
    if (!existing) throw notFound('Evenement introuvable');
    if (existing.calendar.ownerId !== req.user!.id) throw forbidden('Action non autorisee');
    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    broadcast(existing.calendar.workspaceId, 'deleted', { id: req.params.id, calendarId: existing.calendarId });
    res.status(204).end();
  }),
);

export default router;
