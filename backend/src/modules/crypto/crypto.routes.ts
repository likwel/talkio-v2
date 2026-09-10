import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { conflict } from '../../lib/http';

/**
 * Identité cryptographique de l'utilisateur pour le chiffrement de bout en bout.
 * Le serveur ne stocke que la clé publique et la clé privée *chiffrée* (opaque) :
 * il ne peut jamais lire les messages.
 */
const router = Router();

const b64 = z.string().min(1).max(20000);

router.get(
  '/identity/me',
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { cryptoPublicKey: true, cryptoPrivateKeyEnc: true, cryptoKeyCreatedAt: true },
    });
    res.json({
      publicKey: u?.cryptoPublicKey ?? null,
      encryptedPrivateKey: u?.cryptoPrivateKeyEnc ?? null,
      createdAt: u?.cryptoKeyCreatedAt ?? null,
    });
  }),
);

router.post(
  '/identity',
  validate(z.object({ publicKey: b64, encryptedPrivateKey: b64 })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { cryptoPublicKey: true },
    });
    if (existing?.cryptoPublicKey) {
      throw conflict('Une identité de chiffrement existe déjà pour ce compte');
    }
    const u = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        cryptoPublicKey: req.body.publicKey,
        cryptoPrivateKeyEnc: req.body.encryptedPrivateKey,
        cryptoKeyCreatedAt: new Date(),
      },
      select: { cryptoKeyCreatedAt: true },
    });
    res.status(201).json({ ok: true, createdAt: u.cryptoKeyCreatedAt });
  }),
);

// Clés publiques d'un ensemble d'utilisateurs (pour composer une enveloppe de clé de salon).
router.get(
  '/keys',
  validate(z.object({ userIds: z.string() }), 'query'),
  asyncHandler(async (req, res) => {
    const ids = String(req.query.userIds)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    if (ids.length === 0) return res.json([]);

    // On ne renvoie que les utilisateurs partageant un espace avec le demandeur.
    const shared = await prisma.workspaceMember.findMany({
      where: {
        userId: { in: ids },
        workspace: { members: { some: { userId: req.user!.id } } },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const allowed = new Set(shared.map((s) => s.userId));
    allowed.add(req.user!.id); // toujours autorisé à récupérer sa propre clé

    const users = await prisma.user.findMany({
      where: { id: { in: ids.filter((i) => allowed.has(i)) }, cryptoPublicKey: { not: null } },
      select: { id: true, cryptoPublicKey: true },
    });
    res.json(users.map((u) => ({ userId: u.id, publicKey: u.cryptoPublicKey })));
  }),
);

export default router;
