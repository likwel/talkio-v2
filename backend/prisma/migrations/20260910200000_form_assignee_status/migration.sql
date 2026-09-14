-- Acceptation de l'attribution de formulaire par l'invite.

DO $$ BEGIN
  CREATE TYPE "FormAssigneeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "FormAssignee"
  ADD COLUMN IF NOT EXISTS "status" "FormAssigneeStatus" NOT NULL DEFAULT 'PENDING';

-- Les attributions existantes sont considerees comme acceptees.
UPDATE "FormAssignee" SET "status" = 'ACCEPTED' WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "FormAssignee_userId_status_idx" ON "FormAssignee"("userId", "status");
