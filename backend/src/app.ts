import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

import authRoutes from './modules/auth/auth.routes';
import workspaceRoutes from './modules/workspaces/workspaces.routes';
import channelRoutes from './modules/channels/channels.routes';
import messageRoutes from './modules/messages/messages.routes';
import boardRoutes from './modules/boards/boards.routes';
import mealRoutes from './modules/meal/meal.routes';
import formRoutes from './modules/forms/forms.routes';
import callRoutes from './modules/calls/calls.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import friendRoutes from './modules/friends/friends.routes';
import userRoutes from './modules/users/users.routes';
import automationRoutes from './modules/automations/automations.routes';
import cryptoRoutes from './modules/crypto/crypto.routes';
import publicRoutes from './modules/public/public.routes';
import uploadRoutes, { UPLOAD_DIR } from './modules/uploads/uploads.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'talkio-api', ts: Date.now() }));

  app.use('/api/public', publicRoutes);
  app.use('/api/uploads/files', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
  app.use('/api/uploads', authenticate, uploadRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/workspaces', authenticate, workspaceRoutes);
  app.use('/api/channels', authenticate, channelRoutes);
  app.use('/api/messages', authenticate, messageRoutes);
  app.use('/api/boards', authenticate, boardRoutes);
  app.use('/api/meal', authenticate, mealRoutes);
  app.use('/api/forms', authenticate, formRoutes);
  app.use('/api/calls', authenticate, callRoutes);
  app.use('/api/calendar', authenticate, calendarRoutes);
  app.use('/api/friends', authenticate, friendRoutes);
  app.use('/api/users', authenticate, userRoutes);
  app.use('/api/automations', authenticate, automationRoutes);
  app.use('/api/crypto', authenticate, cryptoRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
