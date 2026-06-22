import { Resend } from "resend";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOTPEmail = async (email: string, otp: string): Promise<void> => {
  try {
    const result = await resend.emails.send({
      from: "Sahid Freight <noreply@sahidfreight.com>",
      to: email,
      subject: "Your Sahid Freight Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0A1628; color: #ffffff; border-radius: 12px;">
          <h2 style="color: #C8901E; margin-bottom: 8px;">Sahid Freight</h2>
          <p style="color: #aaaaaa; margin-bottom: 32px;">Freight Marketplace</p>
          <h3 style="margin-bottom: 16px;">Your verification code:</h3>
          <div style="font-size: 48px; font-weight: bold; color: #C8901E; letter-spacing: 12px; margin: 24px 0;">${otp}</div>
          <p style="color: #aaaaaa; font-size: 14px;">Valid for 10 minutes. Do not share this code with anyone.</p>
        </div>
      `,
    });
    // Resend SDK returns { data, error } and does NOT throw on API errors
    // (401/403/429). Surface those as thrown errors so callers can detect them.
    if (result.error) {
      console.error("❌ Resend API error:", result.error);
      throw new Error(`Email send failed: ${(result.error as any).message || (result.error as any).name || "unknown"}`);
    }
    console.log(`✅ Email OTP sent, id:`, result.data?.id);
  } catch (error) {
    console.error("❌ Email OTP error:", error);
    throw error;
  }
};
