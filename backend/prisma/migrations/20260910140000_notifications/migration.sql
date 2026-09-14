-- Notifications in-app (bulle) : demandes d'ami, assignations, suivi, formulaires…

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'PROJECT_ASSIGNED',
    'RISK_ASSIGNED', 'MEASUREMENT_ADDED', 'FORM_RESPONSE', 'GENERIC'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "type"       "NotificationType" NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "link"       TEXT,
  "actorId"    TEXT,
  "entityType" TEXT,
  "entityId"   TEXT,
  "readAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
