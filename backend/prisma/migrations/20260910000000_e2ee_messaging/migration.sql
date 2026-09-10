-- Chiffrement de bout en bout de la messagerie (DM + groupes privés).

-- User : identité cryptographique
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cryptoPublicKey" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cryptoPrivateKeyEnc" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cryptoKeyCreatedAt" TIMESTAMP(3);

-- Channel : état du chiffrement
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "e2ee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "e2eeVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "e2eeSince" TIMESTAMP(3);

-- Message : charge chiffrée
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "encrypted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "iv" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "keyVersion" INTEGER;

-- ChannelKey : clé de conversation chiffrée par membre / par version
CREATE TABLE IF NOT EXISTS "ChannelKey" (
  "id"                 TEXT NOT NULL,
  "channelId"          TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "version"            INTEGER NOT NULL,
  "ephemeralPublicKey" TEXT NOT NULL,
  "iv"                 TEXT NOT NULL,
  "wrappedKey"         TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelKey_channelId_userId_version_key" ON "ChannelKey"("channelId", "userId", "version");
CREATE INDEX IF NOT EXISTS "ChannelKey_userId_idx" ON "ChannelKey"("userId");
DO $$ BEGIN
  ALTER TABLE "ChannelKey" ADD CONSTRAINT "ChannelKey_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ChannelKey" ADD CONSTRAINT "ChannelKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
