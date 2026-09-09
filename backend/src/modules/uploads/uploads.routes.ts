import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { Router, raw } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { badRequest } from '../../lib/http';

/** Dossier de stockage des pieces jointes (hors versionnement). */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), 'uploads');

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/zip': '.zip',
};

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function safeName(raw: string): string {
  return (raw || 'fichier')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .slice(0, 120)
    .trim();
}

const router = Router();

/**
 * Reception d'un fichier : le corps de la requete est le fichier brut,
 * `?name=` porte le nom d'origine, l'en-tete `Content-Type` le type MIME.
 * (Correspond a `api.post('/uploads', file, { headers: { 'Content-Type': file.type } })`.)
 */
router.post(
  '/',
  raw({ type: () => true, limit: MAX_SIZE + 1024 }),
  asyncHandler(async (req, res) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) throw badRequest('Aucun fichier recu');
    if (buf.length > MAX_SIZE) throw badRequest('Le fichier depasse la limite de 2 Mo');

    const mimeType = (req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();
    const originalName = safeName(String(req.query.name ?? 'fichier'));
    const hasExt = path.extname(originalName).length > 1;
    const ext = hasExt ? path.extname(originalName) : EXT[mimeType] ?? '';
    const id = randomUUID();
    const storedName = `${id}${ext}`;

    await writeFile(path.join(UPLOAD_DIR, storedName), buf);

    res.status(201).json({
      id,
      url: `/api/uploads/files/${storedName}`,
      name: originalName || `fichier${ext}`,
      mimeType,
      size: buf.length,
      checksum: createHash('sha1').update(buf).digest('hex').slice(0, 12),
    });
  }),
);

export default router;
