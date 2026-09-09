import { randomInt } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { myWorkspaceIds, requireWorkspaceMember } from '../../lib/access';
import { badRequest, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';
import { assertRequired, buildAnswerRows, previewAnswers } from './logic';

const router = Router();

export const FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'INTEGER',
  'DECIMAL',
  'DATE',
  'DATETIME',
  'TIME',
  'EMAIL',
  'PHONE',
  'URL',
  'RATING',
  'RANGE',
  'SELECT',
  'MULTISELECT',
  'BOOLEAN',
  'ACKNOWLEDGE',
  'NOTE',
  'BARCODE',
  'SIGNATURE',
  'GEOPOINT',
  'PHOTO',
] as const;

const RELEVANT_OPS = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'empty', 'notempty'] as const;

// Code court, sans caracteres ambigus (0/O/1/l/i).
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function genCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}
export async function uniquePublicCode() {
  for (let i = 0; i < 12; i++) {
    const c = genCode();
    const exists = await prisma.form.findUnique({ where: { publicCode: c }, select: { id: true } });
    if (!exists) return c;
  }
  return genCode(6);
}

const keyRe = /^[a-z0-9_]+$/i;

const sectionSchema = z.object({
  key: z.string().min(1).regex(keyRe, 'Cle: lettres, chiffres, underscore'),
  title: z.string().min(1),
  description: z.string().max(2000).optional(),
  position: z.number().int().default(0),
  repeatable: z.boolean().default(false),
  repeatLabel: z.string().max(120).optional(),
  minRepeat: z.number().int().min(0).nullable().optional(),
  maxRepeat: z.number().int().min(1).nullable().optional(),
  relevantField: z.string().max(120).nullable().optional(),
  relevantOp: z.enum(RELEVANT_OPS).nullable().optional(),
  relevantValue: z.string().max(500).nullable().optional(),
});

const fieldSchema = z.object({
  label: z.string().min(1),
  key: z.string().min(1).regex(keyRe, 'Cle: lettres, chiffres, underscore'),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  position: z.number().int().default(0),
  options: z.array(z.string()).default([]),
  helpText: z.string().optional(),
  placeholder: z.string().max(200).optional(),
  defaultValue: z.string().max(500).optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  pattern: z.string().max(300).optional(),
  // v2 : rattachement a une section + logique + calcul
  sectionKey: z.string().max(120).nullable().optional(),
  relevantField: z.string().max(120).nullable().optional(),
  relevantOp: z.enum(RELEVANT_OPS).nullable().optional(),
  relevantValue: z.string().max(500).nullable().optional(),
  constraintExpr: z.string().max(500).nullable().optional(),
  constraintMessage: z.string().max(300).nullable().optional(),
  calculation: z.string().max(500).nullable().optional(),
  appearance: z.string().max(60).nullable().optional(),
  rangeStep: z.number().positive().nullable().optional(),
});

type SectionInput = z.infer<typeof sectionSchema>;
type FieldInput = z.infer<typeof fieldSchema>;

const formInclude = {
  sections: { orderBy: { position: 'asc' } as const },
  fields: { orderBy: { position: 'asc' } as const },
};

async function formOr404(id: string) {
  const form = await prisma.form.findUnique({ where: { id }, include: formInclude });
  if (!form) throw notFound('Formulaire introuvable');
  return form;
}

/**
 * (Ré)écrit sections + champs. Les entrées sont réconciliées par `key` :
 * un champ dont la clé est conservée garde son `id` (donc ses réponses),
 * seuls les champs réellement retirés sont supprimés (leurs FormAnswer aussi).
 */
async function writeStructure(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  formId: string,
  sections: SectionInput[] | undefined,
  fields: FieldInput[] | undefined,
) {
  if (sections === undefined && fields === undefined) return;

  // --- Sections -----------------------------------------------------------
  const existingSections = await tx.formSection.findMany({ where: { formId }, select: { id: true, key: true } });
  const secIdByKey = new Map(existingSections.map((s) => [s.key, s.id]));
  const keepSectionKeys = new Set<string>();
  const keyToSectionId = new Map<string, string>();
  const secs = sections ?? [];

  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    keepSectionKeys.add(s.key);
    const data = {
      title: s.title,
      description: s.description ?? null,
      position: s.position || i,
      repeatable: s.repeatable ?? false,
      repeatLabel: s.repeatLabel ?? null,
      minRepeat: s.minRepeat ?? null,
      maxRepeat: s.maxRepeat ?? null,
      relevantField: s.relevantField ?? null,
      relevantOp: s.relevantOp ?? null,
      relevantValue: s.relevantValue ?? null,
    };
    const existingId = secIdByKey.get(s.key);
    if (existingId) {
      await tx.formSection.update({ where: { id: existingId }, data });
      keyToSectionId.set(s.key, existingId);
    } else {
      const created = await tx.formSection.create({ data: { ...data, formId, key: s.key } });
      keyToSectionId.set(s.key, created.id);
    }
  }
  const staleSectionIds = existingSections.filter((s) => !keepSectionKeys.has(s.key)).map((s) => s.id);
  if (staleSectionIds.length) await tx.formSection.deleteMany({ where: { id: { in: staleSectionIds } } });

  // --- Champs -----------------------------------------------------------
  if (fields === undefined) return;
  const existingFields = await tx.formField.findMany({ where: { formId }, select: { id: true, key: true } });
  const fieldIdByKey = new Map(existingFields.map((f) => [f.key, f.id]));
  const keepFieldKeys = new Set<string>();

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const key = f.key || `champ_${i + 1}`;
    keepFieldKeys.add(key);
    const data = {
      sectionId: f.sectionKey ? keyToSectionId.get(f.sectionKey) ?? null : null,
      label: f.label,
      type: f.type,
      required: f.required ?? false,
      position: f.position || i,
      options: f.options ?? [],
      helpText: f.helpText ?? null,
      placeholder: f.placeholder ?? null,
      defaultValue: f.defaultValue ?? null,
      minValue: f.minValue ?? null,
      maxValue: f.maxValue ?? null,
      pattern: f.pattern ?? null,
      relevantField: f.relevantField ?? null,
      relevantOp: f.relevantOp ?? null,
      relevantValue: f.relevantValue ?? null,
      constraintExpr: f.constraintExpr ?? null,
      constraintMessage: f.constraintMessage ?? null,
      calculation: f.calculation ?? null,
      appearance: f.appearance ?? null,
      rangeStep: f.rangeStep ?? null,
    };
    const existingId = fieldIdByKey.get(key);
    if (existingId) await tx.formField.update({ where: { id: existingId }, data });
    else await tx.formField.create({ data: { ...data, formId, key } });
  }
  const staleFieldIds = existingFields.filter((f) => !keepFieldKeys.has(f.key)).map((f) => f.id);
  if (staleFieldIds.length) await tx.formField.deleteMany({ where: { id: { in: staleFieldIds } } });
}

// --- Liste / CRUD --------------------------------------------------------

router.get(
  '/',
  validate(z.object({ workspaceId: z.string().optional(), projectId: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const scope = req.query.workspaceId
      ? { workspaceId: String(req.query.workspaceId) }
      : { workspaceId: { in: await myWorkspaceIds(req.user!.id) } };
    if (req.query.workspaceId) await requireWorkspaceMember(req.user!.id, String(req.query.workspaceId));

    const forms = await prisma.form.findMany({
      where: { ...scope, projectId: req.query.projectId ? String(req.query.projectId) : undefined },
      include: {
        workspace: { select: { id: true, name: true, color: true, isPersonal: true } },
        _count: { select: { responses: true, fields: true, sections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(forms);
  }),
);

router.post(
  '/',
  validate(
    z.object({
      workspaceId: z.string(),
      projectId: z.string().optional(),
      title: z.string().min(2),
      description: z.string().optional(),
      requireLogin: z.boolean().optional(),
      allowMultiple: z.boolean().optional(),
      sections: z.array(sectionSchema).optional(),
      fields: z.array(fieldSchema).default([]),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const form = await prisma.$transaction(async (tx) => {
      const f = await tx.form.create({
        data: {
          workspaceId: req.body.workspaceId,
          projectId: req.body.projectId,
          title: req.body.title,
          description: req.body.description,
          requireLogin: req.body.requireLogin ?? false,
          allowMultiple: req.body.allowMultiple ?? true,
          createdById: req.user!.id,
        },
      });
      await writeStructure(tx, f.id, req.body.sections, req.body.fields);
      return tx.form.findUnique({ where: { id: f.id }, include: formInclude });
    });
    res.status(201).json(form);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    res.json(form);
  }),
);

router.put(
  '/:id',
  validate(
    z.object({
      title: z.string().min(2).optional(),
      description: z.string().nullable().optional(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
      requireLogin: z.boolean().optional(),
      allowMultiple: z.boolean().optional(),
      sections: z.array(sectionSchema).optional(),
      fields: z.array(fieldSchema).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);

    const { fields, sections, ...rest } = req.body as {
      fields?: FieldInput[];
      sections?: SectionInput[];
      status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
      [k: string]: unknown;
    };

    const nextStatus = rest.status ?? form.status;
    const structuralChange = fields !== undefined || sections !== undefined;
    // 1re publication : on genere le code court du lien public.
    if (nextStatus === 'PUBLISHED' && !form.publicCode) {
      (rest as Record<string, unknown>).publicCode = await uniquePublicCode();
    }
    // Versionnage facon Kobo : chaque (re)deploiement d'un formulaire publie incremente la version.
    if (nextStatus === 'PUBLISHED' && (structuralChange || form.status !== 'PUBLISHED')) {
      (rest as Record<string, unknown>).version = form.version + 1;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.form.update({ where: { id: form.id }, data: rest });
      await writeStructure(tx, form.id, sections, fields);
      return tx.form.findUnique({ where: { id: form.id }, include: formInclude });
    });
    res.json(updated);
  }),
);

// Definition portable (export / import entre espaces) -------------------

router.get(
  '/:id/definition',
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    res.json({
      talkioForm: 1,
      title: form.title,
      description: form.description,
      requireLogin: form.requireLogin,
      allowMultiple: form.allowMultiple,
      sections: form.sections.map((s) => ({
        key: s.key,
        title: s.title,
        description: s.description,
        position: s.position,
        repeatable: s.repeatable,
        repeatLabel: s.repeatLabel,
        minRepeat: s.minRepeat,
        maxRepeat: s.maxRepeat,
        relevantField: s.relevantField,
        relevantOp: s.relevantOp,
        relevantValue: s.relevantValue,
      })),
      fields: form.fields.map((f) => ({
        label: f.label,
        key: f.key,
        type: f.type,
        required: f.required,
        position: f.position,
        options: f.options,
        helpText: f.helpText,
        placeholder: f.placeholder,
        defaultValue: f.defaultValue,
        minValue: f.minValue,
        maxValue: f.maxValue,
        pattern: f.pattern,
        sectionKey: f.sectionId ? form.sections.find((s) => s.id === f.sectionId)?.key ?? null : null,
        relevantField: f.relevantField,
        relevantOp: f.relevantOp,
        relevantValue: f.relevantValue,
        constraintExpr: f.constraintExpr,
        constraintMessage: f.constraintMessage,
        calculation: f.calculation,
        appearance: f.appearance,
        rangeStep: f.rangeStep,
      })),
    });
  }),
);

router.post(
  '/import',
  validate(
    z.object({
      workspaceId: z.string(),
      projectId: z.string().optional(),
      title: z.string().min(2).optional(),
      definition: z.object({
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        requireLogin: z.boolean().optional(),
        allowMultiple: z.boolean().optional(),
        sections: z.array(sectionSchema).optional(),
        fields: z.array(fieldSchema).default([]),
      }),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const def = req.body.definition;
    const form = await prisma.$transaction(async (tx) => {
      const f = await tx.form.create({
        data: {
          workspaceId: req.body.workspaceId,
          projectId: req.body.projectId,
          title: req.body.title || `${def.title} (importé)`,
          description: def.description ?? null,
          requireLogin: def.requireLogin ?? false,
          allowMultiple: def.allowMultiple ?? true,
          createdById: req.user!.id,
        },
      });
      await writeStructure(tx, f.id, def.sections, def.fields);
      return tx.form.findUnique({ where: { id: f.id }, include: formInclude });
    });
    res.status(201).json(form);
  }),
);

// --- Reponses ----------------------------------------------------------

router.post(
  '/:id/responses',
  validate(
    z.object({
      answers: z.record(z.any()),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      deviceId: z.string().max(80).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    if (form.status === 'CLOSED') throw badRequest('Ce formulaire est fermé');

    assertRequired(form, req.body.answers);
    const rows = buildAnswerRows(form, req.body.answers);

    const response = await prisma.formResponse.create({
      data: {
        formId: form.id,
        submittedById: req.user!.id,
        formVersion: form.version,
        deviceId: req.body.deviceId,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        answers: { create: rows.map((r) => ({ fieldId: r.fieldId, groupIndex: r.groupIndex, value: r.value as object })) },
      },
      include: { answers: true },
    });

    const submitter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true } });
    runAutomations(form.workspaceId, 'form.response.created', {
      form: { title: form.title, id: form.id },
      response: { id: response.id, by: submitter?.fullName ?? 'Anonyme' },
      summary: `Nouvelle réponse à « ${form.title} » par ${submitter?.fullName ?? 'Anonyme'} — ${previewAnswers(form, req.body.answers)}`,
    });

    res.status(201).json(response);
  }),
);

router.get(
  '/:id/responses',
  validate(
    z.object({ review: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']).optional() }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    const responses = await prisma.formResponse.findMany({
      where: { formId: form.id, reviewState: req.query.review ? (req.query.review as never) : undefined },
      include: {
        answers: true,
        submittedBy: { select: { id: true, fullName: true, avatarUrl: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(responses);
  }),
);

router.patch(
  '/:id/responses/:responseId/review',
  validate(
    z.object({
      reviewState: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']),
      reviewNote: z.string().max(1000).nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    const existing = await prisma.formResponse.findFirst({
      where: { id: req.params.responseId, formId: form.id },
      select: { id: true },
    });
    if (!existing) throw notFound('Réponse introuvable');
    const updated = await prisma.formResponse.update({
      where: { id: existing.id },
      data: {
        reviewState: req.body.reviewState,
        reviewNote: req.body.reviewNote ?? null,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
      include: { reviewedBy: { select: { id: true, fullName: true } } },
    });
    res.json(updated);
  }),
);

router.delete(
  '/:id/responses/:responseId',
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    const existing = await prisma.formResponse.findFirst({
      where: { id: req.params.responseId, formId: form.id },
      select: { id: true },
    });
    if (!existing) throw notFound('Réponse introuvable');
    await prisma.formResponse.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

router.get(
  '/:id/export.csv',
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    const responses = await prisma.formResponse.findMany({
      where: { formId: form.id },
      include: { answers: true, submittedBy: { select: { fullName: true } } },
      orderBy: { submittedAt: 'asc' },
    });

    const repeatSections = form.sections.filter((s) => s.repeatable);
    const repeatFieldIds = new Set(
      form.fields.filter((f) => repeatSections.some((s) => s.id === f.sectionId)).map((f) => f.id),
    );
    const flatFields = form.fields.filter((f) => !repeatFieldIds.has(f.id));

    // Nombre max d'iterations observees par section repetable -> colonnes indexees.
    const maxRepeat = new Map<string, number>();
    for (const s of repeatSections) {
      const childIds = new Set(form.fields.filter((f) => f.sectionId === s.id).map((f) => f.id));
      let max = 0;
      for (const r of responses) {
        const idx = r.answers.filter((a) => childIds.has(a.fieldId)).map((a) => a.groupIndex);
        max = Math.max(max, idx.length ? Math.max(...idx) + 1 : 0);
      }
      maxRepeat.set(s.id, max);
    }

    const headers = [
      'submitted_at',
      'submitted_by',
      'email',
      'review_state',
      'form_version',
      ...flatFields.map((f) => f.key),
    ];
    for (const s of repeatSections) {
      const childKeys = form.fields.filter((f) => f.sectionId === s.id).map((f) => f.key);
      for (let i = 1; i <= (maxRepeat.get(s.id) ?? 0); i++) {
        for (const ck of childKeys) headers.push(`${s.key}[${i}].${ck}`);
      }
    }
    headers.push('latitude', 'longitude');

    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = responses.map((r) => {
      const flat = new Map(r.answers.filter((a) => a.groupIndex === 0).map((a) => [a.fieldId, a.value]));
      const line: unknown[] = [
        r.submittedAt.toISOString(),
        r.submittedBy?.fullName ?? '',
        r.email ?? '',
        r.reviewState,
        r.formVersion,
        ...flatFields.map((f) => flat.get(f.id)),
      ];
      for (const s of repeatSections) {
        const children = form.fields.filter((f) => f.sectionId === s.id);
        for (let i = 0; i < (maxRepeat.get(s.id) ?? 0); i++) {
          for (const cf of children) {
            const a = r.answers.find((x) => x.fieldId === cf.id && x.groupIndex === i);
            line.push(a?.value);
          }
        }
      }
      line.push(r.latitude ?? '', r.longitude ?? '');
      return line.map(escape).join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="form-${form.id}.csv"`);
    res.send([headers.join(','), ...rows].join('\n'));
  }),
);

export default router;
