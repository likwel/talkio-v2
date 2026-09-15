-- Transcript d'entretien qualitatif (FGD, KII, entretien individuel...) : fiche
-- de collecte remplie sur le terrain, rattachee a un projet MEAL et, si
-- disponible, a la fiche de planification QuIPS de l'etude correspondante.

DO $$ BEGIN
  CREATE TYPE "TranscriptStatus" AS ENUM ('DRAFT', 'FINAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "QualitativeTranscript" (
  "id"               TEXT NOT NULL,
  "projectId"        TEXT NOT NULL,
  "quipsId"          TEXT,

  "title"            TEXT NOT NULL,
  "interviewType"    TEXT,
  "facilitator"      TEXT,
  "noteTaker"        TEXT,
  "location"         TEXT,
  "interviewDate"    TIMESTAMP(3),
  "startTime"        TEXT,
  "endTime"          TEXT,
  "consentObtained"  BOOLEAN NOT NULL DEFAULT false,
  "facilitatorNotes" TEXT,

  "interviewees"     JSONB NOT NULL DEFAULT '[]',
  "qa"               JSONB NOT NULL DEFAULT '[]',

  "status"           "TranscriptStatus" NOT NULL DEFAULT 'DRAFT',

  "createdById"      TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QualitativeTranscript_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QualitativeTranscript_projectId_idx" ON "QualitativeTranscript"("projectId");
CREATE INDEX IF NOT EXISTS "QualitativeTranscript_quipsId_idx" ON "QualitativeTranscript"("quipsId");

DO $$ BEGIN
  ALTER TABLE "QualitativeTranscript" ADD CONSTRAINT "QualitativeTranscript_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QualitativeTranscript" ADD CONSTRAINT "QualitativeTranscript_quipsId_fkey"
    FOREIGN KEY ("quipsId") REFERENCES "QualitativeInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QualitativeTranscript" ADD CONSTRAINT "QualitativeTranscript_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
