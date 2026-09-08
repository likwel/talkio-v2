import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../lib/http';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(badRequest('Donnees invalides', result.error.flatten()));
    }
    req[source] = result.data;
    return next();
  };
}
