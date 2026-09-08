-- CreateEnum
CREATE TYPE "BoardStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "color" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "BoardStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "FormField" ADD COLUMN     "defaultValue" TEXT,
ADD COLUMN     "maxValue" DOUBLE PRECISION,
ADD COLUMN     "minValue" DOUBLE PRECISION,
ADD COLUMN     "pattern" TEXT,
ADD COLUMN     "placeholder" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "BoardMember" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "actionType" TEXT NOT NULL,
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardMember_userId_idx" ON "BoardMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardMember_boardId_userId_key" ON "BoardMember"("boardId", "userId");

-- CreateIndex
CREATE INDEX "Automation_workspaceId_enabled_idx" ON "Automation"("workspaceId", "enabled");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
