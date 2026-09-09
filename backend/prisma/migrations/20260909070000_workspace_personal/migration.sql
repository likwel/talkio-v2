-- Espace personnel implicite (dépôt par défaut des Projets / MEAL / Collecte).
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "isPersonal" BOOLEAN NOT NULL DEFAULT false;
