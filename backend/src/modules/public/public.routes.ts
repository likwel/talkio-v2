import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { runAutomations } from '../automations/dispatch';

/**
 * Acces public (sans authentification) aux formulaires d'enquete PUBLIES.
 * Le lien partage est `/f/:formId` cote front ; l'id cuid sert de jeton.
 */
const router = Router();

async function publishedFormOr404(id: string) {
  const form = await prisma.form.findUnique({
    where: { id },
    include: { fields: { orderBy: { position: 'asc' } } },
  });
  if (!form || form.status !== 'PUBLISHED') throw notFound('Formulaire indisponible');
  return form;
}

// Description du formulaire (champs uniquement, aucune info d'espace).
router.get(
  '/forms/:id',
  asyncHandler(async (req, res) => {
    const form = await publishedFormOr404(req.params.id);
    res.json({
      id: form.id,
      title: form.title,
      description: form.description,
      fields: form.fields.map((f) => ({
        id: f.id,
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
      })),
    });
  }),
);

// Soumission anonyme.
router.post(
  '/forms/:id/responses',
  validate(
    z.object({
      answers: z.record(z.any()),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const form = await publishedFormOr404(req.params.id);

    const byKey = new Map(form.fields.map((f) => [f.key, f]));
    for (const field of form.fields) {
      if (field.required && (req.body.answers[field.key] === undefined || req.body.answers[field.key] === '')) {
        throw badRequest(`Champ obligatoire manquant: ${field.label}`);
      }
    }

    const response = await prisma.formResponse.create({
      data: {
        formId: form.id,
        submittedById: null,
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

    const preview = form.fields
      .slice(0, 3)
      .map((f) => `${f.label}: ${req.body.answers[f.key] ?? '—'}`)
      .join(' · ');
    runAutomations(form.workspaceId, 'form.response.created', {
      form: { title: form.title, id: form.id },
      response: { id: response.id, by: 'Anonyme (lien public)' },
      summary: `Nouvelle reponse a « ${form.title} » via le lien public — ${preview}`,
    });

    res.status(201).json({ ok: true });
  }),
);

export default router;
