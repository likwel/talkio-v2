import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route introuvable' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Cette ressource existe deja' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Ressource introuvable' });
    }
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'Erreur serveur interne' });
}
