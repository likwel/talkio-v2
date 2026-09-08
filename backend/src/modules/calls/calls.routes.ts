import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { getIO } from '../../realtime/socket';
import { notFound } from '../../lib/http';

const router = Router();

const callAuthor = { id: true, fullName: true, avatarUrl: true, presenceStatus: true } as const;

/** Previent les clients abonnes a l'espace qu'un appel a change d'etat. */
function broadcastActiveCalls(workspaceId: string) {
  getIO()?.to(`calls:${workspaceId}`).emit('calls:active-changed', { workspaceId });
}

/** Appels en cours (RINGING/ONGOING) d'un espace, par canal. */
router.get(
  '/active',
  validate(z.object({ workspaceId: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(req.user!.id, workspaceId);
    const calls = await prisma.call.findMany({
      where: { workspaceId, status: { in: ['RINGING', 'ONGOING'] }, channelId: { not: null } },
      select: {
        id: true,
        roomId: true,
        type: true,
        status: true,
        channelId: true,
        _count: { select: { participants: { where: { leftAt: null } } } },
        participants: {
          where: { leftAt: null },
          select: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    });
    res.json(
      calls.map((c) => ({
        callId: c.id,
        roomId: c.roomId,
        type: c.type,
        status: c.status,
        channelId: c.channelId,
        participants: c._count.participants,
        participantsPreview: c.participants.map((p) => p.user),
      })),
    );
  }),
);

router.post(
  '/',
  validate(
    z.object({
      workspaceId: z.string(),
      channelId: z.string().optional(),
      type: z.enum(['AUDIO', 'VIDEO']).default('VIDEO'),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const call = await prisma.call.create({
      data: {
        workspaceId: req.body.workspaceId,
        channelId: req.body.channelId,
        type: req.body.type,
        roomId: randomUUID(),
        status: 'RINGING',
        createdById: req.user!.id,
        participants: { create: { userId: req.user!.id } },
      },
      include: { createdBy: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    if (req.body.channelId) {
      const io = getIO();
      const channel = await prisma.channel.findUnique({
        where: { id: req.body.channelId },
        include: { members: { select: { userId: true } } },
      });

      // Sonnerie : notification globale a chaque membre du canal (sauf l'appelant).
      const ring = {
        callId: call.id,
        roomId: call.roomId,
        type: call.type,
        channelId: req.body.channelId,
        channelName: channel?.name ?? null,
        from: call.createdBy,
      };
      io?.to(`channel:${req.body.channelId}`).emit('call:incoming', ring);
      (channel?.members ?? [])
        .filter((m) => m.userId !== req.user!.id)
        .forEach((m) => io?.to(`user:${m.userId}`).emit('call:ring', ring));

      // Message d'historique d'appel dans le fil.
      const message = await prisma.message.create({
        data: {
          channelId: req.body.channelId,
          authorId: req.user!.id,
          body: '',
          kind: 'CALL',
          callId: call.id,
        },
        include: {
          author: { select: callAuthor },
          attachments: true,
          parent: { select: { id: true, body: true, author: { select: { id: true, fullName: true } } } },
          call: { select: { roomId: true, type: true, status: true, startedAt: true, endedAt: true } },
        },
      });
      io?.to(`channel:${req.body.channelId}`).emit('message:new', message);
    }
    broadcastActiveCalls(call.workspaceId);
    res.status(201).json(call);
  }),
);

/** Refuser un appel : previent l'appelant ; termine l'appel si personne d'autre n'a rejoint. */
router.post(
  '/:roomId/decline',
  asyncHandler(async (req, res) => {
    const call = await prisma.call.findUnique({
      where: { roomId: req.params.roomId },
      include: { channel: { select: { type: true } } },
    });
    if (!call) throw notFound('Appel introuvable');
    await requireWorkspaceMember(req.user!.id, call.workspaceId);
    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true } });

    const io = getIO();
    const payload = { roomId: call.roomId, callId: call.id, by: me?.fullName ?? 'Quelqu’un' };
    io?.to(`user:${call.createdById}`).emit('call:declined', payload);
    if (call.channelId) io?.to(`channel:${call.channelId}`).emit('call:declined', payload);

    const joined = await prisma.callParticipant.count({ where: { callId: call.id, leftAt: null } });
    if (call.status === 'RINGING' && joined <= 1) {
      await prisma.call.update({ where: { id: call.id }, data: { status: 'MISSED', endedAt: new Date() } });
      broadcastActiveCalls(call.workspaceId);
    }
    res.status(204).end();
  }),
);

router.get(
  '/:roomId',
  asyncHandler(async (req, res) => {
    const call = await prisma.call.findUnique({
      where: { roomId: req.params.roomId },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    if (!call) throw notFound('Appel introuvable');
    await requireWorkspaceMember(req.user!.id, call.workspaceId);
    res.json(call);
  }),
);

router.post(
  '/:roomId/join',
  asyncHandler(async (req, res) => {
    const call = await prisma.call.findUnique({ where: { roomId: req.params.roomId } });
    if (!call) throw notFound('Appel introuvable');
    await requireWorkspaceMember(req.user!.id, call.workspaceId);
    await prisma.callParticipant.upsert({
      where: { callId_userId: { callId: call.id, userId: req.user!.id } },
      update: { leftAt: null, joinedAt: new Date() },
      create: { callId: call.id, userId: req.user!.id },
    });
    if (call.status === 'RINGING') {
      await prisma.call.update({ where: { id: call.id }, data: { status: 'ONGOING' } });
    }
    broadcastActiveCalls(call.workspaceId);
    res.json({ roomId: call.roomId });
  }),
);

router.post(
  '/:roomId/leave',
  asyncHandler(async (req, res) => {
    const call = await prisma.call.findUnique({ where: { roomId: req.params.roomId } });
    if (!call) throw notFound('Appel introuvable');
    await prisma.callParticipant.updateMany({
      where: { callId: call.id, userId: req.user!.id, leftAt: null },
      data: { leftAt: new Date() },
    });
    const remaining = await prisma.callParticipant.count({ where: { callId: call.id, leftAt: null } });
    if (remaining === 0) {
      await prisma.call.update({ where: { id: call.id }, data: { status: 'ENDED', endedAt: new Date() } });
    }
    broadcastActiveCalls(call.workspaceId);
    res.status(204).end();
  }),
);

export default router;
