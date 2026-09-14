-- Lien Projet Kanban (tache) <-> Suivi-evaluation (activite MEAL).

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "cardId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_cardId_key" UNIQUE ("cardId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
