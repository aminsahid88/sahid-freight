-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleId" TEXT,
ADD COLUMN "appleId" TEXT,
ADD COLUMN "pushToken" TEXT;

-- Make passwordHash nullable (for social auth users)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Make country and city have defaults (for social auth minimal signup)
ALTER TABLE "User" ALTER COLUMN "city" SET DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");
