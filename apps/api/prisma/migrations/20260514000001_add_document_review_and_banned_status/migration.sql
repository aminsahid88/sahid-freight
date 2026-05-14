-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'BANNED';

-- AlterTable
ALTER TABLE "VerificationDocument" ADD COLUMN "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);
