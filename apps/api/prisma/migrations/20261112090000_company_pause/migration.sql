-- Additive: a platform admin can pause a company from the control room.
-- Nullable columns, no defaults, no data rewritten.
ALTER TABLE "Company" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "pausedReason" TEXT;
ALTER TABLE "Company" ADD COLUMN "pausedById" TEXT;
