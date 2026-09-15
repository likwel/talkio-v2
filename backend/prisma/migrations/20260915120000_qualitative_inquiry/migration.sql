-- Qualitative Inquiry Planning Sheet (QuIPS) : fiche de planification d'une
-- enquete qualitative rattachee a un projet MEAL.

DO $$ BEGIN
  CREATE TYPE "QuipsStatus" AS ENUM ('DRAFT', 'FINAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "QualitativeInquiry" (
  "id"                     TEXT NOT NULL,
  "projectId"              TEXT NOT NULL,
  "code"                   TEXT,
  "title"                  TEXT NOT NULL,
  "status"                 "QuipsStatus" NOT NULL DEFAULT 'DRAFT',

  "sourceDocuments"        TEXT,
  "evidenceGaps"           TEXT,
  "collaborators"          TEXT,
  "reviewers"              TEXT,
  "stakeholders"           TEXT,

  "purpose"                TEXT,
  "objectives"             TEXT,
  "researchQuestions"      TEXT,
  "dataTypes"              TEXT[] NOT NULL DEFAULT '{}',

  "dataSources"            TEXT,
  "samplingStrategy"       TEXT,
  "dataCollectionTools"    TEXT,

  "teamComposition"        TEXT,
  "frequencyTiming"        TEXT,
  "trainingRequirements"   TEXT,
  "dataManagement"         TEXT,
  "implementationTimeline" TEXT,

  "dataAnalysisPlan"       TEXT,
  "disaggregatedBy"        TEXT,
  "deliverables"           TEXT,
  "utilizationApplication" TEXT,

  "limitationsRisks"       TEXT,
  "ethicalReviewStatus"    TEXT,

  "createdById"            TEXT NOT NULL,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QualitativeInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QualitativeInquiry_projectId_idx" ON "QualitativeInquiry"("projectId");

DO $$ BEGIN
  ALTER TABLE "QualitativeInquiry" ADD CONSTRAINT "QualitativeInquiry_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QualitativeInquiry" ADD CONSTRAINT "QualitativeInquiry_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
