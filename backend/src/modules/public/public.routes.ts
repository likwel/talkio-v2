import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';
import { assertRequired, buildAnswerRows, previewAnswers } from '../forms/logic';
import { createNotification } from '../../lib/notify';

/**
 * Acces public (sans authentification) aux formulaires d'enquete PUBLIES.
 * Le lien partage est `/f/:code` cote front (code court de 5 caracteres).
 * On accepte aussi l'id cuid complet pour retro-compatibilite.
 */
const router = Router();

async function publishedFormOr404(idOrCode: string) {
  const form = await prisma.form.findFirst({
    where: {
      status: 'PUBLISHED',
      OR: [{ publicCode: idOrCode }, { id: idOrCode }],
    },
    include: {
      sections: { orderBy: { position: 'asc' } },
      fields: { orderBy: { position: 'asc' } },
    },
  });
  if (!form) throw notFound('Formulaire indisponible');
  if (form.requireLogin) throw notFound('Ce formulaire nécessite une connexion');
  return form;
}

// Description du formulaire (structure uniquement, aucune info d'espace).
router.get(
  '/forms/:id',
  asyncHandler(async (req, res) => {
    const form = await publishedFormOr404(req.params.id);
    res.json({
      id: form.id,
      title: form.title,
      description: form.description,
      version: form.version,
      sections: form.sections.map((s) => ({
        id: s.id,
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
        id: f.id,
        sectionKey: f.sectionId ? form.sections.find((s) => s.id === f.sectionId)?.key ?? null : null,
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

// Soumission anonyme (e-mail du participant obligatoire).
router.post(
  '/forms/:id/responses',
  validate(
    z.object({
      email: z.string().trim().email('Adresse e-mail invalide'),
      answers: z.record(z.any()),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      deviceId: z.string().max(80).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const form = await publishedFormOr404(req.params.id);
    if (form.status === 'CLOSED') throw badRequest('Ce formulaire est fermé');

    assertRequired(form, req.body.answers);
    const rows = buildAnswerRows(form, req.body.answers);

    const response = await prisma.formResponse.create({
      data: {
        formId: form.id,
        submittedById: null,
        email: req.body.email.toLowerCase(),
        formVersion: form.version,
        deviceId: req.body.deviceId,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        answers: { create: rows.map((r) => ({ fieldId: r.fieldId, groupIndex: r.groupIndex, value: r.value as object })) },
      },
      select: { id: true },
    });

    runAutomations(form.workspaceId, 'form.response.created', {
      form: { title: form.title, id: form.id },
      response: { id: response.id, by: 'Anonyme (lien public)' },
      summary: `Nouvelle réponse à « ${form.title} » via le lien public — ${previewAnswers(form, req.body.answers)}`,
    });

    await createNotification({
      userId: form.createdById,
      type: 'FORM_RESPONSE',
      title: `Nouvelle reponse a « ${form.title} »`,
      body: `Via le lien public (${req.body.email.toLowerCase()})`,
      link: `/forms/${form.id}/responses`,
      entityType: 'form',
      entityId: form.id,
    });

    res.status(201).json({ ok: true });
  }),
);

export default router;
