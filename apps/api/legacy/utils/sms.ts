import AfricasTalking from "africastalking";

// Built lazily: the SDK validates the key in its constructor and used to crash the
// whole API at import time whenever AT_API_KEY was empty (local dev, tests).
let sms: ReturnType<ReturnType<typeof AfricasTalking>["SMS"]> | null = null;
function client() {
  const apiKey = process.env.AT_API_KEY;
  if (!apiKey) throw new Error("AT_API_KEY is not set; SMS sending is disabled in this environment");
  if (!sms) sms = AfricasTalking({ apiKey, username: process.env.AT_USERNAME || "sandbox" }).SMS;
  return sms;
}

export const sendSMS = async (phone: string, message: string): Promise<void> => {
  try {
    const sms = client();
    const normalised = phone.startsWith("+") ? phone : `+${phone}`;
    const options: { to: string[]; message: string; from?: string } = {
      to:      [normalised],
      message,
    };
    if (process.env.AT_SENDER_ID) {
      options.from = process.env.AT_SENDER_ID;
    }
    await sms.send(options as any);
  } catch (err) {
    // SMS failure must never crash the request
    console.error("[SMS] Failed to send to", phone, err);
  }
};
