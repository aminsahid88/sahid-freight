/**
 * Throwaway diagnostic: send one live OTP email via Resend and print the
 * raw API response — including the message id on success, or the full
 * error object on failure.
 *
 * The existing sendOTPEmail helper swallows Resend's `{ data, error }`
 * response into a console.log and only re-throws on network errors —
 * so a misconfigured RESEND_API_KEY or unverified domain returns "ok"
 * to its callers. This script mirrors what sendOTPEmail does, but
 * inspects the response object directly so we can see what Resend
 * actually said.
 *
 * Usage (from apps/api):
 *   npx ts-node scripts/test-email.ts you@example.com
 *
 * Loads env from apps/api/.env regardless of cwd. Remove this file
 * after diagnostics — not part of the build.
 */

import dotenv from "dotenv";
import path from "path";

// Load production env from apps/api/.env, not whatever cwd we ran from.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { Resend } from "resend";
import { sendOTPEmail } from "../src/utils/email";

const FROM = "Sahid Freight <noreply@sahidfreight.com>";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npx ts-node scripts/test-email.ts <email-address>");
    console.error("Example: npx ts-node scripts/test-email.ts you@example.com");
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;

  console.log("─── Resend config ────────────────────────");
  console.log("  RESEND_API_KEY:", apiKey ? `present (${apiKey.length} chars, prefix=${apiKey.slice(0, 4)}...)` : "(unset)");
  console.log("  from:           ", FROM);

  if (!apiKey) {
    console.error("\n❌ Missing RESEND_API_KEY — cannot send.");
    process.exit(1);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("\n─── outgoing ─────────────────────────────");
  console.log("  to:      ", to);
  console.log("  otp:     ", otp, "(throwaway — for delivery test only)");

  // ── PART A: direct Resend call so we can inspect the raw {data, error} response ──
  // Mirrors what sendOTPEmail does internally. We don't go through the helper here
  // because sendOTPEmail's return type is Promise<void> and the response gets
  // logged-then-thrown-away.
  console.log("\n─── PART A: direct Resend call (mirrors sendOTPEmail) ────");
  const resend = new Resend(apiKey);
  const start = Date.now();
  try {
    const response = await resend.emails.send({
      from: FROM,
      to,
      subject: "Sahid Freight diagnostic — delivery test",
      html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2>Sahid Freight delivery test</h2>
        <p>If you can read this, Resend → your inbox is working end-to-end.</p>
        <p><strong>Test OTP:</strong> ${otp}</p>
        <p style="color: #666; font-size: 12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    });
    const elapsed = Date.now() - start;
    console.log(`Resend returned in ${elapsed}ms — RAW RESPONSE:`);
    console.log(JSON.stringify(response, null, 2));

    console.log("\n─── interpretation ───────────────────────");
    if (response?.error) {
      console.log("  ❌ Resend API rejected the send.");
      console.log("     error.name:    ", (response.error as any).name);
      console.log("     error.message: ", (response.error as any).message);
      console.log("     (common causes: invalid API key, sender domain not verified,");
      console.log("      from address not on a verified domain, or rate-limit)");
    } else if (response?.data?.id) {
      console.log("  ✅ Resend accepted the message. id:", response.data.id);
      console.log("     Watch the destination inbox (and the spam folder).");
      console.log("     'Accepted' ≠ 'delivered' — the receiving MTA still has to land it.");
      console.log("     Cross-check delivery in the Resend dashboard → Emails → this id.");
    } else {
      console.log("  ⚠ Unexpected response shape — neither data.id nor error present.");
    }
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`\n❌ Resend call THREW after ${elapsed}ms — FULL ERROR:`);
    console.error("  message: ", err?.message);
    console.error("  code:    ", err?.code);
    console.error("  name:    ", err?.name);
    console.error("  status:  ", err?.response?.status || err?.status);
    console.error("  raw error:");
    console.error(err);
    process.exit(2);
  }

  // ── PART B: invoke the actual sendOTPEmail helper, to verify it returns
  // without throwing under the same conditions. This is the "does the helper
  // we'd wire into auth actually work" check.
  console.log("\n─── PART B: sendOTPEmail() helper call ───");
  try {
    await sendOTPEmail(to, otp);
    console.log("  ✅ sendOTPEmail returned without throwing.");
    console.log("     (Reminder: it would also have returned silently if Resend");
    console.log("      had returned { error } — see Part A for the actual verdict.)");
  } catch (err: any) {
    console.error("  ❌ sendOTPEmail threw:");
    console.error("    message:", err?.message);
    console.error("    raw error:");
    console.error(err);
    process.exit(3);
  }
}

main();
