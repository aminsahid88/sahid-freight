import AfricasTalking from "africastalking";

const at = AfricasTalking({
  apiKey:   process.env.AT_API_KEY   || "",
  username: process.env.AT_USERNAME  || "sandbox",
});

const sms = at.SMS;

export const sendSMS = async (phone: string, message: string): Promise<void> => {
  try {
    const normalised = phone.startsWith("+") ? phone : `+${phone}`;
    await sms.send({
      to:      [normalised],
      message,
      from:    process.env.AT_SENDER_ID || undefined,
    });
  } catch (err) {
    // SMS failure must never crash the request
    console.error("[SMS] Failed to send to", phone, err);
  }
};
