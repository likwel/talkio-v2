-- Alignement des echeances d'activites MEAL avec l'agenda de l'espace (phase Planification).

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_calendarEventId_key" UNIQUE ("calendarEventId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_calendarEventId_fkey"
    FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
