/**
 * Human-readable error mapper. Every catch(...) in the mobile app should
 * pass its error through formatApiError so users never see raw axios
 * text, stack traces, "Network Error", null / undefined, or server
 * error codes.
 *
 * Mirrors apps/web/lib/errors.ts.
 */

type Ctx = 'auth' | 'load' | 'truck' | 'booking' | 'profile' | 'payment' | 'generic';

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';

/**
 * Turn any thrown error into a message we can safely show a user.
 *
 * @param err        The caught error (axios / fetch / thrown Error / anything).
 * @param fallback   What to say when nothing else fits. Prefer supplying a
 *                   context-specific fallback like "We couldn't post the load."
 * @param ctx        Domain hint — lets the mapper pick a better default (e.g.
 *                   "Invalid phone or password." for auth 401s instead of the
 *                   generic "Please sign in again.").
 */
export function formatApiError(
  err: unknown,
  fallback: string = GENERIC_FALLBACK,
  ctx: Ctx = 'generic',
): string {
  const e = err as any;
  const status: number | undefined = e?.response?.status;
  const rawMsg: string | undefined =
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.message;

  // ── 1. Network / connectivity ────────────────────────────────
  if (
    e?.code === 'ERR_NETWORK' ||
    e?.code === 'ENOTFOUND' ||
    (!status && /network|failed to fetch|fetch failed|net::/i.test(rawMsg || ''))
  ) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (e?.code === 'ECONNABORTED' || /timeout/i.test(rawMsg || '')) {
    return 'That took too long. Please try again.';
  }

  // ── 2. HTTP-status defaults, refined by ctx ──────────────────
  if (status === 400) {
    if (isDisplayableServerMessage(rawMsg)) return capitalize(rawMsg!);
    return 'Please check the details and try again.';
  }

  if (status === 401) {
    if (ctx === 'auth') return 'Invalid phone number or password.';
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 403) {
    if (isDisplayableServerMessage(rawMsg)) return capitalize(rawMsg!);
    if (ctx === 'auth')    return "That account isn't allowed to sign in here.";
    if (ctx === 'load')    return "You don't have permission to change this load.";
    if (ctx === 'booking') return "You don't have permission to update this booking.";
    if (ctx === 'truck')   return "You don't have permission to change this truck.";
    return "You don't have permission to do that.";
  }

  if (status === 404) {
    if (ctx === 'load')    return "This load couldn't be found. It may have been removed.";
    if (ctx === 'booking') return "This booking couldn't be found.";
    if (ctx === 'truck')   return "This truck couldn't be found.";
    if (ctx === 'profile') return 'Account not found.';
    return "We couldn't find what you were looking for.";
  }

  if (status === 409) {
    if (isDisplayableServerMessage(rawMsg)) return capitalize(rawMsg!);
    if (ctx === 'auth')    return 'An account with that phone number already exists.';
    if (ctx === 'booking') return 'This load has already been booked.';
    return 'That already exists.';
  }

  if (status === 422) {
    if (isDisplayableServerMessage(rawMsg)) return capitalize(rawMsg!);
    return "Some fields aren't quite right. Please check them and try again.";
  }

  if (status === 429) {
    return "You're going a little too fast. Please wait a moment and try again.";
  }

  if (status && status >= 500) {
    return 'Our servers are having trouble. Please try again in a moment.';
  }

  // ── 3. Server did send a message and it looks user-safe ──────
  if (isDisplayableServerMessage(rawMsg)) return capitalize(rawMsg!);

  // ── 4. Nothing usable → the caller's contextual fallback ─────
  return fallback;
}

function isDisplayableServerMessage(msg: string | undefined): msg is string {
  if (!msg) return false;
  const t = msg.trim();
  if (!t) return false;
  if (/^undefined$|^null$/i.test(t)) return false;
  if (/^internal server error$/i.test(t)) return false;
  if (/^\[.*\]$/.test(t)) return false;
  if (/^\{.*\}$/.test(t)) return false;
  if (/failed to fetch|network error|econnaborted/i.test(t)) return false;
  if (t.length > 200) return false;
  return true;
}

function capitalize(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
