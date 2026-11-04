-- Additive: ELD mileage import metadata and record supersession. No drops, no renames.
ALTER TABLE "MileageImport" ADD COLUMN "periodId" TEXT;
ALTER TABLE "MileageImport" ADD COLUMN "filename" TEXT;
ALTER TABLE "MileageImport" ADD COLUMN "mappingVersion" TEXT;
ALTER TABLE "MileageImport" ADD COLUMN "fileHash" TEXT;
ALTER TABLE "MileageImport" ADD COLUMN "layout" TEXT;
ALTER TABLE "MileageImport" ADD COLUMN "distanceUnit" TEXT;
ALTER TABLE "MileageImport" ADD COLUMN "rowsSkipped" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MileageRecord" ADD COLUMN "supersededAt" TIMESTAMP(3);
ALTER TABLE "MileageRecord" ADD COLUMN "supersededByImportId" TEXT;

CREATE INDEX "MileageImport_companyId_periodId_idx" ON "MileageImport"("companyId", "periodId");
