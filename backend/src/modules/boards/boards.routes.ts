import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { myWorkspaceIds, requireWorkspaceMember } from '../../lib/access';
import { getIO } from '../../realtime/socket';
import { notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';

const router = Router();

const DONE_RE = /termin|fini|done|complet|clotur|closed/i;
const userSel = { id: true, fullName: true, avatarUrl: true } as const;

async function boardWorkspace(boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw notFound('Tableau introuvable');
  return board;
}

function progressFromColumns(columns: { name: string; _count: { cards: number } }[]) {
  const total = columns.reduce((s, c) => s + c._count.cards, 0);
  const done = columns.filter((c) => DONE_RE.test(c.name)).reduce((s, c) => s + c._count.cards, 0);
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

// --- Boards -----------------------------------------------------------------

router.get(
  '/',
  validate(z.object({ workspaceId: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    // Sans workspaceId : agrège les projets de TOUS les espaces de l'utilisateur.
    const where = req.query.workspaceId
      ? { workspaceId: String(req.query.workspaceId) }
      : { workspaceId: { in: await myWorkspaceIds(req.user!.id) } };
    if (req.query.workspaceId) await requireWorkspaceMember(req.user!.id, String(req.query.workspaceId));

    const boards = await prisma.board.findMany({
      where,
      include: {
        lead: { select: userSel },
        workspace: { select: { id: true, name: true, color: true, isPersonal: true } },
        columns: { select: { name: true, _count: { select: { cards: true } } } },
        _count: { select: { members: true, columns: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(
      boards.map(({ columns, ...b }) => ({ ...b, progress: progressFromColumns(columns) })),
    );
  }),
);

const boardBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  leadId: z.string().nullable().optional(),
});

router.post(
  '/',
  validate(boardBody.extend({ workspaceId: z.string(), name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const { workspaceId, ...rest } = req.body;
    const board = await prisma.board.create({
      data: {
        workspaceId,
        ...rest,
        members: { create: { userId: req.user!.id } },
        columns: {
          create: [
            { name: 'A faire', position: 0 },
            { name: 'En cours', position: 1 },
            { name: 'Terminé', position: 2 },
          ],
        },
      },
      include: { columns: true },
    });
    res.status(201).json(board);
  }),
);

router.patch(
  '/:id',
  validate(boardBody),
  asyncHandler(async (req, res) => {
    const board = await boardWorkspace(req.params.id);
    await requireWorkspaceMember(req.user!.id, board.workspaceId);
    const updated = await prisma.board.update({
      where: { id: board.id },
      data: req.body,
      include: { lead: { select: userSel } },
    });
    getIO()?.to(`board:${board.id}`).emit('board:changed', { boardId: board.id });
    res.json(updated);
  }),
);

router.post(
  '/:id/members',
  validate(z.object({ userIds: z.array(z.string()).min(1).max(50) })),
  asyncHandler(async (req, res) => {
    const board = await boardWorkspace(req.params.id);
    await requireWorkspaceMember(req.user!.id, board.workspaceId);
    await Promise.all(req.body.userIds.map((uid: string) => requireWorkspaceMember(uid, board.workspaceId)));
    await prisma.boardMember.createMany({
      data: req.body.userIds.map((userId: string) => ({ boardId: board.id, userId })),
      skipDuplicates: true,
    });
    const members = await prisma.boardMember.findMany({
      where: { boardId: board.id },
      include: { user: { select: userSel } },
    });
    res.status(201).json(members);
  }),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const board = await boardWorkspace(req.params.id);
    await requireWorkspaceMember(req.user!.id, board.workspaceId);
    await prisma.boardMember.deleteMany({ where: { boardId: board.id, userId: req.params.userId } });
    res.status(204).end();
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const board = await boardWorkspace(req.params.id);
    await requireWorkspaceMember(req.user!.id, board.workspaceId);
    const full = await prisma.board.findUnique({
      where: { id: board.id },
      include: {
        lead: { select: userSel },
        members: { include: { user: { select: userSel } } },
        columns: {
          orderBy: { position: 'asc' },
          include: {
            _count: { select: { cards: true } },
            cards: {
              orderBy: { position: 'asc' },
              include: {
                assignees: { include: { user: { select: userSel } } },
                _count: { select: { comments: true } },
              },
            },
          },
        },
      },
    });
    res.json({
      ...full,
      progress: progressFromColumns((full?.columns ?? []).map((c) => ({ name: c.name, _count: c._count }))),
    });
  }),
);

// --- Columns --------------------------------------------------------------

router.post(
  '/:id/columns',
  validate(z.object({ name: z.string().min(1), wipLimit: z.number().int().positive().optional() })),
  asyncHandler(async (req, res) => {
    const board = await boardWorkspace(req.params.id);
    await requireWorkspaceMember(req.user!.id, board.workspaceId);
    const count = await prisma.column.count({ where: { boardId: board.id } });
    const column = await prisma.column.create({
      data: { boardId: board.id, name: req.body.name, position: count, wipLimit: req.body.wipLimit },
    });
    getIO()?.to(`board:${board.id}`).emit('board:changed', { boardId: board.id });
    res.status(201).json(column);
  }),
);

router.patch(
  '/columns/:columnId',
  validate(z.object({ name: z.string().min(1).optional(), position: z.number().int().optional(), wipLimit: z.number().int().nullable().optional() })),
  asyncHandler(async (req, res) => {
    const column = await prisma.column.update({ where: { id: req.params.columnId }, data: req.body });
    getIO()?.to(`board:${column.boardId}`).emit('board:changed', { boardId: column.boardId });
    res.json(column);
  }),
);

router.delete(
  '/columns/:columnId',
  asyncHandler(async (req, res) => {
    const column = await prisma.column.delete({ where: { id: req.params.columnId } });
    getIO()?.to(`board:${column.boardId}`).emit('board:changed', { boardId: column.boardId });
    res.status(204).end();
  }),
);

// --- Cards --------------------------------------------------------------

router.post(
  '/columns/:columnId/cards',
  validate(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      dueDate: z.coerce.date().optional(),
      labels: z.array(z.string()).default([]),
    }),
  ),
  asyncHandler(async (req, res) => {
    const column = await prisma.column.findUnique({ where: { id: req.params.columnId }, include: { board: true } });
    if (!column) throw notFound('Colonne introuvable');
    await requireWorkspaceMember(req.user!.id, column.board.workspaceId);
    const count = await prisma.card.count({ where: { columnId: column.id } });
    const card = await prisma.card.create({
      data: {
        columnId: column.id,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        dueDate: req.body.dueDate,
        labels: req.body.labels,
        position: count,
      },
    });
    getIO()?.to(`board:${column.boardId}`).emit('board:changed', { boardId: column.boardId });
    runAutomations(column.board.workspaceId, 'card.created', {
      card: { title: card.title, id: card.id },
      board: { id: column.boardId },
      summary: `Nouvelle tache « ${card.title} » dans « ${column.name} »`,
    });
    res.status(201).json(card);
  }),
);

router.patch(
  '/cards/:cardId',
  validate(
    z.object({
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      dueDate: z.coerce.date().nullable().optional(),
      labels: z.array(z.string()).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const card = await prisma.card.update({
      where: { id: req.params.cardId },
      data: req.body,
      include: { column: true },
    });
    getIO()?.to(`board:${card.column.boardId}`).emit('board:changed', { boardId: card.column.boardId });
    res.json(card);
  }),
);

/** Deplacement drag & drop: change de colonne + reordonne. */
router.post(
  '/cards/:cardId/move',
  validate(z.object({ toColumnId: z.string(), toPosition: z.number().int().min(0) })),
  asyncHandler(async (req, res) => {
    const { toColumnId, toPosition } = req.body;
    const card = await prisma.card.findUnique({ where: { id: req.params.cardId }, include: { column: { include: { board: true } } } });
    if (!card) throw notFound('Carte introuvable');
    await requireWorkspaceMember(req.user!.id, card.column.board.workspaceId);

    await prisma.$transaction(async (tx) => {
      // retirer de l'ancienne colonne
      await tx.card.updateMany({
        where: { columnId: card.columnId, position: { gt: card.position } },
        data: { position: { decrement: 1 } },
      });
      // faire de la place dans la nouvelle colonne
      await tx.card.updateMany({
        where: { columnId: toColumnId, position: { gte: toPosition } },
        data: { position: { increment: 1 } },
      });
      await tx.card.update({
        where: { id: card.id },
        data: { columnId: toColumnId, position: toPosition },
      });
    });

    getIO()?.to(`board:${card.column.boardId}`).emit('board:changed', { boardId: card.column.boardId });

    // Automatisation : carte deplacee vers une colonne "termine"
    const toColumn = await prisma.column.findUnique({ where: { id: toColumnId } });
    const nowDone = !!toColumn && DONE_RE.test(toColumn.name);
    if (nowDone) {
      runAutomations(card.column.board.workspaceId, 'card.moved.done', {
        card: { title: card.title, id: card.id },
        board: { name: card.column.board.name, id: card.column.boardId },
        column: toColumn!.name,
        summary: `Tâche terminée : ${card.title} (${card.column.board.name})`,
      });
    }

    // Lien Projet/Kanban <-> Suivi-evaluation : la carte pilote le statut de
    // l'activite MEAL a laquelle elle est liee (si elle l'est).
    const linkedActivity = await prisma.activity.findUnique({ where: { cardId: card.id } });
    if (linkedActivity) {
      if (nowDone && linkedActivity.status !== 'DONE') {
        await prisma.activity.update({ where: { id: linkedActivity.id }, data: { status: 'DONE', progress: 100 } });
      } else if (!nowDone && linkedActivity.status === 'DONE') {
        await prisma.activity.update({ where: { id: linkedActivity.id }, data: { status: 'IN_PROGRESS' } });
      }
    }

    res.json({ ok: true });
  }),
);

router.post(
  '/cards/:cardId/assignees',
  validate(z.object({ userId: z.string() })),
  asyncHandler(async (req, res) => {
    const assignee = await prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId: req.params.cardId, userId: req.body.userId } },
      update: {},
      create: { cardId: req.params.cardId, userId: req.body.userId },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.status(201).json(assignee);
  }),
);

router.delete(
  '/cards/:cardId/assignees/:userId',
  asyncHandler(async (req, res) => {
    await prisma.cardAssignee.deleteMany({ where: { cardId: req.params.cardId, userId: req.params.userId } });
    res.status(204).end();
  }),
);

router.delete(
  '/cards/:cardId',
  asyncHandler(async (req, res) => {
    const card = await prisma.card.delete({ where: { id: req.params.cardId }, include: { column: true } });
    getIO()?.to(`board:${card.column.boardId}`).emit('board:changed', { boardId: card.column.boardId });
    res.status(204).end();
  }),
);

router.get(
  '/cards/:cardId/comments',
  asyncHandler(async (req, res) => {
    const comments = await prisma.comment.findMany({
      where: { cardId: req.params.cardId },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  }),
);

router.post(
  '/cards/:cardId/comments',
  validate(z.object({ body: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const comment = await prisma.comment.create({
      data: { cardId: req.params.cardId, authorId: req.user!.id, body: req.body.body },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.status(201).json(comment);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const board = await boardWorkspace(req.params.id);
    await requireWorkspaceMember(req.user!.id, board.workspaceId);
    await prisma.board.delete({ where: { id: board.id } });
    res.status(204).end();
  }),
);

export default router;
