import AfricasTalking from "africastalking";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY!,
  username: process.env.AT_USERNAME!,
});

const sms = at.SMS;

export const sendSMS = async (phone: string, message: string): Promise<void> => {
  try {
    const result = await sms.send({
      to: [phone],
      message,
      from: "AFRICASTALKING",
    });
    console.log(`✅ SMS result:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ SMS error:", error);
    throw error;
  }
};
