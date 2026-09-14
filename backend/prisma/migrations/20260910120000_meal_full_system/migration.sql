-- Systeme MEAL complet : gestion de projet + suivi-evaluation (ONG).

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'DELAYED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FeedbackType" AS ENUM ('COMPLAINT', 'SUGGESTION', 'QUESTION', 'APPRECIATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Project : nouvelles colonnes ----------
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "goal" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "sector" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "health" "ProjectHealth" NOT NULL DEFAULT 'ON_TRACK';

-- ---------- MealIndicator ----------
ALTER TABLE "MealIndicator" ADD COLUMN IF NOT EXISTS "assumptions" TEXT;

-- ---------- MealMeasurement : ventilation + qualite ----------
ALTER TABLE "MealMeasurement" ADD COLUMN IF NOT EXISTS "female" DOUBLE PRECISION;
ALTER TABLE "MealMeasurement" ADD COLUMN IF NOT EXISTS "male" DOUBLE PRECISION;
ALTER TABLE "MealMeasurement" ADD COLUMN IF NOT EXISTS "youth" DOUBLE PRECISION;
ALTER TABLE "MealMeasurement" ADD COLUMN IF NOT EXISTS "disability" DOUBLE PRECISION;
ALTER TABLE "MealMeasurement" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MealMeasurement" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- ---------- IndicatorTarget ----------
CREATE TABLE IF NOT EXISTS "IndicatorTarget" (
  "id"          TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "period"      TEXT NOT NULL,
  "target"      DOUBLE PRECISION NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IndicatorTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IndicatorTarget_indicatorId_period_key" ON "IndicatorTarget"("indicatorId", "period");
CREATE INDEX IF NOT EXISTS "IndicatorTarget_indicatorId_idx" ON "IndicatorTarget"("indicatorId");
DO $$ BEGIN
  ALTER TABLE "IndicatorTarget" ADD CONSTRAINT "IndicatorTarget_indicatorId_fkey"
    FOREIGN KEY ("indicatorId") REFERENCES "MealIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Activity ----------
CREATE TABLE IF NOT EXISTS "Activity" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "indicatorId" TEXT,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "status"      "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "progress"    INTEGER NOT NULL DEFAULT 0,
  "startDate"   TIMESTAMP(3),
  "dueDate"     TIMESTAMP(3),
  "location"    TEXT,
  "assigneeId"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Activity_projectId_status_idx" ON "Activity"("projectId", "status");
DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_indicatorId_fkey"
    FOREIGN KEY ("indicatorId") REFERENCES "MealIndicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- BudgetLine ----------
CREATE TABLE IF NOT EXISTS "BudgetLine" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "donor"     TEXT,
  "category"  TEXT,
  "planned"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "spent"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BudgetLine_projectId_idx" ON "BudgetLine"("projectId");
DO $$ BEGIN
  ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Risk ----------
CREATE TABLE IF NOT EXISTS "Risk" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "likelihood"  INTEGER NOT NULL DEFAULT 3,
  "impact"      INTEGER NOT NULL DEFAULT 3,
  "mitigation"  TEXT,
  "status"      "RiskStatus" NOT NULL DEFAULT 'OPEN',
  "ownerId"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Risk_projectId_status_idx" ON "Risk"("projectId", "status");
DO $$ BEGIN
  ALTER TABLE "Risk" ADD CONSTRAINT "Risk_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- FeedbackEntry ----------
CREATE TABLE IF NOT EXISTS "FeedbackEntry" (
  "id"         TEXT NOT NULL,
  "projectId"  TEXT NOT NULL,
  "type"       "FeedbackType" NOT NULL DEFAULT 'COMPLAINT',
  "channel"    TEXT,
  "category"   TEXT,
  "sensitive"  BOOLEAN NOT NULL DEFAULT false,
  "summary"    TEXT NOT NULL,
  "detail"     TEXT,
  "reporter"   TEXT,
  "location"   TEXT,
  "status"     "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "resolution" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FeedbackEntry_projectId_status_idx" ON "FeedbackEntry"("projectId", "status");
DO $$ BEGIN
  ALTER TABLE "FeedbackEntry" ADD CONSTRAINT "FeedbackEntry_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Lesson ----------
CREATE TABLE IF NOT EXISTS "Lesson" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "category"       TEXT,
  "context"        TEXT,
  "insight"        TEXT NOT NULL,
  "recommendation" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Lesson_projectId_idx" ON "Lesson"("projectId");
DO $$ BEGIN
  ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- PeriodReport ----------
CREATE TABLE IF NOT EXISTS "PeriodReport" (
  "id"           TEXT NOT NULL,
  "projectId"    TEXT NOT NULL,
  "period"       TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "narrative"    TEXT,
  "achievements" TEXT,
  "challenges"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PeriodReport_projectId_idx" ON "PeriodReport"("projectId");
DO $$ BEGIN
  ALTER TABLE "PeriodReport" ADD CONSTRAINT "PeriodReport_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
