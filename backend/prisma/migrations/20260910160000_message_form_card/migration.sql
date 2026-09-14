-- Partage de formulaire dans une conversation (carte de formulaire integree).

ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'FORM';

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "formId" TEXT;
CREATE INDEX IF NOT EXISTS "Message_formId_idx" ON "Message"("formId");
DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
