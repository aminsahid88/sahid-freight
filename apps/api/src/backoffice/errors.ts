/**
 * HTTP error plumbing for the back-office routes: typed errors, a zod
 * validation helper, an async wrapper, and the single JSON error handler.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { MulterError } from "multer";
import { type ZodType, z } from "zod";
import { AppendOnlyError, HardDeleteForbiddenError, TenantScopeError } from "../tenant/client";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "error",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`, "not_found");
export const forbidden = (message = "You do not have access to this company") => new HttpError(403, message, "forbidden");
export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, "bad_request", details);

/** Parse with zod or throw a 400 listing each field problem. */
export function parse<T extends ZodType>(schema: T, input: unknown, what = "request"): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(400, `Invalid ${what}: ${details.map((d) => `${d.path || "body"} ${d.message}`).join("; ")}`, "validation", details);
  }
  return result.data;
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Route errors into the error handler instead of hanging the request. */
export const wrap =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

function isMulterError(err: unknown): err is MulterError {
  return !!err && typeof err === "object" && (err as { name?: string }).name === "MulterError";
}

/** JSON error responses; never leaks stack traces to clients. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  if (isMulterError(err)) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "A file is larger than the allowed size" : `Upload rejected: ${err.message}`;
    res.status(400).json({ error: "upload_rejected", message });
    return;
  }
  if (err instanceof TenantScopeError || err instanceof HardDeleteForbiddenError || err instanceof AppendOnlyError) {
    // These are programming errors on our side: log loudly, answer safely.
    console.error(`[invariant] ${req.method} ${req.originalUrl}:`, err.message);
    res.status(500).json({ error: "invariant_violation", message: "Request refused by a safety check" });
    return;
  }
  console.error(`[unhandled] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: "internal", message: "Something went wrong. Please try again." });
}
