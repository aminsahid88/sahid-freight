-- Add rating fields to Booking
ALTER TABLE "Booking" ADD COLUMN "senderRating"  INTEGER;
ALTER TABLE "Booking" ADD COLUMN "ownerRating"   INTEGER;
ALTER TABLE "Booking" ADD COLUMN "senderComment" TEXT;
ALTER TABLE "Booking" ADD COLUMN "ownerComment"  TEXT;
ALTER TABLE "Booking" ADD COLUMN "senderRatedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "ownerRatedAt"  TIMESTAMP(3);

-- Add average rating fields to User
ALTER TABLE "User" ADD COLUMN "averageRating" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "totalRatings"  INTEGER NOT NULL DEFAULT 0;
