import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceAdmin, requireWorkspaceMember } from '../../lib/access';
import { notFound } from '../../lib/http';

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
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: req.user!.id } } },
      include: { _count: { select: { members: true, channels: true, boards: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(workspaces);
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

router.post(
  '/:id/members',
  validate(z.object({ email: z.string().email(), role: z.enum(['ADMIN', 'MEMBER', 'GUEST']).default('MEMBER') })),
  asyncHandler(async (req, res) => {
    await requireWorkspaceAdmin(req.user!.id, req.params.id);
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) throw notFound('Aucun utilisateur avec cet email');
    const member = await prisma.workspaceMember.create({
      data: { workspaceId: req.params.id, userId: user.id, role: req.body.role },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    res.status(201).json(member);
  }),
);

export default router;
