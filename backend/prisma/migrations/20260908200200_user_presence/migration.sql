-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE', 'AWAY', 'BUSY', 'INVISIBLE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "presenceStatus" "PresenceStatus" NOT NULL DEFAULT 'ONLINE';
