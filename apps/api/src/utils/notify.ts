import prisma from "./prisma";

type NotificationType =
  | "NEW_LOAD"
  | "BOOKING_ACCEPTED"
  | "BOOKING_REJECTED"
  | "LOAD_PICKED_UP"
  | "LOAD_DELIVERED"
  | "PAYMENT_RECEIVED"
  | "NEW_REVIEW"
  | "ACCOUNT_VERIFIED"
  | "NEW_BID"
  | "BID_ACCEPTED"
  | "BID_REJECTED";

const sendExpoPush = async (pushToken: string, title: string, body: string) => {
  if (!pushToken.startsWith("ExponentPushToken")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: pushToken, title, body, sound: "default", priority: "high" }),
    });
  } catch (err) {
    console.error("Expo push failed:", err);
  }
};

export const notify = async (
  userId: string,
  type: NotificationType,
  title: string,
  body: string
) => {
  await prisma.notification.create({
    data: { userId, type, title, body },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
  if (user?.pushToken) {
    await sendExpoPush(user.pushToken, title, body);
  }
};
