-- Attribution de formulaire a des utilisateurs (ils doivent le remplir).

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FORM_ASSIGNED';

CREATE TABLE IF NOT EXISTS "FormAssignee" (
  "id"           TEXT NOT NULL,
  "formId"       TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "assignedById" TEXT,
  "note"         TEXT,
  "dueAt"        TIMESTAMP(3),
  "respondedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormAssignee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FormAssignee_formId_userId_key" ON "FormAssignee"("formId", "userId");
CREATE INDEX IF NOT EXISTS "FormAssignee_userId_respondedAt_idx" ON "FormAssignee"("userId", "respondedAt");
DO $$ BEGIN
  ALTER TABLE "FormAssignee" ADD CONSTRAINT "FormAssignee_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FormAssignee" ADD CONSTRAINT "FormAssignee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FormAssignee" ADD CONSTRAINT "FormAssignee_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
