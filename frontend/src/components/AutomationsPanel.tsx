import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import { useI18n } from '@/i18n';
import type { Automation, Board, Channel } from '@/lib/types';
import { IconAdd, IconClose, IconEdit, IconForward } from '@/lib/icons';
import Select from '@/components/Select';

const TRIGGER_IDS: Automation['triggerType'][] = [
  'form.response.created',
  'card.moved.done',
  'card.created',
  'meal.measurement.created',
  'message.keyword',
  'channel.created',
];
const ACTION_IDS: Automation['actionType'][] = ['message.post', 'card.create', 'webhook.post'];

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
  onDone,
  onCancel,
}: {
  automation: Automation | null;
  channels: Channel[];
  boards: Board[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { current } = useWorkspace();
  const { t } = useI18n();
  const isEdit = !!automation;

  const [name, setName] = useState(automation?.name ?? '');
  const [triggerType, setTriggerType] = useState<Automation['triggerType']>(
    automation?.triggerType ?? 'form.response.created',
  );
  const [keyword, setKeyword] = useState(automation?.triggerConfig?.keyword ?? '');
  const [actionType, setActionType] = useState<Automation['actionType']>(
    automation?.actionType ?? 'message.post',
  );
  const [channelId, setChannelId] = useState(automation?.actionConfig?.channelId ?? '');
  const [columnId, setColumnId] = useState(automation?.actionConfig?.columnId ?? '');
  const [webhookUrl, setWebhookUrl] = useState(automation?.actionConfig?.url ?? '');
  const [template, setTemplate] = useState(
    automation?.actionConfig?.template ?? automation?.actionConfig?.titleTemplate ?? '{{summary}}',
  );
  const [busy, setBusy] = useState(false);

  const columns = useMemo(
    () => boards.flatMap((b) => (b.columns ?? []).map((c) => ({ id: c.id, label: `${b.name} › ${c.name}` }))),
    [boards],
  );

  async function submit() {
    if (!current || !name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        triggerType,
        triggerConfig: triggerType === 'message.keyword' ? { keyword: keyword.trim() } : {},
        actionType,
        actionConfig:
          actionType === 'message.post'
            ? { channelId, template }
            : actionType === 'card.create'
              ? { columnId, titleTemplate: template }
              : { url: webhookUrl.trim(), template },
      };
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

      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        {t('auto.form.then')}
        <Select
          className="mt-1"
          value={actionType}
          onChange={(v) => setActionType(v as Automation['actionType'])}
          options={ACTION_IDS.map((id) => ({ value: id, label: t(`auto.action.${id}`) }))}
        />
      </label>

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
      {actionType === 'card.create' && (
        <Select
          value={columnId}
          onChange={setColumnId}
          placeholder={t('auto.form.pickColumn')}
          options={columns.map((c) => ({ value: c.id, label: c.label }))}
        />
      )}
      {actionType === 'webhook.post' && (
        <input
          className="input"
          type="url"
          placeholder="https://exemple.com/webhook"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
      )}

      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        {actionType === 'message.post'
          ? t('auto.form.message')
          : actionType === 'card.create'
            ? t('auto.form.cardTitle')
            : t('auto.form.payload')}
        <input className="input mt-1" value={template} onChange={(e) => setTemplate(e.target.value)} />
        <span className="mt-1 block font-normal text-[var(--text-dim)]">
          {t('auto.form.tokens')} <code>{'{{summary}}'}</code>, <code>{'{{author}}'}</code>,{' '}
          <code>{'{{form.title}}'}</code>, <code>{'{{card.title}}'}</code>,{' '}
          <code>{'{{indicator.name}}'}</code>
        </span>
      </label>

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
            (actionType === 'message.post' && !channelId) ||
            (actionType === 'card.create' && !columnId) ||
            (actionType === 'webhook.post' && !/^https?:\/\//i.test(webhookUrl.trim()))
          }
        >
          {busy ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </button>
      </div>
    </div>
  );
}
