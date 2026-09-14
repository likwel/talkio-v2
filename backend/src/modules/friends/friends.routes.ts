import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { getIO } from '../../realtime/socket';
import { createNotification } from '../../lib/notify';

const router = Router();

const publicUser = { id: true, fullName: true, email: true, avatarUrl: true } as const;

function notify(userIds: string[]) {
  const io = getIO();
  userIds.forEach((id) => io?.to(`user:${id}`).emit('friend:changed'));
}

/** Liste des amis (relations acceptees). */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const rows = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: me }, { addresseeId: me }] },
      include: { requester: { select: publicUser }, addressee: { select: publicUser } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(rows.map((f) => (f.requesterId === me ? f.addressee : f.requester)));
  }),
);

/** Demandes en attente (recues / envoyees). */
router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const [incoming, outgoing] = await Promise.all([
      prisma.friendship.findMany({
        where: { status: 'PENDING', addresseeId: me },
        include: { requester: { select: publicUser } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendship.findMany({
        where: { status: 'PENDING', requesterId: me },
        include: { addressee: { select: publicUser } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({
      incoming: incoming.map((f) => ({ id: f.id, user: f.requester, createdAt: f.createdAt })),
      outgoing: outgoing.map((f) => ({ id: f.id, user: f.addressee, createdAt: f.createdAt })),
    });
  }),
);

/**
 * Recherche d'utilisateurs pour l'invitation (par nom OU par email exact),
 * en excluant soi-meme, les amis et les demandes en cours.
 */
router.get(
  '/search',
  validate(z.object({ q: z.string().trim().min(1).max(80) }), 'query'),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const q = String(req.query.q).trim();

    const related = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: me }, { addresseeId: me }] },
      select: { requesterId: true, addresseeId: true, status: true },
    });
    const excluded = new Set<string>([me]);
    for (const r of related) {
      excluded.add(r.requesterId === me ? r.addresseeId : r.requesterId);
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { notIn: [...excluded] },
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: q.toLowerCase() },
        ],
      },
      select: publicUser,
      take: 8,
      orderBy: { fullName: 'asc' },
    });
    res.json(users);
  }),
);

/** Envoyer une demande d'ami : par email OU par utilisateur choisi (nom). */
router.post(
  '/request',
  validate(
    z
      .object({ email: z.string().email().optional(), userId: z.string().optional() })
      .refine((v) => !!v.email || !!v.userId, { message: 'email ou userId requis' }),
  ),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const target = req.body.userId
      ? await prisma.user.findUnique({ where: { id: req.body.userId } })
      : await prisma.user.findUnique({ where: { email: req.body.email!.toLowerCase() } });

    if (!target) {
      // Aucun compte : dans une vraie prod on enverrait un e-mail d'invitation.
      if (req.body.email) {
        // eslint-disable-next-line no-console
        console.log(`[friend-invite] ${req.body.email} invite par ${me} (aucun compte existant)`);
        return res.status(202).json({ invited: true, email: req.body.email });
      }
      throw notFound('Utilisateur introuvable');
    }
    if (target.id === me) throw badRequest('Vous ne pouvez pas vous ajouter vous-meme');

    const meUser = await prisma.user.findUnique({ where: { id: me }, select: { fullName: true } });
    const meName = meUser?.fullName ?? 'Quelqu’un';

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: me, addresseeId: target.id },
          { requesterId: target.id, addresseeId: me },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') throw badRequest('Vous etes deja amis');
      if (existing.status === 'BLOCKED') throw badRequest('Action impossible');
      // Une demande inverse existe deja -> on l'accepte
      if (existing.addresseeId === me) {
        const updated = await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
        notify([me, target.id]);
        await createNotification({
          userId: target.id,
          actorId: me,
          type: 'FRIEND_ACCEPTED',
          title: `${meName} et vous etes maintenant amis`,
        });
        return res.json({ id: updated.id, status: updated.status });
      }
      throw badRequest('Demande deja envoyee');
    }

    const created = await prisma.friendship.create({
      data: { requesterId: me, addresseeId: target.id, status: 'PENDING' },
    });
    notify([me, target.id]);
    await createNotification({
      userId: target.id,
      actorId: me,
      type: 'FRIEND_REQUEST',
      title: `${meName} vous a envoye une demande d'ami`,
      entityType: 'friendship',
      entityId: created.id,
    });
    return res.status(201).json({ id: created.id, status: created.status });
  }),
);

/** Accepter une demande recue. */
router.post(
  '/:id/accept',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const f = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!f || f.addresseeId !== me || f.status !== 'PENDING') throw notFound('Demande introuvable');
    const updated = await prisma.friendship.update({ where: { id: f.id }, data: { status: 'ACCEPTED' } });
    notify([f.requesterId, f.addresseeId]);
    const meUser = await prisma.user.findUnique({ where: { id: me }, select: { fullName: true } });
    await createNotification({
      userId: f.requesterId,
      actorId: me,
      type: 'FRIEND_ACCEPTED',
      title: `${meUser?.fullName ?? 'Votre demande'} a accepte votre demande d'ami`,
    });
    res.json({ id: updated.id, status: updated.status });
  }),
);

/** Refuser une demande recue. */
router.post(
  '/:id/decline',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const f = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!f || f.addresseeId !== me) throw notFound('Demande introuvable');
    await prisma.friendship.delete({ where: { id: f.id } });
    notify([f.requesterId, f.addresseeId]);
    res.status(204).end();
  }),
);

/** Retirer un ami (ou annuler une demande envoyee). */
router.delete(
  '/:userId',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const other = req.params.userId;
    const { count } = await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: me, addresseeId: other },
          { requesterId: other, addresseeId: me },
        ],
      },
    });
    if (count === 0) throw notFound('Relation introuvable');
    notify([me, other]);
    res.status(204).end();
  }),
);

export default router;
