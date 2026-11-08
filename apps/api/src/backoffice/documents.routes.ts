/**
 * Documents: the Phase 0 gate. upload → stored immutably → visible with its
 * SHA-256, status and an audit entry.
 *
 * POST   /companies/:companyId/documents            multipart `files[]`, up to MAX_FILES_PER_BATCH
 * GET    /companies/:companyId/documents            list (newest first)
 * GET    /companies/:companyId/documents/:id        detail + short-lived signed URL (audited as view_document)
 * POST   /companies/:companyId/documents/:id/deletion-requests   queue a deletion (never a hard delete)
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { retentionUntil, sanitizeFilename, sha256Hex, validateUploadContent } from "@tbo/core";
import { audit } from "../audit/log";
import type { Env } from "../config/env";
import { enqueue } from "../jobs/queue";
import { PREPROCESS_STEP, PREPROCESS_VERSION } from "../jobs/processors/preprocess";
import { EXTRACTABLE_MIMES } from "@tbo/extraction";
import { requeueExtraction } from "../jobs/extraction";
import { protect } from "../middleware/auth.middleware";
import { documentStorageKey, type Storage } from "../storage";
import { badRequest, notFound, parse, wrap } from "./errors";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";

export const D001_VERSION = "d001-v1";

const listQuery = z.object({
  status: z.enum(["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "UNREADABLE"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});

const deletionSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export interface UploadedFileResult {
  id: string;
  filename: string;
  sha256: string;
  status: string;
  isExactDuplicateOf: string | null;
}

export interface RejectedFileResult {
  filename: string;
  reason: string;
}

export function documentsRouter(prisma: PrismaClient, storage: Storage, env: Env): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: env.MAX_FILES_PER_BATCH },
  });

  r.post(
    "/",
    requireCompany(prisma, "OWNER", "STAFF", "DRIVER", "PARTNER", "ADMIN"),
    upload.array("files", env.MAX_FILES_PER_BATCH),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) throw badRequest("No files received. Send one or more files in the `files` field.");

      const channel = req.header("x-channel") === "MOBILE" ? "MOBILE" : "WEB";
      // Optional truck hint from the uploader (capture app "which truck?"); must be one of the company's vehicles.
      const vehicleHint = typeof req.body?.vehicleId === "string" && req.body.vehicleId ? String(req.body.vehicleId) : null;
      if (vehicleHint) {
        const v = await db.vehicle.findUnique({ where: { id: vehicleHint }, select: { id: true } });
        if (!v) throw badRequest("vehicleId is not a vehicle of this company");
      }
      const batch = await db.batch.create({ data: { createdBy: userId, channel, fileCount: files.length } as never });

      const uploaded: UploadedFileResult[] = [];
      const rejected: RejectedFileResult[] = [];

      for (const file of files) {
        const check = validateUploadContent(file.mimetype, file.buffer);
        if (!check.ok) {
          rejected.push({ filename: file.originalname, reason: check.reason });
          continue;
        }
        const sha256 = sha256Hex(file.buffer);
        const documentId = randomUUID();
        const storageKey = documentStorageKey(company.id, documentId, check.extension);
        const receivedAt = new Date();

        // Exact duplicate (D001): still stored and linked, but flagged.
        const earlier = await db.document.findFirst({ where: { sha256, deletedAt: null }, orderBy: { receivedAt: "asc" }, select: { id: true } });

        await storage.put(storageKey, file.buffer, check.mime);
        const doc = await db.document.create({
          data: {
            id: documentId,
            batchId: batch.id,
            channel,
            uploadedById: userId,
            storageKey,
            filename: sanitizeFilename(file.originalname),
            mimeType: check.mime,
            sizeBytes: file.size,
            sha256,
            receivedAt,
            retentionUntil: retentionUntil(receivedAt, env.RETENTION_YEARS),
            isExactDuplicateOf: earlier?.id ?? null,
            vehicleId: vehicleHint,
          } as never,
        });

        if (earlier) {
          await db.issue.create({
            data: {
              documentId: doc.id,
              code: "D001",
              ruleVersion: D001_VERSION,
              severity: "WARNING",
              message: `Exact duplicate of an earlier upload (same SHA-256)`,
              fields: ["sha256"],
              evidence: { sha256, duplicateOf: earlier.id },
            } as never,
          });
        }

        await audit(db, {
          action: "upload",
          userId,
          target: `Document:${doc.id}`,
          meta: { filename: doc.filename, sha256, sizeBytes: doc.sizeBytes, mimeType: doc.mimeType, batchId: batch.id, channel },
          ip: req.ip,
        });
        await enqueue(prisma, { step: PREPROCESS_STEP, version: PREPROCESS_VERSION, companyId: company.id, payload: { documentId: doc.id } });

        uploaded.push({ id: doc.id, filename: doc.filename, sha256, status: doc.status, isExactDuplicateOf: doc.isExactDuplicateOf });
      }

      await db.batch.update({ where: { id: batch.id }, data: { fileCount: uploaded.length, status: uploaded.length ? "DONE" : "FAILED" } });
      res.status(uploaded.length ? 201 : 400).json({ batchId: batch.id, uploaded, rejected });
    }),
  );

  r.get(
    "/",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company } = ctx(req);
      const q = parse(listQuery, req.query, "query");
      const where = {
        ...(q.status ? { status: q.status } : {}),
        ...(q.includeDeleted ? {} : { deletedAt: null }),
        ...(company.role === "DRIVER" ? { uploadedById: req.user!.userId } : {}),
      };
      const rows = await db.document.findMany({
        where,
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        include: { issues: { where: { status: "OPEN" }, select: { code: true, severity: true, message: true } }, uploadedBy: { select: { id: true, fullName: true } } },
      });
      const hasMore = rows.length > q.limit;
      const documents = rows.slice(0, q.limit);
      res.json({ documents, nextCursor: hasMore ? documents[documents.length - 1]!.id : null });
    }),
  );

  r.get(
    "/:documentId",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const doc = await db.document.findUnique({
        where: { id: req.params.documentId as string },
        include: {
          issues: { select: { id: true, code: true, severity: true, message: true, status: true, evidence: true } },
          uploadedBy: { select: { id: true, fullName: true } },
          batch: true,
          // Extraction trail: which passes ran, with which model, at what cost; the transaction each region became.
          regions: {
            orderBy: { page: "asc" },
            select: {
              id: true,
              page: true,
              runs: { select: { pass: true, modelId: true, promptVersion: true, status: true, costUsd: true, latencyMs: true, inputTokens: true, outputTokens: true, createdAt: true }, orderBy: { pass: "asc" } },
              transaction: { select: { id: true, status: true, vendor: true, receiptTotal: true } },
            },
          },
        },
      });
      if (!doc || (company.role === "DRIVER" && doc.uploadedById !== userId)) throw notFound("Document");
      const signedUrl = doc.deletedAt ? null : await storage.getSignedUrl(doc.storageKey, env.SIGNED_URL_TTL_SECONDS);
      await audit(db, { action: "view_document", userId, target: `Document:${doc.id}`, ip: req.ip });
      res.json({ document: doc, signedUrl, signedUrlExpiresInSeconds: env.SIGNED_URL_TTL_SECONDS });
    }),
  );

  /** Re-read a receipt with the current models and prompts (e.g. after a prompt fix). Human corrections are never overwritten. */
  r.post(
    "/:documentId/reprocess",
    requireCompany(prisma, "OWNER", "STAFF", "REVIEWER", "PARTNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const doc = await db.document.findUnique({ where: { id: req.params.documentId as string }, select: { id: true, mimeType: true, status: true } });
      if (!doc) throw notFound("Document");
      if (!EXTRACTABLE_MIMES.has(doc.mimeType)) throw badRequest("This document type is not read by the extraction pipeline");
      const edited = await db.fieldEdit.count({ where: { entity: "Transaction", entityId: { in: (await db.transaction.findMany({ where: { region: { documentId: doc.id } }, select: { id: true } })).map((t) => t.id) } } });
      if (edited > 0) {
        res.status(409).json({ error: "human_edited", message: "This receipt was corrected by hand; re-reading would not change it. Use the field actions instead." });
        return;
      }
      const jobs = await requeueExtraction(prisma, env, company.id, doc.id);
      await audit(db, { action: "reprocess", userId, target: `Document:${doc.id}`, meta: { jobs: jobs.map((j) => ({ step: j.step, created: j.created })) }, ip: req.ip });
      res.status(202).json({ documentId: doc.id, jobs, queued: jobs.some((j) => j.created) });
    }),
  );

  r.post(
    "/:documentId/deletion-requests",
    requireCompany(prisma, "OWNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const body = parse(deletionSchema, req.body, "deletion request");
      const doc = await db.document.findUnique({ where: { id: req.params.documentId as string } });
      if (!doc) throw notFound("Document");
      const request = await db.deletionRequest.create({
        data: { entity: "Document", entityId: doc.id, reason: body.reason, retentionUntil: doc.retentionUntil, requestedById: userId } as never,
      });
      await audit(db, { action: "delete_request", userId, target: `Document:${doc.id}`, meta: { deletionRequestId: request.id, retentionUntil: doc.retentionUntil }, ip: req.ip });
      const underRetention = doc.retentionUntil.getTime() > Date.now();
      res.status(202).json({
        deletionRequest: request,
        message: underRetention
          ? `This document must be kept until ${doc.retentionUntil.toISOString().slice(0, 10)} (IFTA 4-year rule). The request is queued and will be reviewed; nothing is deleted now.`
          : "Deletion request queued for review.",
      });
    }),
  );

  return r;
}
