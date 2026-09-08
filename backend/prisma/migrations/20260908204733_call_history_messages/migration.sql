-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'CALL');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "callId" TEXT,
ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'TEXT';

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;
