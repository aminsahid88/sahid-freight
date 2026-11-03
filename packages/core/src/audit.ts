/**
 * Audit-log vocabulary. The list is closed so that reports and tests can rely
 * on it; add an action here (and a test) before logging it anywhere.
 */
export const AUDIT_ACTIONS = [
  "login",
  "login_failed",
  "logout",
  "upload",
  "view_document",
  "edit",
  "approve",
  "export",
  "delete_request",
  "break_glass",
  "company_created",
  "member_added",
  "member_removed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
