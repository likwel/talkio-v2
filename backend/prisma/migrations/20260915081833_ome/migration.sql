-- DropIndex
DROP INDEX "FormAssignee_userId_respondedAt_idx";

-- DropIndex
DROP INDEX "Message_formId_idx";

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BudgetLine" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FeedbackEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Lesson" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PeriodReport" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QualitativeInquiry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Risk" ALTER COLUMN "updatedAt" DROP DEFAULT;
