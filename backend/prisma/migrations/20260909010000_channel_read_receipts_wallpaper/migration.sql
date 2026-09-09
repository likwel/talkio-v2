-- Conversation : fond personnalisable, accuses de lecture configurables, createur
ALTER TABLE "Channel" ADD COLUMN "wallpaper" TEXT;
ALTER TABLE "Channel" ADD COLUMN "readReceipts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Channel" ADD COLUMN "createdById" TEXT;

ALTER TABLE "Channel"
  ADD CONSTRAINT "Channel_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill du createur : 1er membre admin, sinon 1er membre par anciennete
UPDATE "Channel" c
SET "createdById" = sub."userId"
FROM (
  SELECT DISTINCT ON ("channelId") "channelId", "userId"
  FROM "ChannelMember"
  ORDER BY "channelId", "isAdmin" DESC, "createdAt" ASC
) sub
WHERE sub."channelId" = c."id" AND c."createdById" IS NULL;
