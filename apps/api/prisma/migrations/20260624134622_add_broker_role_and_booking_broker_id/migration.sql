-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BROKER';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "brokerId" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
