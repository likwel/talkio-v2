-- Alerte "tache en retard" (automatisation card.overdue) : horodatage de la
-- derniere notification envoyee, pour ne declencher qu'une seule fois par tache.

ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "overdueNotifiedAt" TIMESTAMP(3);
