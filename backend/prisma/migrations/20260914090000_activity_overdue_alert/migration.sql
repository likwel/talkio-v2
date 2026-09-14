-- Alerte de retard sur les activites du plan de travail MEAL.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACTIVITY_OVERDUE';

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "overdueNotifiedAt" TIMESTAMP(3);
