import type { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { getIO } from '../realtime/socket';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

const actorSelect = { id: true, fullName: true, avatarUrl: true } as const;

/**
 * Cree une notification in-app et la pousse en temps reel sur la room `user:<id>`.
 * On ne notifie jamais l'auteur de sa propre action.
 */
export async function createNotification(input: NotifyInput) {
  if (input.actorId && input.actorId === input.userId) return null;
  try {
    const n = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        actorId: input.actorId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      include: { actor: { select: actorSelect } },
    });
    getIO()?.to(`user:${input.userId}`).emit('notification:new', n);
    return n;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] echec', err);
    return null;
  }
}

export async function createNotifications(inputs: NotifyInput[]) {
  await Promise.all(inputs.map(createNotification));
}
