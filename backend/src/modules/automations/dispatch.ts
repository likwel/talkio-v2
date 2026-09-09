import { prisma } from '../../lib/prisma';
import { getIO } from '../../realtime/socket';

export type TriggerType =
  | 'form.response.created'
  | 'card.moved.done'
  | 'card.created'
  | 'meal.measurement.created'
  | 'message.keyword'
  | 'channel.created';

type Ctx = Record<string, unknown>;

/** Remplace les jetons {{a.b}} par les valeurs du contexte. */
function render(tpl: string, ctx: Ctx): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const val = path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], ctx);
    return val === undefined || val === null ? '' : String(val);
  });
}

async function runAction(
  automation: { id: string; actionType: string; actionConfig: unknown; createdById: string; workspaceId: string },
  ctx: Ctx,
) {
  const cfg = (automation.actionConfig ?? {}) as Record<string, string>;

  if (automation.actionType === 'message.post' && cfg.channelId) {
    const body = render(cfg.template || '{{summary}}', ctx).trim() || '(automatisation)';
    const message = await prisma.message.create({
      data: { channelId: cfg.channelId, authorId: automation.createdById, body },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } }, attachments: true },
    });
    getIO()?.to(`channel:${cfg.channelId}`).emit('message:new', message);
    return;
  }

  if (automation.actionType === 'card.create' && cfg.columnId) {
    const count = await prisma.card.count({ where: { columnId: cfg.columnId } });
    await prisma.card.create({
      data: {
        columnId: cfg.columnId,
        title: render(cfg.titleTemplate || cfg.template || 'Nouvelle tache', ctx).trim().slice(0, 200) || 'Tache',
        description: cfg.descriptionTemplate ? render(cfg.descriptionTemplate, ctx) : undefined,
        position: count,
      },
    });
    const board = await prisma.column.findUnique({ where: { id: cfg.columnId }, select: { boardId: true } });
    if (board) getIO()?.to(`board:${board.boardId}`).emit('board:changed', { boardId: board.boardId });
    return;
  }

  // Envoi d'un webhook JSON (integrations externes).
  if (automation.actionType === 'webhook.post' && cfg.url && /^https?:\/\//i.test(cfg.url)) {
    try {
      await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automationId: automation.id,
          workspaceId: automation.workspaceId,
          summary: render(cfg.template || '{{summary}}', ctx),
          context: ctx,
          sentAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[automations] webhook echoue', err);
    }
  }
}

/** Execute toutes les automatisations actives d'un espace pour un declencheur donne. */
export async function runAutomations(workspaceId: string, trigger: TriggerType, ctx: Ctx): Promise<void> {
  try {
    const rules = await prisma.automation.findMany({
      where: { workspaceId, enabled: true, triggerType: trigger },
    });
    for (const rule of rules) {
      const tcfg = (rule.triggerConfig ?? {}) as Record<string, string>;
      // Filtre optionnel par mot-cle pour message.keyword
      if (trigger === 'message.keyword' && tcfg.keyword) {
        const body = String((ctx.message as Record<string, unknown>)?.body ?? '').toLowerCase();
        if (!body.includes(tcfg.keyword.toLowerCase())) continue;
      }
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
