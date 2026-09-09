-- Collecte v2 : moteur d'enquête façon KoboToolbox / ODK
-- Sections + sections répétables, skip logic, contraintes, calculs,
-- nouveaux types de question, versionnage, revue qualité des soumissions.

-- Nouveaux types de champ ------------------------------------------------------
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'INTEGER';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'DECIMAL';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'RANGE';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGE';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'NOTE';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'BARCODE';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'SIGNATURE';

-- Statut de revue ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "ReviewState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Form --------------------------------------------------------------------------
ALTER TABLE "Form" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Form" ADD COLUMN IF NOT EXISTS "allowMultiple" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Form" ADD COLUMN IF NOT EXISTS "requireLogin" BOOLEAN NOT NULL DEFAULT false;

-- FormSection -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FormSection" (
  "id"            TEXT NOT NULL,
  "formId"        TEXT NOT NULL,
  "key"           TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "repeatable"    BOOLEAN NOT NULL DEFAULT false,
  "repeatLabel"   TEXT,
  "minRepeat"     INTEGER,
  "maxRepeat"     INTEGER,
  "relevantField" TEXT,
  "relevantOp"    TEXT,
  "relevantValue" TEXT,
  CONSTRAINT "FormSection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FormSection_formId_key_key" ON "FormSection"("formId", "key");
CREATE INDEX IF NOT EXISTS "FormSection_formId_idx" ON "FormSection"("formId");
DO $$ BEGIN
  ALTER TABLE "FormSection" ADD CONSTRAINT "FormSection_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FormField -----------------------------------------------------------------
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "sectionId" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "relevantField" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "relevantOp" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "relevantValue" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "constraintExpr" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "constraintMessage" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "calculation" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "appearance" TEXT;
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "rangeStep" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "FormField_sectionId_idx" ON "FormField"("sectionId");
DO $$ BEGIN
  ALTER TABLE "FormField" ADD CONSTRAINT "FormField_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "FormSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FormResponse ------------------------------------------------------------------
ALTER TABLE "FormResponse" ADD COLUMN IF NOT EXISTS "formVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FormResponse" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "FormResponse" ADD COLUMN IF NOT EXISTS "reviewState" "ReviewState" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "FormResponse" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
ALTER TABLE "FormResponse" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "FormResponse" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "FormResponse_formId_reviewState_idx" ON "FormResponse"("formId", "reviewState");
DO $$ BEGIN
  ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FormAnswer : indice d'itération pour les sections répétables ---------------
ALTER TABLE "FormAnswer" ADD COLUMN IF NOT EXISTS "groupIndex" INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "FormAnswer_responseId_fieldId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "FormAnswer_responseId_fieldId_groupIndex_key"
  ON "FormAnswer"("responseId", "fieldId", "groupIndex");
