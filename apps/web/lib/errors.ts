// Shared error formatter — mirrors apps/mobile/src/lib/errors.ts.
// Picks the cleanest user-facing string out of an axios-style error.

export function formatApiError(err: any, fallback = "Something went wrong. Please try again."): string {
  const msg = err?.response?.data?.message || err?.message;
  if (!msg) return fallback;
  const status = err?.response?.status;
  if (status === 500) return `${msg} (server error)`;
  return msg;
}
