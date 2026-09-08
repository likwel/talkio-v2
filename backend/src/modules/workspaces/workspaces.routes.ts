import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceAdmin, requireWorkspaceMember } from '../../lib/access';
import { badRequest, notFound } from '../../lib/http';

const router = Router();

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: me } } },
      include: { _count: { select: { members: true, channels: true, boards: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Messages non lus par espace (somme sur les salons ou l'utilisateur est membre).
    const memberships = await prisma.channelMember.findMany({
      where: { userId: me, channel: { workspaceId: { in: workspaces.map((w) => w.id) } } },
      select: { channelId: true, lastReadAt: true, channel: { select: { workspaceId: true } } },
    });
    const perChannel = await Promise.all(
      memberships.map(async (m) => ({
        workspaceId: m.channel.workspaceId,
        count: await prisma.message.count({
          where: {
            channelId: m.channelId,
            parentId: null,
            authorId: { not: me },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        }),
      })),
    );
    const unreadByWs = new Map<string, number>();
    for (const { workspaceId, count } of perChannel) {
      unreadByWs.set(workspaceId, (unreadByWs.get(workspaceId) ?? 0) + count);
    }

    res.json(workspaces.map((w) => ({ ...w, unreadCount: unreadByWs.get(w.id) ?? 0 })));
  }),
);

router.post(
  '/',
  validate(z.object({ name: z.string().min(2) })),
  asyncHandler(async (req, res) => {
    const base = slugify(req.body.name) || 'espace';
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: req.body.name,
        slug,
        members: { create: { userId: req.user!.id, role: 'OWNER' } },
        channels: {
          create: { name: 'general', type: 'PUBLIC', topic: 'Canal general' },
        },
      },
      include: { channels: true },
    });
    res.status(201).json(workspace);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.params.id);
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } } },
        channels: true,
      },
    });
    if (!workspace) throw notFound();
    res.json(workspace);
  }),
);

router.patch(
  '/:id',
  validate(
    z.object({
      name: z.string().min(2).max(80).optional(),
      color: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .nullable()
        .optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceAdmin(req.user!.id, req.params.id);
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.color !== undefined ? { color: req.body.color } : {}),
      },
    });
    res.json(workspace);
  }),
);

router.post(
  '/:id/members',
  validate(z.object({ email: z.string().email(), role: z.enum(['ADMIN', 'MEMBER', 'GUEST']).default('MEMBER') })),
  asyncHandler(async (req, res) => {
    await requireWorkspaceAdmin(req.user!.id, req.params.id);
    const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
    if (!user) throw notFound('Aucun utilisateur avec cet email');
    const member = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: user.id } },
      update: { role: req.body.role },
      create: { workspaceId: req.params.id, userId: user.id, role: req.body.role },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    });
    res.status(201).json(member);
  }),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    await requireWorkspaceAdmin(req.user!.id, req.params.id);
    if (req.params.userId === req.user!.id) throw badRequest('Vous ne pouvez pas vous retirer vous-meme');
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: req.params.id, userId: req.params.userId },
    });
    res.status(204).end();
  }),
);

export default router;
