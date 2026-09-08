import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { initSocket } from './realtime/socket';
import { prisma } from './lib/prisma';

async function main() {
  const app = createApp();
  const server = createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Talkio API sur http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('Arret en cours...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
