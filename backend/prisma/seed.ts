import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@talkio.dev' },
    update: {},
    create: { email: 'alice@talkio.dev', passwordHash, fullName: 'Alice Rakoto' },
  });
  const bob = await prisma.user.upsert({
    where: { email: 'bob@talkio.dev' },
    update: {},
    create: { email: 'bob@talkio.dev', passwordHash, fullName: 'Bob Randria' },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'talkio-demo' },
    update: {},
    create: {
      name: 'Talkio Demo',
      slug: 'talkio-demo',
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'MEMBER' },
        ],
      },
      channels: {
        create: [
          { name: 'general', type: 'PUBLIC', topic: 'Discussion generale' },
          { name: 'terrain', type: 'PUBLIC', topic: 'Coordination terrain' },
        ],
      },
    },
    include: { channels: true },
  });

  const general = workspace.channels.find((c) => c.name === 'general')!;
  await prisma.channelMember.createMany({
    data: [
      { channelId: general.id, userId: alice.id, isAdmin: true },
      { channelId: general.id, userId: bob.id },
    ],
    skipDuplicates: true,
  });
  await prisma.message.create({
    data: { channelId: general.id, authorId: alice.id, body: 'Bienvenue sur Talkio !' },
  });

  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      name: 'Suivi projet',
      columns: {
        create: [
          { name: 'A faire', position: 0 },
          { name: 'En cours', position: 1 },
          { name: 'Termine', position: 2 },
        ],
      },
    },
    include: { columns: true },
  });
  await prisma.card.create({
    data: {
      columnId: board.columns[0].id,
      title: 'Preparer la collecte de donnees',
      description: 'Definir les formulaires et former les enqueteurs',
      priority: 'HIGH',
      position: 0,
    },
  });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: 'Acces a l eau potable - Region Analamanga',
      code: 'WASH-2026',
      donor: 'Bailleur X',
      createdById: alice.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      indicators: {
        create: [
          {
            code: 'OUT-1.1',
            name: 'Nombre de personnes ayant acces a une source d eau amelioree',
            level: 'OUTPUT',
            unit: 'personnes',
            baseline: 0,
            target: 5000,
            disaggregation: ['sexe', 'age'],
          },
        ],
      },
    },
    include: { indicators: true },
  });
  await prisma.mealMeasurement.create({
    data: {
      indicatorId: project.indicators[0].id,
      value: 1200,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-03-31'),
      location: 'Antananarivo',
      recordedById: bob.id,
    },
  });

  await prisma.form.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      title: 'Enquete menage - acces a l eau',
      status: 'PUBLISHED',
      createdById: alice.id,
      fields: {
        create: [
          { label: 'Nom du chef de menage', key: 'nom_chef', type: 'TEXT', required: true, position: 0 },
          { label: 'Taille du menage', key: 'taille_menage', type: 'NUMBER', required: true, position: 1 },
          { label: 'Source d eau principale', key: 'source_eau', type: 'SELECT', options: ['Robinet', 'Puits', 'Riviere', 'Autre'], position: 2 },
          { label: 'Distance a la source (min)', key: 'distance_min', type: 'NUMBER', position: 3 },
          { label: 'Localisation GPS', key: 'gps', type: 'GEOPOINT', position: 4 },
        ],
      },
    },
  });

  // --- Agenda ---------------------------------------------------------------
  const calPerso = await prisma.calendar.create({
    data: {
      workspaceId: workspace.id,
      ownerId: alice.id,
      name: 'Mon agenda',
      color: '#ff2c5f',
      isDefault: true,
    },
  });
  const calProjet = await prisma.calendar.create({
    data: { workspaceId: workspace.id, ownerId: alice.id, name: 'Projet WASH', color: '#8774e1' },
  });

  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  await prisma.calendarEvent.createMany({
    data: [
      { calendarId: calPerso.id, title: 'Reunion equipe terrain', startsAt: at(0, 9), endsAt: at(0, 10), createdById: alice.id },
      { calendarId: calPerso.id, title: 'Point hebdo MEAL', location: 'Salle 2', startsAt: at(1, 14), endsAt: at(1, 15, 30), createdById: alice.id },
      { calendarId: calProjet.id, title: 'Formation enqueteurs', startsAt: at(2, 8), endsAt: at(2, 12), createdById: alice.id },
      { calendarId: calProjet.id, title: 'Collecte village A', allDay: true, startsAt: at(3, 0), endsAt: at(4, 0), createdById: alice.id },
      { calendarId: calPerso.id, title: 'Revue budget bailleur', startsAt: at(4, 11), endsAt: at(4, 12), createdById: alice.id },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seed termine. Comptes: alice@talkio.dev / bob@talkio.dev (mot de passe: password123)');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
