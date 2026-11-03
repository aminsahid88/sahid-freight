-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'STAFF', 'DRIVER', 'REVIEWER', 'PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEB', 'PWA', 'MOBILE', 'EMAIL', 'SMS', 'WHATSAPP', 'FUEL_CARD_IMPORT', 'ELD_IMPORT');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'UNREADABLE');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('VERIFIED', 'NEEDS_ATTENTION', 'UNABLE_TO_VERIFY');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('FUEL', 'EXPENSE', 'REFUND', 'CREDIT', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LineCategory" AS ENUM ('MOTOR_FUEL', 'REEFER_FUEL', 'DEF', 'NON_FUEL', 'TAX', 'FEE', 'DISCOUNT', 'CREDIT');

-- CreateEnum
CREATE TYPE "Corroboration" AS ENUM ('SINGLE_SOURCE', 'TWO_PASS', 'RECEIPT_AND_CARD', 'HUMAN_CONFIRMED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "Legibility" AS ENUM ('CLEAR', 'PARTIAL', 'UNREADABLE');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PERIOD_PDF', 'TRANSACTIONS_CSV', 'SUPPORT_ZIP', 'IFTA_WORKSHEET');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PRELIMINARY', 'REVIEWED');

-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('QUEUED', 'APPROVED', 'EXECUTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Country" ADD VALUE 'USA';

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPartner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "dba" TEXT,
    "usdot" TEXT,
    "mcNumber" TEXT,
    "iftaBaseJurisdiction" TEXT,
    "iftaAccountEnc" TEXT,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "inboundEmailSlug" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "vin" TEXT,
    "plate" TEXT,
    "axles" INTEGER,
    "iftaQualified" BOOLEAN NOT NULL DEFAULT true,
    "tankCapacityGal" DECIMAL(12,3),
    "eldProvider" TEXT,
    "activeFrom" TIMESTAMP(3),
    "activeTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "userId" TEXT,
    "defaultVehicleId" TEXT,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "PeriodType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "channel" "Channel" NOT NULL,
    "sender" TEXT NOT NULL,
    "rawEnvelope" JSONB NOT NULL,
    "attribution" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "batchId" TEXT,
    "intakeMessageId" TEXT,
    "channel" "Channel" NOT NULL,
    "uploadedById" TEXT,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'RECEIVED',
    "isExactDuplicateOf" TEXT,
    "qualityScore" DECIMAL(4,3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRegion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "bbox" JSONB,

    CONSTRAINT "DocumentRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionRun" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "pass" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DECIMAL(10,5),
    "latencyMs" INTEGER,
    "status" "JobStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawText" TEXT,
    "value" TEXT,
    "confidence" DECIMAL(4,3),
    "legibility" "Legibility" NOT NULL,
    "bbox" JSONB,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT,
    "regionId" TEXT,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "type" "TxType" NOT NULL DEFAULT 'UNKNOWN',
    "date" DATE,
    "time" TEXT,
    "vendor" TEXT,
    "sellerAddress" TEXT,
    "state" TEXT,
    "stateSource" TEXT,
    "unitNumberRaw" TEXT,
    "odometer" DECIMAL(12,1),
    "paymentMethod" TEXT,
    "cardLast4" TEXT,
    "receiptTotal" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'USD',
    "iftaTaxableGallons" DECIMAL(12,3),
    "status" "TxStatus" NOT NULL DEFAULT 'NEEDS_ATTENTION',
    "corroboration" "Corroboration" NOT NULL DEFAULT 'SINGLE_SOURCE',
    "provenance" JSONB NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLine" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "descriptionRaw" TEXT NOT NULL,
    "category" "LineCategory" NOT NULL,
    "fuelType" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "unitPrice" DECIMAL(12,4),
    "amount" DECIMAL(12,2),

    CONSTRAINT "TransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelCardImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "documentId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelCardImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelCardTransaction" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "location" TEXT,
    "state" TEXT,
    "unitNumber" TEXT,
    "cardLast4" TEXT,
    "fuelType" TEXT,
    "gallons" DECIMAL(12,3),
    "amount" DECIMAL(12,2),
    "raw" JSONB NOT NULL,

    CONSTRAINT "FuelCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MileageImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "documentId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MileageRecord" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalMiles" DECIMAL(12,3) NOT NULL,
    "taxableMiles" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "MileageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "cardTransactionId" TEXT NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "fieldsUsed" JSONB NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transactionId" TEXT,
    "documentId" TEXT,
    "code" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,
    "fields" TEXT[],
    "evidence" JSONB NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldEdit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedById" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "iftaMember" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "IftaRate" (
    "id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    "rate" DECIMAL(10,5) NOT NULL,
    "surcharge" DECIMAL(10,5),
    "sourceUrl" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IftaRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationDirectory" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "storeNo" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "StationDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "companyId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_inboundEmailSlug_key" ON "Company"("inboundEmailSlug");

-- CreateIndex
CREATE INDEX "Membership_companyId_idx" ON "Membership"("companyId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_companyId_role_key" ON "Membership"("userId", "companyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_companyId_unitNumber_key" ON "Vehicle"("companyId", "unitNumber");

-- CreateIndex
CREATE INDEX "Driver_companyId_idx" ON "Driver"("companyId");

-- CreateIndex
CREATE INDEX "Driver_companyId_phone_idx" ON "Driver"("companyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingPeriod_companyId_type_startDate_key" ON "ReportingPeriod"("companyId", "type", "startDate");

-- CreateIndex
CREATE INDEX "IntakeMessage_companyId_receivedAt_idx" ON "IntakeMessage"("companyId", "receivedAt");

-- CreateIndex
CREATE INDEX "Batch_companyId_createdAt_idx" ON "Batch"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_companyId_sha256_idx" ON "Document"("companyId", "sha256");

-- CreateIndex
CREATE INDEX "Document_companyId_receivedAt_idx" ON "Document"("companyId", "receivedAt");

-- CreateIndex
CREATE INDEX "Document_companyId_status_idx" ON "Document"("companyId", "status");

-- CreateIndex
CREATE INDEX "DocumentRegion_documentId_idx" ON "DocumentRegion"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionRun_regionId_pass_modelId_promptVersion_key" ON "ExtractionRun"("regionId", "pass", "modelId", "promptVersion");

-- CreateIndex
CREATE INDEX "ExtractedField_runId_idx" ON "ExtractedField"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_regionId_key" ON "Transaction"("regionId");

-- CreateIndex
CREATE INDEX "Transaction_companyId_date_idx" ON "Transaction"("companyId", "date");

-- CreateIndex
CREATE INDEX "Transaction_companyId_state_idx" ON "Transaction"("companyId", "state");

-- CreateIndex
CREATE INDEX "Transaction_companyId_status_idx" ON "Transaction"("companyId", "status");

-- CreateIndex
CREATE INDEX "TransactionLine_transactionId_idx" ON "TransactionLine"("transactionId");

-- CreateIndex
CREATE INDEX "FuelCardImport_companyId_importedAt_idx" ON "FuelCardImport"("companyId", "importedAt");

-- CreateIndex
CREATE INDEX "FuelCardTransaction_companyId_date_idx" ON "FuelCardTransaction"("companyId", "date");

-- CreateIndex
CREATE INDEX "MileageImport_companyId_importedAt_idx" ON "MileageImport"("companyId", "importedAt");

-- CreateIndex
CREATE INDEX "MileageRecord_companyId_vehicleId_periodStart_idx" ON "MileageRecord"("companyId", "vehicleId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Match_transactionId_cardTransactionId_key" ON "Match"("transactionId", "cardTransactionId");

-- CreateIndex
CREATE INDEX "Issue_companyId_status_idx" ON "Issue"("companyId", "status");

-- CreateIndex
CREATE INDEX "Issue_documentId_idx" ON "Issue"("documentId");

-- CreateIndex
CREATE INDEX "Issue_transactionId_idx" ON "Issue"("transactionId");

-- CreateIndex
CREATE INDEX "FieldEdit_companyId_entity_entityId_idx" ON "FieldEdit"("companyId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "Approval_companyId_target_targetId_idx" ON "Approval"("companyId", "target", "targetId");

-- CreateIndex
CREATE INDEX "DeletionRequest_companyId_status_idx" ON "DeletionRequest"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IftaRate_quarter_jurisdiction_fuelType_key" ON "IftaRate"("quarter", "jurisdiction", "fuelType");

-- CreateIndex
CREATE INDEX "StationDirectory_brand_storeNo_idx" ON "StationDirectory"("brand", "storeNo");

-- CreateIndex
CREATE INDEX "Report_companyId_periodId_idx" ON "Report"("companyId", "periodId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_companyId_key_key" ON "Setting"("companyId", "key");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_defaultVehicleId_fkey" FOREIGN KEY ("defaultVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingPeriod" ADD CONSTRAINT "ReportingPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_intakeMessageId_fkey" FOREIGN KEY ("intakeMessageId") REFERENCES "IntakeMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRegion" ADD CONSTRAINT "DocumentRegion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "DocumentRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExtractionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "DocumentRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLine" ADD CONSTRAINT "TransactionLine_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelCardImport" ADD CONSTRAINT "FuelCardImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelCardTransaction" ADD CONSTRAINT "FuelCardTransaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "FuelCardImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageImport" ADD CONSTRAINT "MileageImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageRecord" ADD CONSTRAINT "MileageRecord_importId_fkey" FOREIGN KEY ("importId") REFERENCES "MileageImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageRecord" ADD CONSTRAINT "MileageRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_cardTransactionId_fkey" FOREIGN KEY ("cardTransactionId") REFERENCES "FuelCardTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldEdit" ADD CONSTRAINT "FieldEdit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldEdit" ADD CONSTRAINT "FieldEdit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Append-only audit log: reject UPDATE and DELETE at the database level so no
-- application bug, script or console session can rewrite history.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only (% on id=%)', TG_OP, COALESCE(OLD.id, '?')
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

-- Documents inside their retention window cannot be hard-deleted, whatever the caller.
CREATE OR REPLACE FUNCTION document_retention_guard() RETURNS trigger AS $$
BEGIN
  IF OLD."retentionUntil" > NOW() THEN
    RAISE EXCEPTION 'Document % is under retention until %; use a DeletionRequest', OLD.id, OLD."retentionUntil"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_no_delete_in_retention
  BEFORE DELETE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION document_retention_guard();
