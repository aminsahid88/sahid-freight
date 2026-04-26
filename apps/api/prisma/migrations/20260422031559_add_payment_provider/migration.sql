/*
  Warnings:

  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('CHAPA', 'WAAFI', 'CASH');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "method" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "country" SET DEFAULT 'ETHIOPIA';
