import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { requireWorkspaceMember } from '../../lib/access';
import { badRequest, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';

const router = Router();

const fieldSchema = z.object({
  label: z.string().min(1),
  key: z.string().min(1).regex(/^[a-z0-9_]+$/i, 'Cle: lettres, chiffres, underscore'),
  type: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'GEOPOINT', 'PHOTO']),
  required: z.boolean().default(false),
  position: z.number().int().default(0),
  options: z.array(z.string()).default([]),
  helpText: z.string().optional(),
  placeholder: z.string().max(200).optional(),
  defaultValue: z.string().max(500).optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  pattern: z.string().max(300).optional(),
});

async function formOr404(id: string) {
  const form = await prisma.form.findUnique({ where: { id }, include: { fields: { orderBy: { position: 'asc' } } } });
  if (!form) throw notFound('Formulaire introuvable');
  return form;
}

router.get(
  '/',
  validate(z.object({ workspaceId: z.string(), projectId: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId);
    await requireWorkspaceMember(req.user!.id, workspaceId);
    const forms = await prisma.form.findMany({
      where: { workspaceId, projectId: req.query.projectId ? String(req.query.projectId) : undefined },
      include: { _count: { select: { responses: true, fields: true } } },
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
      fields: z.array(fieldSchema).default([]),
    }),
  ),
  asyncHandler(async (req, res) => {
    await requireWorkspaceMember(req.user!.id, req.body.workspaceId);
    const form = await prisma.form.create({
      data: {
        workspaceId: req.body.workspaceId,
        projectId: req.body.projectId,
        title: req.body.title,
        description: req.body.description,
        createdById: req.user!.id,
        fields: {
          create: req.body.fields.map((f: z.infer<typeof fieldSchema>, i: number) => ({ ...f, position: f.position || i })),
        },
      },
      include: { fields: true },
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
      fields: z.array(fieldSchema).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);

    const { fields, ...rest } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.form.update({ where: { id: form.id }, data: rest });
      if (fields) {
        await tx.formField.deleteMany({ where: { formId: form.id } });
        await tx.formField.createMany({
          data: fields.map((f: z.infer<typeof fieldSchema>, i: number) => ({
            ...f,
            formId: form.id,
            position: f.position || i,
          })),
        });
      }
      return tx.form.findUnique({ where: { id: form.id }, include: { fields: { orderBy: { position: 'asc' } } } });
    });
    res.json(updated);
  }),
);

// --- Reponses ------------------------------------------------------------

router.post(
  '/:id/responses',
  validate(
    z.object({
      answers: z.record(z.any()),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    if (form.status === 'CLOSED') throw badRequest('Ce formulaire est ferme');

    const byKey = new Map(form.fields.map((f) => [f.key, f]));
    for (const field of form.fields) {
      if (field.required && (req.body.answers[field.key] === undefined || req.body.answers[field.key] === '')) {
        throw badRequest(`Champ obligatoire manquant: ${field.label}`);
      }
    }

    const response = await prisma.formResponse.create({
      data: {
        formId: form.id,
        submittedById: req.user!.id,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        answers: {
          create: Object.entries(req.body.answers)
            .filter(([key]) => byKey.has(key))
            .map(([key, value]) => ({ fieldId: byKey.get(key)!.id, value: value as object })),
        },
      },
      include: { answers: true },
    });

    const submitter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true } });
    const preview = form.fields
      .slice(0, 3)
      .map((f) => `${f.label}: ${req.body.answers[f.key] ?? '—'}`)
      .join(' · ');
    runAutomations(form.workspaceId, 'form.response.created', {
      form: { title: form.title, id: form.id },
      response: { id: response.id, by: submitter?.fullName ?? 'Anonyme' },
      summary: `Nouvelle reponse a « ${form.title} » par ${submitter?.fullName ?? 'Anonyme'} — ${preview}`,
    });

    res.status(201).json(response);
  }),
);

router.get(
  '/:id/responses',
  asyncHandler(async (req, res) => {
    const form = await formOr404(req.params.id);
    await requireWorkspaceMember(req.user!.id, form.workspaceId);
    const responses = await prisma.formResponse.findMany({
      where: { formId: form.id },
      include: {
        answers: true,
        submittedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(responses);
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

    const headers = ['submitted_at', 'submitted_by', ...form.fields.map((f) => f.key), 'latitude', 'longitude'];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = responses.map((r) => {
      const map = new Map(r.answers.map((a) => [a.fieldId, a.value]));
      return [
        r.submittedAt.toISOString(),
        r.submittedBy?.fullName ?? '',
        ...form.fields.map((f) => map.get(f.id)),
        r.latitude ?? '',
        r.longitude ?? '',
      ].map(escape).join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="form-${form.id}.csv"`);
    res.send([headers.join(','), ...rows].join('\n'));
  }),
);

export default router;
