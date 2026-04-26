-- AlterTable User: add licenseNumber
ALTER TABLE "User" ADD COLUMN "licenseNumber" TEXT;

-- AlterTable Truck: add driverId
ALTER TABLE "Truck" ADD COLUMN "driverId" TEXT;

-- AddForeignKey Truck.driverId -> User.id
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
