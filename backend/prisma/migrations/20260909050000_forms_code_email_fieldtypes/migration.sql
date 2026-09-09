-- Nouveaux types de champ
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'DATETIME';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'TIME';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'PHONE';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'URL';
ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'RATING';

-- Lien public court + e-mail obligatoire du participant
ALTER TABLE "Form" ADD COLUMN "publicCode" TEXT;
CREATE UNIQUE INDEX "Form_publicCode_key" ON "Form"("publicCode");
ALTER TABLE "FormResponse" ADD COLUMN "email" TEXT;
