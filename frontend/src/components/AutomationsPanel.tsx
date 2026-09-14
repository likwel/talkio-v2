import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import { useI18n } from '@/i18n';
import type { Automation, Board, Channel, Project } from '@/lib/types';
import { IconAdd, IconClose, IconEdit, IconForward } from '@/lib/icons';
import Select from '@/components/Select';
import { ACTIVITY_STATUS } from '@/components/meal/mealUi';

const ACTIVITY_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'DELAYED', 'CANCELLED'] as const;

const TRIGGER_IDS: Automation['triggerType'][] = [
  'message.command',
  'message.keyword',
  'message.created',
  'member.joined',
  'channel.created',
  'form.response.created',
  'card.created',
  'card.moved.done',
  'meal.measurement.created',
];
const ACTION_IDS: Automation['actionType'][] = [
  'message.reply',
  'message.post',
  'message.broadcast',
  'card.create',
  'meal.activity.create',
  'meal.activity.sync',
  'http.request',
  'webhook.post',
];

export default function AutomationsPanel() {
  const { current } = useWorkspace();
  const { t } = useI18n();
  const qc = useQueryClient();
  const dialog = useDialog();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const formOpen = creating || !!editing;

  const list = useQuery({
    queryKey: ['automations', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<Automation[]>('/automations', { params: { workspaceId: current!.id } })).data,
  });
  const channels = useQuery({
    queryKey: ['channels', current?.id],
    enabled: !!current && formOpen,
    queryFn: async () => (await api.get<Channel[]>('/channels', { params: { workspaceId: current!.id } })).data,
  });
  const boards = useQuery({
    queryKey: ['boards-full', current?.id],
    enabled: !!current && formOpen,
    queryFn: async () => {
      const bs = (await api.get<Board[]>('/boards', { params: { workspaceId: current!.id } })).data;
      const full = await Promise.all(bs.map((b) => api.get<Board>(`/boards/${b.id}`).then((r) => r.data)));
      return full;
    },
  });
  const mealProjects = useQuery({
    queryKey: ['meal-projects', current?.id],
    enabled: !!current && formOpen,
    queryFn: async () =>
      (await api.get<Project[]>('/meal/projects', { params: { workspaceId: current!.id } })).data,
  });

  async function toggle(a: Automation) {
    await api.patch(`/automations/${a.id}`, { enabled: !a.enabled });
    qc.invalidateQueries({ queryKey: ['automations'] });
  }
  async function remove(a: Automation) {
    const ok = await dialog.confirm({
      title: t('auto.deleteTitle'),
      message: t('auto.deleteMsg', { name: a.name }),
      danger: true,
      confirmLabel: t('common.delete'),
    });
    if (ok) {
      await api.delete(`/automations/${a.id}`);
      qc.invalidateQueries({ queryKey: ['automations'] });
    }
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-md font-bold">{t('auto.title')}</h3>
          <p className="text-sm text-[var(--text-dim)]">{t('auto.subtitle')}</p>
        </div>
        <button
          className="btn-primary shrink-0"
          onClick={() => {
            setEditing(null);
            setCreating((v) => !v);
          }}
        >
          <IconAdd className="h-4 w-4" /> {t('auto.newRule')}
        </button>
      </div>

      {formOpen && (
        <RuleForm
          key={editing?.id ?? 'new'}
          automation={editing}
          channels={channels.data ?? []}
          boards={boards.data ?? []}
          mealProjects={mealProjects.data ?? []}
          onDone={() => {
            closeForm();
            qc.invalidateQueries({ queryKey: ['automations'] });
          }}
          onCancel={closeForm}
        />
      )}

      <ul className="space-y-2">
        {list.data?.map((a) => (
          <li key={a.id} className="rounded-xl border border-[var(--outline)] p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggle(a)}
                className={clsx(
                  'relative h-5 w-9 shrink-0 rounded-full transition',
                  a.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--outline)]',
                )}
                aria-label={t('common.confirm')}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                    a.enabled ? 'left-4' : 'left-0.5',
                  )}
                />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.name}</span>
              <span className="text-2xs text-[var(--text-dim)]">{t('auto.runs', { count: a.runCount })}</span>
              <button
                className="icon-btn-sm"
                onClick={() => {
                  setCreating(false);
                  setEditing(a);
                }}
                title={t('common.edit')}
              >
                <IconEdit className="h-4 w-4" />
              </button>
              <button className="icon-btn-sm text-red-500" onClick={() => remove(a)} title={t('common.delete')}>
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-dim)]">
              <span className="chip">{t(`auto.trigger.${a.triggerType}`)}</span>
              <IconForward className="h-3.5 w-3.5" />
              <span className="chip">{t(`auto.action.${a.actionType}`)}</span>
            </div>
          </li>
        ))}
        {list.data?.length === 0 && !formOpen && (
          <li className="rounded-xl border border-dashed border-[var(--outline)] py-6 text-center text-sm text-[var(--text-dim)]">
            {t('auto.empty')}
          </li>
        )}
      </ul>
    </div>
  );
}

function RuleForm({
  automation,
  channels,
  boards,
  mealProjects,
  onDone,
  onCancel,
}: {
  automation: Automation | null;
  channels: Channel[];
  boards: Board[];
  mealProjects: Project[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { current } = useWorkspace();
  const { t } = useI18n();
  const isEdit = !!automation;

  const [name, setName] = useState(automation?.name ?? '');
  const [triggerType, setTriggerType] = useState<Automation['triggerType']>(
    automation?.triggerType ?? 'message.command',
  );
  const [keyword, setKeyword] = useState(automation?.triggerConfig?.keyword ?? '');
  const [command, setCommand] = useState(automation?.triggerConfig?.command ?? '');
  const [triggerChannelId, setTriggerChannelId] = useState(
    automation?.triggerConfig?.channelId ?? '',
  );
  const [actionType, setActionType] = useState<Automation['actionType']>(
    automation?.actionType ?? 'message.reply',
  );
  const [channelId, setChannelId] = useState(automation?.actionConfig?.channelId ?? '');
  const [channelIds, setChannelIds] = useState<string[]>(
    (automation?.actionConfig?.channelIds ?? '').split(/[,\s]+/).filter(Boolean),
  );
  const [columnId, setColumnId] = useState(automation?.actionConfig?.columnId ?? '');
  const [mealProjectId, setMealProjectId] = useState(automation?.actionConfig?.projectId ?? '');
  const [activityStatus, setActivityStatus] = useState(automation?.actionConfig?.status ?? 'DONE');
  const [webhookUrl, setWebhookUrl] = useState(automation?.actionConfig?.url ?? '');
  const [method, setMethod] = useState(automation?.actionConfig?.method ?? 'POST');
  const [headers, setHeaders] = useState(automation?.actionConfig?.headers ?? '');
  const [template, setTemplate] = useState(
    automation?.actionConfig?.template ?? automation?.actionConfig?.titleTemplate ?? '{{summary}}',
  );
  const [busy, setBusy] = useState(false);

  const postsMessage =
    actionType === 'message.reply' ||
    actionType === 'message.post' ||
    actionType === 'message.broadcast';
  const isHttp = actionType === 'http.request' || actionType === 'webhook.post';
  const isMealAction = actionType === 'meal.activity.create' || actionType === 'meal.activity.sync';

  const columns = useMemo(
    () => boards.flatMap((b) => (b.columns ?? []).map((c) => ({ id: c.id, label: `${b.name} › ${c.name}` }))),
    [boards],
  );

  async function submit() {
    if (!current || !name.trim()) return;
    setBusy(true);
    try {
      const triggerConfig: Record<string, string> = {};
      if (triggerType === 'message.keyword') triggerConfig.keyword = keyword.trim();
      if (triggerType === 'message.command') triggerConfig.command = command.trim().replace(/^\//, '');
      if ((triggerType === 'message.created' || triggerType === 'member.joined') && triggerChannelId)
        triggerConfig.channelId = triggerChannelId;

      let actionConfig: Record<string, string>;
      if (actionType === 'message.post' || actionType === 'message.reply') {
        actionConfig = { template };
        if (actionType === 'message.post') actionConfig.channelId = channelId;
      } else if (actionType === 'message.broadcast') {
        actionConfig = { template, channelIds: channelIds.join(',') };
      } else if (actionType === 'card.create') {
        actionConfig = { columnId, titleTemplate: template };
      } else if (actionType === 'meal.activity.create') {
        actionConfig = { projectId: mealProjectId, titleTemplate: template };
      } else if (actionType === 'meal.activity.sync') {
        actionConfig = { status: activityStatus };
      } else {
        // http.request / webhook.post
        actionConfig = { url: webhookUrl.trim(), method, template };
        if (headers.trim()) actionConfig.headers = headers.trim();
        if (actionType === 'http.request' && template.trim()) actionConfig.bodyTemplate = template;
      }

      const payload = { name: name.trim(), triggerType, triggerConfig, actionType, actionConfig };
      if (isEdit) {
        await api.patch(`/automations/${automation!.id}`, payload);
      } else {
        await api.post('/automations', { workspaceId: current.id, ...payload });
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--outline)] bg-[var(--surface-2)] p-3">
      {isEdit && (
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
          {t('auto.form.editTitle')}
        </div>
      )}
      <input
        className="input"
        placeholder={t('auto.form.namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        {t('auto.form.when')}
        <Select
          className="mt-1"
          value={triggerType}
          onChange={(v) => setTriggerType(v as Automation['triggerType'])}
          options={TRIGGER_IDS.map((id) => ({ value: id, label: t(`auto.trigger.${id}`) }))}
        />
      </label>
      {triggerType === 'message.keyword' && (
        <input
          className="input"
          placeholder={t('auto.form.keywordPlaceholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      )}
      {triggerType === 'message.command' && (
        <label className="block text-xs font-semibold text-[var(--text-dim)]">
          {t('auto.form.command')}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-md font-bold text-[var(--text-dim)]">/</span>
            <input
              className="input"
              placeholder="standup"
              value={command}
              onChange={(e) => setCommand(e.target.value.replace(/\s+/g, ''))}
            />
          </div>
        </label>
      )}
      {(triggerType === 'message.created' || triggerType === 'member.joined') && (
        <label className="block text-xs font-semibold text-[var(--text-dim)]">
          {t('auto.form.filterChannel')}
          <Select
            className="mt-1"
            value={triggerChannelId}
            onChange={setTriggerChannelId}
            placeholder={t('auto.form.anyChannel')}
            options={[
              { value: '', label: t('auto.form.anyChannel') },
              ...channels
                .filter((c) => c.type !== 'DIRECT')
                .map((c) => ({ value: c.id, label: `# ${c.name}` })),
            ]}
          />
        </label>
      )}

      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        {t('auto.form.then')}
        <Select
          className="mt-1"
          value={actionType}
          onChange={(v) => setActionType(v as Automation['actionType'])}
          options={ACTION_IDS.map((id) => ({ value: id, label: t(`auto.action.${id}`) }))}
        />
      </label>

      {actionType === 'message.reply' && (
        <p className="rounded-lg bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-dim)]">
          {t('auto.form.replyHint')}
        </p>
      )}
      {actionType === 'message.post' && (
        <Select
          value={channelId}
          onChange={setChannelId}
          placeholder={t('auto.form.pickChannel')}
          options={channels
            .filter((c) => c.type !== 'DIRECT')
            .map((c) => ({ value: c.id, label: `# ${c.name}` }))}
        />
      )}
      {actionType === 'message.broadcast' && (
        <div>
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">
            {t('auto.form.pickChannels')}
          </span>
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-[var(--outline)] bg-[var(--surface)] p-1">
            {channels
              .filter((c) => c.type !== 'DIRECT')
              .map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={channelIds.includes(c.id)}
                    onChange={(e) =>
                      setChannelIds((ids) =>
                        e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id),
                      )
                    }
                  />
                  # {c.name}
                </label>
              ))}
          </div>
        </div>
      )}
      {actionType === 'card.create' && (
        <Select
          value={columnId}
          onChange={setColumnId}
          placeholder={t('auto.form.pickColumn')}
          options={columns.map((c) => ({ value: c.id, label: c.label }))}
        />
      )}
      {isHttp && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select
              className="w-28 shrink-0"
              value={method}
              onChange={setMethod}
              options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }))}
            />
            <input
              className="input"
              type="url"
              placeholder="https://exemple.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <label className="block text-xs font-semibold text-[var(--text-dim)]">
            {t('auto.form.headers')}
            <textarea
              className="input mt-1 font-mono text-xs"
              rows={2}
              placeholder={'{ "Authorization": "Bearer …" }'}
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
            />
          </label>
        </div>
      )}
      {isMealAction && (
        <div className="space-y-2">
          <p className="rounded-lg bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-dim)]">
            {t('auto.form.cardLinkHint')}
          </p>
          {actionType === 'meal.activity.create' && (
            <>
              <Select
                value={mealProjectId}
                onChange={setMealProjectId}
                placeholder={t('auto.form.pickMealProject')}
                options={mealProjects.map((p) => ({ value: p.id, label: p.name }))}
              />
              <input
                className="input"
                placeholder="{{card.title}}"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </>
          )}
          {actionType === 'meal.activity.sync' && (
            <label className="block text-xs font-semibold text-[var(--text-dim)]">
              {t('auto.form.targetStatus')}
              <Select
                className="mt-1"
                value={activityStatus}
                onChange={setActivityStatus}
                options={ACTIVITY_STATUSES.map((s) => ({ value: s, label: ACTIVITY_STATUS[s].label }))}
              />
            </label>
          )}
        </div>
      )}

      {!isMealAction && (
      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        {postsMessage
          ? t('auto.form.message')
          : actionType === 'card.create'
            ? t('auto.form.cardTitle')
            : t('auto.form.payload')}
        {actionType === 'card.create' ? (
          <input
            className="input mt-1"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
        ) : (
          <textarea
            className="input mt-1"
            rows={postsMessage ? 3 : 2}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
        )}
        <span className="mt-1 block font-normal text-[var(--text-dim)]">
          {t('auto.form.tokens')} <code>{'{{text}}'}</code>, <code>{'{{author}}'}</code>,{' '}
          <code>{'{{args}}'}</code>, <code>{'{{command}}'}</code>, <code>{'{{user}}'}</code>,{' '}
          <code>{'{{channel}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{time}}'}</code>,{' '}
          <code>{'{{summary}}'}</code>, <code>{'{{form.title}}'}</code>,{' '}
          <code>{'{{indicator.name}}'}</code>
        </span>
      </label>
      )}

      <div className="flex justify-end gap-2">
        <button className="btn-text" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={
            busy ||
            !name.trim() ||
            (triggerType === 'message.command' && !command.trim()) ||
            (triggerType === 'message.keyword' && !keyword.trim()) ||
            (actionType === 'message.post' && !channelId) ||
            (actionType === 'message.broadcast' && channelIds.length === 0) ||
            (actionType === 'card.create' && !columnId) ||
            (actionType === 'meal.activity.create' && !mealProjectId) ||
            (isHttp && !/^https?:\/\//i.test(webhookUrl.trim()))
          }
        >
          {busy ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </button>
      </div>
    </div>
  );
}
