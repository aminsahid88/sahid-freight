-- AlterTable
ALTER TABLE "Bid" ADD COLUMN "truckId" TEXT;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
