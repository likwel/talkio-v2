import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../lib/jwt';

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

interface AuthedSocket extends Socket {
  userId?: string;
}

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Token manquant'));
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      return next();
    } catch {
      return next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.userId!;
    socket.join(`user:${userId}`);

    // --- Messagerie: rooms par canal / tableau ---------------------------
    socket.on('channel:subscribe', (channelId: string) => socket.join(`channel:${channelId}`));
    socket.on('channel:unsubscribe', (channelId: string) => socket.leave(`channel:${channelId}`));
    socket.on('board:subscribe', (boardId: string) => socket.join(`board:${boardId}`));
    socket.on('board:unsubscribe', (boardId: string) => socket.leave(`board:${boardId}`));

    // --- Agenda: room par espace de travail -----------------------------
    socket.on('calendar:subscribe', (workspaceId: string) => socket.join(`calendar:${workspaceId}`));
    socket.on('calendar:unsubscribe', (workspaceId: string) => socket.leave(`calendar:${workspaceId}`));

    // --- Appels en cours: room par espace de travail --------------------
    socket.on('calls:subscribe', (workspaceId: string) => socket.join(`calls:${workspaceId}`));
    socket.on('calls:unsubscribe', (workspaceId: string) => socket.leave(`calls:${workspaceId}`));

    socket.on('typing', ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit('typing', { channelId, userId });
    });

    // --- Signalisation WebRTC (appel / visio) --------------------------
    socket.on('call:join', ({ roomId }: { roomId: string }) => {
      socket.join(`call:${roomId}`);
      socket.to(`call:${roomId}`).emit('call:peer-joined', { socketId: socket.id, userId });
    });

    socket.on('call:signal', ({ roomId, to, data }: { roomId: string; to: string; data: unknown }) => {
      io?.to(to).emit('call:signal', { from: socket.id, userId, data, roomId });
    });

    socket.on('call:leave', ({ roomId }: { roomId: string }) => {
      socket.to(`call:${roomId}`).emit('call:peer-left', { socketId: socket.id, userId });
      socket.leave(`call:${roomId}`);
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('call:')) {
          socket.to(room).emit('call:peer-left', { socketId: socket.id, userId });
        }
      }
    });
  });

  return io;
}
