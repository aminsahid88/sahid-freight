/**
 * Pure state machine for the offline upload queue (no I/O, unit-tested).
 * Items are created when the driver taps "Send", persisted immediately, and
 * uploaded whenever the network allows. Failures that are not the server's
 * verdict (offline, timeouts) stay pending; server rejections are terminal.
 */

export type QueueStatus = "pending" | "uploading" | "done" | "rejected";

export interface QueueItem {
  id: string;
  companyId: string;
  /** Local copy of the photo/file (app's document directory). */
  localUri: string;
  name: string;
  mimeType: string;
  bytes: number;
  vehicleId: string | null;
  createdAt: string;
  status: QueueStatus;
  attempts: number;
  lastError: string | null;
  /** Set once the server accepted it. */
  documentId: string | null;
  nextAttemptAt: string | null;
}

export const MAX_ATTEMPTS = 20;

export function backoffMs(attempt: number): number {
  return Math.min(10 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

export function createItem(input: Omit<QueueItem, "status" | "attempts" | "lastError" | "documentId" | "nextAttemptAt" | "createdAt"> & { createdAt?: string }): QueueItem {
  return { ...input, createdAt: input.createdAt ?? new Date().toISOString(), status: "pending", attempts: 0, lastError: null, documentId: null, nextAttemptAt: null };
}

/** Items that may be uploaded now, oldest first. */
export function runnable(items: QueueItem[], now: Date = new Date()): QueueItem[] {
  return items
    .filter((i) => i.status === "pending" && (!i.nextAttemptAt || new Date(i.nextAttemptAt).getTime() <= now.getTime()))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function markUploading(items: QueueItem[], id: string): QueueItem[] {
  return items.map((i) => (i.id === id ? { ...i, status: "uploading", attempts: i.attempts + 1 } : i));
}

export function markDone(items: QueueItem[], id: string, documentId: string): QueueItem[] {
  return items.map((i) => (i.id === id ? { ...i, status: "done", documentId, lastError: null, nextAttemptAt: null } : i));
}

/** Network-type failure: keep pending with backoff, unless attempts are exhausted. */
export function markRetry(items: QueueItem[], id: string, error: string, now: Date = new Date()): QueueItem[] {
  return items.map((i) => {
    if (i.id !== id) return i;
    const exhausted = i.attempts >= MAX_ATTEMPTS;
    return { ...i, status: exhausted ? "rejected" : "pending", lastError: error, nextAttemptAt: exhausted ? null : new Date(now.getTime() + backoffMs(i.attempts)).toISOString() };
  });
}

/** The server answered and said no (bad file, no permission): do not retry automatically. */
export function markRejected(items: QueueItem[], id: string, error: string): QueueItem[] {
  return items.map((i) => (i.id === id ? { ...i, status: "rejected", lastError: error, nextAttemptAt: null } : i));
}

/** Manual retry from the UI resets the clock but keeps the attempt count for the record. */
export function retryNow(items: QueueItem[], id: string): QueueItem[] {
  return items.map((i) => (i.id === id && i.status !== "done" ? { ...i, status: "pending", nextAttemptAt: null } : i));
}

/** Done items older than `keepDays` can be dropped from local storage (the server has them). */
export function prune(items: QueueItem[], now: Date = new Date(), keepDays = 7): { keep: QueueItem[]; dropped: QueueItem[] } {
  const cutoff = now.getTime() - keepDays * 86_400_000;
  const keep: QueueItem[] = [];
  const dropped: QueueItem[] = [];
  for (const i of items) (i.status === "done" && new Date(i.createdAt).getTime() < cutoff ? dropped : keep).push(i);
  return { keep, dropped };
}

export function counts(items: QueueItem[]): Record<QueueStatus, number> {
  const out: Record<QueueStatus, number> = { pending: 0, uploading: 0, done: 0, rejected: 0 };
  for (const i of items) out[i.status]++;
  return out;
}
