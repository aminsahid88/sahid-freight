-- Signup no longer requires a phone number; capture carrier company + IFTA base state.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "companyName" TEXT;
ALTER TABLE "User" ADD COLUMN "iftaBaseState" TEXT;
