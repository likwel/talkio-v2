import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { getIO } from '../../realtime/socket';
import { notFound } from '../../lib/http';

const router = Router();

async function boardWorkspace(boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw notFound('Tableau introuvable');
  return board;
}

// --- Boards -----------------------------------------------------------------

router.get(
  '/',
  validate(z.object({ workspaceId: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(req.user!.id, workspaceId);
    const boards = await prisma.board.findMany({
      where: { workspaceId },
      include: { _count: { select: { columns: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(boards);
  }),
);

router.post(
  '/',
  validate(
    z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const board = await prisma.board.create({
      data: {
        workspaceId: req.body.workspaceId,
        name: req.body.name,
        description: req.body.description,
        columns: {
          create: [
            { name: 'A faire', position: 0 },
            { name: 'En cours', position: 1 },
            { name: 'Termine', position: 2 },
          ],
        },
      },
      include: { columns: true },
    });
    res.status(201).json(board);
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
        columns: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
                _count: { select: { comments: true } },
              },
            },
          },
        },
      },
    });
    res.json(full);
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
