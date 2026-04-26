-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NEW_BID';
ALTER TYPE "NotificationType" ADD VALUE 'BID_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'BID_REJECTED';

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "truckOwnerId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "message" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_truckOwnerId_fkey" FOREIGN KEY ("truckOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
