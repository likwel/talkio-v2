-- Permissions par salon : vue / lecture / écriture (surcharges par membre)
ALTER TABLE "ChannelMember" ADD COLUMN "canView" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ChannelMember" ADD COLUMN "canRead" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ChannelMember" ADD COLUMN "canWrite" BOOLEAN NOT NULL DEFAULT true;
