/**
 * Throwaway diagnostic: send one live SMS via Africa's Talking and print the
 * raw response — including per-recipient status, cost, and statusCode.
 *
 * This MIRRORS apps/api/src/utils/sms.ts exactly (same SDK init, same env vars,
 * same phone normalisation, same `from`) — except it does NOT swallow errors,
 * so we can actually see what AT says.
 *
 * Usage (from apps/api):
 *   npx ts-node scripts/test-sms.ts +251911234567
 *
 * Loads env from apps/api/.env regardless of cwd.
 *
 * Remove this file after diagnostics — not part of the build.
 */

import dotenv from "dotenv";
import path from "path";

// Load production env from apps/api/.env, not whatever cwd we ran from.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// eslint-disable-next-line @typescript-eslint/no-var-requires
import AfricasTalking from "africastalking";

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error("Usage: npx ts-node scripts/test-sms.ts <+E164phone>");
    console.error("Example: npx ts-node scripts/test-sms.ts +251911234567");
    process.exit(1);
  }

  const apiKey   = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  const senderId = process.env.AT_SENDER_ID;

  console.log("─── AT config ─────────────────────────────");
  console.log("  AT_USERNAME:    ", username || "(unset)");
  console.log("  AT_SENDER_ID:   ", senderId || "(unset — will use AT default)");
  console.log("  AT_API_KEY:     ", apiKey ? `present (${apiKey.length} chars, prefix=${apiKey.slice(0, 5)}...)` : "(unset)");

  if (!apiKey || !username) {
    console.error("\n❌ Missing AT_API_KEY or AT_USERNAME — cannot send.");
    process.exit(1);
  }

  const at = AfricasTalking({ apiKey, username });
  const sms = (at as any).SMS;

  // Match sms.ts normalisation exactly.
  const normalised = phone.startsWith("+") ? phone : `+${phone}`;
  const message = `SahidFreight diagnostic — ${new Date().toISOString().slice(11, 19)} UTC`;

  const options: { to: string[]; message: string; from?: string } = {
    to: [normalised],
    message,
  };
  // if (senderId) options.from = senderId; // DIAGNOSTIC: disabled to test AT default numeric sender (no approval needed)

  console.log("\n─── outgoing ─────────────────────────────");
  console.log("  to:      ", normalised);
  console.log("  from:    ", options.from || "(AT default)");
  console.log("  message: ", message);
  console.log("  length:  ", message.length, "chars");

  console.log("\n─── calling AT sms.send() ────────────────");
  const start = Date.now();
  try {
    const response = await sms.send(options as any);
    const elapsed = Date.now() - start;
    console.log(`✅ AT returned in ${elapsed}ms — RAW RESPONSE:`);
    console.log(JSON.stringify(response, null, 2));

    // Decode the bits that matter.
    const data = (response as any)?.SMSMessageData;
    console.log("\n─── parsed ───────────────────────────────");
    console.log("  summary:    ", data?.Message || "(no summary)");
    const recipients = data?.Recipients || [];
    if (recipients.length === 0) {
      console.log("  recipients: (none — AT accepted nothing)");
    } else {
      console.log("  recipients:");
      for (const r of recipients) {
        console.log(`    • ${r.number}`);
        console.log(`      status:     "${r.status}"`);
        console.log(`      statusCode: ${r.statusCode}    ${decodeStatus(r.statusCode)}`);
        console.log(`      cost:       ${r.cost}`);
        console.log(`      messageId:  ${r.messageId}`);
      }
    }

    console.log("\n─── interpretation ───────────────────────");
    const allSuccess = recipients.length > 0 && recipients.every((r: any) => r.statusCode === 101 || r.statusCode === 102);
    if (allSuccess) {
      console.log("  ✅ AT accepted the message. Watch the destination phone for delivery.");
      console.log("     (Note: 'accepted' ≠ 'delivered' — the carrier still has to land it.)");
    } else if (recipients.length === 0) {
      console.log("  ⚠ AT returned 0 recipients. The request was processed but nothing was queued.");
      console.log("    Common causes: invalid phone format, sender ID not approved for country, billing block.");
    } else {
      console.log("  ❌ At least one recipient failed at AT. See statusCode above.");
    }
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`\n❌ AT call THREW after ${elapsed}ms — FULL ERROR:`);
    console.error("  message: ", err?.message);
    console.error("  code:    ", err?.code);
    console.error("  status:  ", err?.response?.status || err?.status);
    console.error("  response.data: ", err?.response?.data);
    console.error("  raw error:");
    console.error(err);
    process.exit(2);
  }
}

// AT status codes per https://developers.africastalking.com/docs/sms/sending/bulk
function decodeStatus(code: number): string {
  switch (code) {
    case 100: return "(Processed — accepted by AT)";
    case 101: return "(Sent — delivered to carrier)";
    case 102: return "(Queued — pending dispatch)";
    case 401: return "(RiskHold — flagged for fraud review)";
    case 402: return "(InvalidSenderId — sender ID not registered/approved for this country)";
    case 403: return "(InvalidPhoneNumber — malformed E.164)";
    case 404: return "(UnsupportedNumberType)";
    case 405: return "(InsufficientBalance — AT account credits exhausted)";
    case 406: return "(UserInBlacklist)";
    case 407: return "(CouldNotRoute — no carrier route to this number)";
    case 500: return "(InternalServerError)";
    case 501: return "(GatewayError)";
    case 502: return "(RejectedByGateway)";
    default:  return "(unknown code — check AT docs)";
  }
}

main();
