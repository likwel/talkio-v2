import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireChannelAccess } from '../channels/channels.routes';
import { getIO } from '../../realtime/socket';
import { forbidden, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';

const router = Router();

const authorSelect = { id: true, fullName: true, avatarUrl: true, presenceStatus: true } as const;
const parentSelect = {
  select: {
    id: true,
    body: true,
    encrypted: true,
    iv: true,
    keyVersion: true,
    author: { select: { id: true, fullName: true } },
  },
} as const;
const messageInclude = {
  author: { select: authorSelect },
  attachments: true,
  parent: parentSelect,
  call: { select: { roomId: true, type: true, status: true, startedAt: true, endedAt: true } },
  form: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      publicCode: true,
      _count: { select: { fields: true, responses: true } },
    },
  },
} as const;

router.get(
  '/',
  validate(
    z.object({
      channelId: z.string(),
      cursor: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(30),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { channelId, cursor, limit } = req.query as unknown as {
      channelId: string;
      cursor?: string;
      limit: number;
    };
    await requireChannelAccess(req.user!.id, channelId);

    const messages = await prisma.message.findMany({
      where: { channelId },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    res.json({
      items: page.reverse(),
      nextCursor: hasMore ? page[0]?.id : null,
    });
  }),
);

const attachmentSchema = z.object({
  url: z.string().max(500),
  name: z.string().max(200),
  mimeType: z.string().max(150),
  size: z.number().int().nonnegative().max(2 * 1024 * 1024),
});

router.post(
  '/',
  validate(
    z
      .object({
        channelId: z.string(),
        body: z.string().max(12000).optional().default(''),
        parentId: z.string().optional(),
        forwardedFrom: z.string().max(120).optional(),
        formId: z.string().optional(),
        attachments: z.array(attachmentSchema).max(10).optional(),
        // Chiffrement de bout en bout : `body` est alors le texte chiffré (base64).
        encrypted: z.boolean().optional(),
        iv: z.string().max(400).optional(),
        keyVersion: z.number().int().optional(),
        mentionUserIds: z.array(z.string()).max(50).optional(),
      })
      .refine(
        (v) => v.body.trim().length > 0 || (v.attachments?.length ?? 0) > 0 || !!v.formId,
        { message: 'Message vide' },
      ),
  ),
  asyncHandler(async (req, res) => {
    const channel = await requireChannelAccess(req.user!.id, req.body.channelId);

    const membership = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: req.body.channelId, userId: req.user!.id } },
      select: { canWrite: true },
    });
    if (membership && membership.canWrite === false) {
      throw forbidden("Ecriture non autorisee dans ce salon");
    }

    const encrypted = !!req.body.encrypted;
    if (channel.e2ee && !encrypted) throw forbidden('Cette conversation est chiffrée de bout en bout');
    if (!channel.e2ee && encrypted) throw forbidden("Cette conversation n'est pas chiffrée");
    if (encrypted && (!req.body.iv || !req.body.keyVersion)) throw forbidden('Enveloppe de chiffrement incomplète');
    if (encrypted && req.body.attachments?.length) throw forbidden('Pièces jointes non prises en charge en chiffré');

    // Partage d'un formulaire : il doit appartenir a un espace de l'utilisateur.
    let sharedForm: { id: string; title: string } | null = null;
    if (req.body.formId) {
      if (encrypted) throw forbidden('Partage de formulaire indisponible en conversation chiffrée');
      const form = await prisma.form.findUnique({
        where: { id: req.body.formId },
        select: { id: true, title: true, workspaceId: true },
      });
      if (!form) throw notFound('Formulaire introuvable');
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: form.workspaceId, userId: req.user!.id },
        select: { id: true },
      });
      if (!member) throw forbidden('Formulaire non accessible');
      sharedForm = { id: form.id, title: form.title };
    }

    const message = await prisma.message.create({
      data: {
        channelId: req.body.channelId,
        authorId: req.user!.id,
        body: sharedForm ? req.body.body || sharedForm.title : req.body.body,
        kind: sharedForm ? 'FORM' : 'TEXT',
        formId: sharedForm?.id ?? null,
        parentId: req.body.parentId,
        forwardedFrom: req.body.forwardedFrom ?? null,
        encrypted,
        iv: encrypted ? req.body.iv : null,
        keyVersion: encrypted ? req.body.keyVersion : null,
        ...(req.body.attachments?.length
          ? { attachments: { create: req.body.attachments } }
          : {}),
      },
      include: messageInclude,
    });

    const io = getIO();
    io?.to(`channel:${req.body.channelId}`).emit('message:new', message);

    // --- Destinataires des notifications (room `user:<id>`) ---
    const authorId = req.user!.id;
    const recipients = new Set<string>();

    const memberRows = await prisma.channelMember.findMany({
      where: { channelId: req.body.channelId, userId: { not: authorId } },
      select: { userId: true },
    });
    memberRows.forEach((m) => recipients.add(m.userId));

    // Mentions. En clair : on résout `@Prenom` sur les membres de l'espace.
    // En chiffré : le serveur ne lit rien, le client fournit les `mentionUserIds`.
    const mentioned = new Set<string>();
    if (encrypted) {
      for (const uid of req.body.mentionUserIds ?? []) {
        if (uid !== authorId) {
          mentioned.add(uid);
          recipients.add(uid);
        }
      }
    } else {
      const tokens = new Set(
        [...message.body.matchAll(/(?:^|\s)@([\p{L}][\p{L}\-']*)/gu)].map((m) => m[1].toLowerCase()),
      );
      if (tokens.size > 0) {
        const wsMembers = await prisma.workspaceMember.findMany({
          where: { workspaceId: channel.workspaceId, userId: { not: authorId } },
          select: { userId: true, user: { select: { fullName: true } } },
        });
        for (const m of wsMembers) {
          const firstName = m.user.fullName.split(/\s+/)[0]?.toLowerCase() ?? '';
          if (firstName && tokens.has(firstName)) {
            mentioned.add(m.userId);
            recipients.add(m.userId);
          }
        }
      }
    }

    const notifyBase = {
      channelId: req.body.channelId,
      workspaceId: channel.workspaceId,
      isDirect: channel.type === 'DIRECT',
      from: { id: message.author.id, fullName: message.author.fullName },
      preview: encrypted ? '🔒 Message chiffré' : message.body.slice(0, 140) || 'Piece jointe',
      createdAt: message.createdAt,
    };
    recipients.forEach((uid) =>
      io?.to(`user:${uid}`).emit('message:notify', { ...notifyBase, mention: mentioned.has(uid) }),
    );

    if (!message.parentId && !encrypted) {
      const cmdMatch = message.body.match(/^\/([a-z0-9_-]+)\s*(.*)$/is);
      const autoCtx = {
        message: { body: message.body, id: message.id },
        channelId: message.channelId,
        channel: channel.name ?? '',
        author: message.author.fullName,
        authorId: message.author.id,
        text: message.body,
        command: cmdMatch?.[1]?.toLowerCase() ?? '',
        args: cmdMatch?.[2]?.trim() ?? '',
        summary: `Message de ${message.author.fullName} : ${message.body}`,
      };
      runAutomations(channel.workspaceId, 'message.keyword', autoCtx);
      runAutomations(channel.workspaceId, 'message.created', autoCtx);
      if (cmdMatch) runAutomations(channel.workspaceId, 'message.command', autoCtx);
    }
    res.status(201).json(message);
  }),
);

router.patch(
  '/:id',
  validate(
    z.object({
      body: z.string().min(1).max(12000),
      encrypted: z.boolean().optional(),
      iv: z.string().max(400).optional(),
      keyVersion: z.number().int().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Message introuvable');
    if (existing.authorId !== req.user!.id) throw forbidden('Vous ne pouvez modifier que vos messages');
    if (existing.encrypted && !req.body.encrypted) throw forbidden('Ce message est chiffré');

    const message = await prisma.message.update({
      where: { id: req.params.id },
      data: {
        body: req.body.body,
        editedAt: new Date(),
        ...(req.body.encrypted ? { iv: req.body.iv, keyVersion: req.body.keyVersion } : {}),
      },
      include: messageInclude,
    });
    getIO()?.to(`channel:${existing.channelId}`).emit('message:updated', message);
    res.json(message);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Message introuvable');
    if (existing.authorId !== req.user!.id) throw forbidden('Vous ne pouvez supprimer que vos messages');
    await prisma.message.delete({ where: { id: req.params.id } });
    getIO()?.to(`channel:${existing.channelId}`).emit('message:deleted', { id: req.params.id });
    res.status(204).end();
  }),
);

export default router;
