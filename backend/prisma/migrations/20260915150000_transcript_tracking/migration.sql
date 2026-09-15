-- Tableau de suivi des entretiens (IDEAL) : localisation detaillee, type de
-- repondant/acteur, deuxieme passage, et etape de revue interne du transcript.

DO $$ BEGIN
  CREATE TYPE "TranscriptReviewStep" AS ENUM ('ORIGINAL', 'REVIEWED', 'REVISED', 'FINAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "community" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "kiiType" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "sex" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "organizationName" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "marketActorType" TEXT;
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "round2Date" TIMESTAMP(3);
ALTER TABLE "QualitativeTranscript" ADD COLUMN IF NOT EXISTS "reviewStep" "TranscriptReviewStep" NOT NULL DEFAULT 'ORIGINAL';
