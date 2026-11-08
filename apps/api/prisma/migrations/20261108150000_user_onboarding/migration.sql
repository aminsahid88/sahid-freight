-- Additive: first-run tour state per user.
ALTER TABLE "User" ADD COLUMN "onboarding" JSONB;
