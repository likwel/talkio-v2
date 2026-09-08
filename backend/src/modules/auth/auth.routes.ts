import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as service from './auth.service';
import { badRequest } from '../../lib/http';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres'),
  fullName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.register(req.body));
  }),
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.login(req.body));
  }),
);

router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.refresh(req.body.refreshToken));
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken;
    if (!token) throw badRequest('refreshToken requis');
    await service.logout(token);
    res.status(204).end();
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await service.me(req.user!.id));
  }),
);

router.patch(
  '/me',
  authenticate,
  validate(
    z.object({
      fullName: z.string().min(2).max(80).optional(),
      avatarUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
    }),
  ),
  asyncHandler(async (req, res) => {
    res.json(await service.updateProfile(req.user!.id, req.body));
  }),
);

router.post(
  '/change-password',
  authenticate,
  validate(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caracteres'),
    }),
  ),
  asyncHandler(async (req, res) => {
    await service.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    res.status(204).end();
  }),
);

export default router;
