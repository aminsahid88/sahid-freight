// Refuses to run if DATABASE_URL doesn't look like a local Postgres URL.
// Chained before db:migrate:local and db:seed:local so the local-scoped
// scripts can never accidentally hit a remote DB.
const url = process.env.DATABASE_URL || "";
if (!/(localhost|127\.0\.0\.1)/.test(url)) {
  const masked = url.replace(/:[^:@]+@/, ":***@") || "<empty>";
  console.error(
    "REFUSING: DATABASE_URL is not localhost.\n" +
      "  Got: " + masked + "\n" +
      "  This script is for local dev only. Use the regular `db:migrate` for prod."
  );
  process.exit(1);
}
console.log("✓ local DATABASE_URL ok: " + url.replace(/:[^:@]+@/, ":***@"));
