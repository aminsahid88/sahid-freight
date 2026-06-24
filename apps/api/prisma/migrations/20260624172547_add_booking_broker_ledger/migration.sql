-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "brokerCollectedAt" TIMESTAMP(3),
ADD COLUMN     "brokerCutAmount" DOUBLE PRECISION,
ADD COLUMN     "ownerPaidOutAt" TIMESTAMP(3),
ADD COLUMN     "ownerPayoutAmount" DOUBLE PRECISION;
