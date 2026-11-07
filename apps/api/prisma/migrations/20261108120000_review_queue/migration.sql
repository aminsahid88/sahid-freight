-- Additive: review claims, reviewer sessions, approval workflow columns. No drops, no renames.
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Transaction" ADD COLUMN "reviewClaimedBy" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "reviewClaimedAt" TIMESTAMP(3);

ALTER TABLE "Approval" ADD COLUMN "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Approval" ADD COLUMN "payload" JSONB;
ALTER TABLE "Approval" ADD COLUMN "decidedBy" TEXT;
ALTER TABLE "Approval" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "Approval" ADD COLUMN "note" TEXT;
CREATE INDEX "Approval_companyId_status_idx" ON "Approval"("companyId", "status");

CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "seconds" INTEGER,
    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewSession_companyId_transactionId_idx" ON "ReviewSession"("companyId", "transactionId");
CREATE INDEX "ReviewSession_userId_endedAt_idx" ON "ReviewSession"("userId", "endedAt");
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
