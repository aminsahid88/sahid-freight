import AfricasTalking from "africastalking";

const at = AfricasTalking({
  apiKey:   process.env.AT_API_KEY   || "",
  username: process.env.AT_USERNAME  || "sandbox",
});

const sms = at.SMS;

export const sendSMS = async (phone: string, message: string): Promise<void> => {
  try {
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
