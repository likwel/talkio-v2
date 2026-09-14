import { prisma } from '../../lib/prisma';
import { getIO } from '../../realtime/socket';

export type TriggerType =
  | 'form.response.created'
  | 'card.moved.done'
  | 'card.created'
  | 'meal.measurement.created'
  | 'message.keyword'
  | 'message.command'
  | 'message.created'
  | 'member.joined'
  | 'channel.created';

export type ActionType =
  | 'message.post'
  | 'message.reply'
  | 'message.broadcast'
  | 'card.create'
  | 'meal.activity.create'
  | 'meal.activity.sync'
  | 'webhook.post'
  | 'http.request';

type Ctx = Record<string, unknown>;

/** Remplace les jetons {{a.b}} par les valeurs du contexte. */
function render(tpl: string, ctx: Ctx): string {
  const now = new Date();
  const withDefaults: Ctx = {
    date: now.toLocaleDateString('fr-FR'),
    time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    ...ctx,
  };
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const val = path
      .split('.')
      .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], withDefaults);
    return val === undefined || val === null ? '' : String(val);
  });
}

/** Cree un message "bot" (auteur = createur de la regle) et le diffuse. */
async function postMessage(channelId: string, authorId: string, body: string) {
  const text = body.trim() || '(automatisation)';
  const message = await prisma.message.create({
    data: { channelId, authorId, body: text },
    include: { author: { select: { id: true, fullName: true, avatarUrl: true } }, attachments: true },
  });
  getIO()?.to(`channel:${channelId}`).emit('message:new', message);

  // Notifie les autres membres du salon (bulle de non-lus + son).
  const members = await prisma.channelMember.findMany({
    where: { channelId, userId: { not: authorId } },
    select: { userId: true },
  });
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { workspaceId: true, type: true },
  });
  const io = getIO();
  members.forEach((m) =>
    io?.to(`user:${m.userId}`).emit('message:notify', {
      channelId,
      workspaceId: channel?.workspaceId,
      isDirect: channel?.type === 'DIRECT',
      from: { id: message.author.id, fullName: message.author.fullName },
      preview: text.slice(0, 140),
      createdAt: message.createdAt,
    }),
  );
}

async function runAction(
  automation: {
    id: string;
    actionType: string;
    actionConfig: unknown;
    createdById: string;
    workspaceId: string;
  },
  ctx: Ctx,
) {
  const cfg = (automation.actionConfig ?? {}) as Record<string, string>;
  const tpl = cfg.template || cfg.titleTemplate || '{{summary}}';

  // Publier dans un salon precis.
  if (automation.actionType === 'message.post' && cfg.channelId) {
    await postMessage(cfg.channelId, automation.createdById, render(tpl, ctx));
    return;
  }

  // Repondre dans le salon d'ou vient le declencheur (bot conversationnel).
  if (automation.actionType === 'message.reply') {
    const target = String(ctx.channelId ?? cfg.channelId ?? '');
    if (target) await postMessage(target, automation.createdById, render(tpl, ctx));
    return;
  }

  // Diffuser le meme message dans plusieurs salons.
  if (automation.actionType === 'message.broadcast') {
    const ids = String(cfg.channelIds ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body = render(tpl, ctx);
    for (const id of ids) await postMessage(id, automation.createdById, body);
    return;
  }

  if (automation.actionType === 'card.create' && cfg.columnId) {
    const count = await prisma.card.count({ where: { columnId: cfg.columnId } });
    await prisma.card.create({
      data: {
        columnId: cfg.columnId,
        title:
          render(cfg.titleTemplate || cfg.template || 'Nouvelle tache', ctx).trim().slice(0, 200) ||
          'Tache',
        description: cfg.descriptionTemplate ? render(cfg.descriptionTemplate, ctx) : undefined,
        position: count,
      },
    });
    const board = await prisma.column.findUnique({
      where: { id: cfg.columnId },
      select: { boardId: true },
    });
    if (board) getIO()?.to(`board:${board.boardId}`).emit('board:changed', { boardId: board.boardId });
    return;
  }

  // Lien Projet (Kanban) -> Suivi-evaluation : cree une activite MEAL a partir
  // de la tache qui a declenche la regle, et les lie l'une a l'autre.
  if (automation.actionType === 'meal.activity.create' && cfg.projectId) {
    const cardId = (ctx.card as { id?: string } | undefined)?.id;
    if (!cardId) return;
    const existing = await prisma.activity.findUnique({ where: { cardId } });
    if (existing) return; // deja liee : pas de doublon
    const title = render(cfg.titleTemplate || '{{card.title}}', ctx).trim().slice(0, 200) || 'Activite';
    await prisma.activity.create({
      data: { projectId: cfg.projectId, cardId, title, indicatorId: cfg.indicatorId || undefined },
    });
    return;
  }

  // Lien Projet (Kanban) -> Suivi-evaluation : synchronise le statut de
  // l'activite MEAL liee a la tache qui a declenche la regle.
  if (automation.actionType === 'meal.activity.sync') {
    const cardId = (ctx.card as { id?: string } | undefined)?.id;
    if (!cardId) return;
    const linked = await prisma.activity.findUnique({ where: { cardId } });
    if (!linked) return;
    const status = (cfg.status || 'DONE') as
      | 'PLANNED'
      | 'IN_PROGRESS'
      | 'DONE'
      | 'DELAYED'
      | 'CANCELLED';
    await prisma.activity.update({
      where: { id: linked.id },
      data: { status, ...(status === 'DONE' ? { progress: 100 } : {}) },
    });
    return;
  }

  // Requete HTTP sortante (webhook.post = raccourci POST JSON, http.request = complet).
  if (automation.actionType === 'webhook.post' || automation.actionType === 'http.request') {
    const url = (cfg.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    const method = (cfg.method || 'POST').toUpperCase();
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.headers) {
      try {
        headers = { ...headers, ...JSON.parse(cfg.headers) };
      } catch {
        /* en-tetes invalides : on garde le defaut */
      }
    }
    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : cfg.bodyTemplate
          ? render(cfg.bodyTemplate, ctx)
          : JSON.stringify({
              automationId: automation.id,
              workspaceId: automation.workspaceId,
              summary: render(tpl, ctx),
              context: ctx,
              sentAt: new Date().toISOString(),
            });
    try {
      await fetch(url, { method, headers, body });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[automations] requete HTTP echouee', err);
    }
  }
}

/** Execute toutes les automatisations actives d'un espace pour un declencheur donne. */
export async function runAutomations(
  workspaceId: string,
  trigger: TriggerType,
  ctx: Ctx,
): Promise<void> {
  try {
    const rules = await prisma.automation.findMany({
      where: { workspaceId, enabled: true, triggerType: trigger },
    });
    for (const rule of rules) {
      const tcfg = (rule.triggerConfig ?? {}) as Record<string, string>;

      // Filtre par mot-cle.
      if (trigger === 'message.keyword' && tcfg.keyword) {
        const body = String((ctx.message as Record<string, unknown>)?.body ?? '').toLowerCase();
        if (!body.includes(tcfg.keyword.toLowerCase())) continue;
      }

      // Filtre par commande : le message doit commencer par `/<command>`.
      if (trigger === 'message.command') {
        const want = (tcfg.command || '').replace(/^\//, '').trim().toLowerCase();
        const got = String(ctx.command ?? '').toLowerCase();
        if (want && want !== got) continue;
      }

      // Filtre optionnel par salon (message.created / member.joined).
      if (tcfg.channelId && String(ctx.channelId ?? '') !== tcfg.channelId) continue;

      await runAction(rule, ctx);
      await prisma.automation.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[automations] echec', err);
  }
}
