import prisma from "./prisma";

type NotificationType =
  | "NEW_LOAD"
  | "BOOKING_ACCEPTED"
  | "BOOKING_REJECTED"
  | "LOAD_PICKED_UP"
  | "LOAD_DELIVERED"
  | "PAYMENT_RECEIVED"
  | "NEW_REVIEW"
  | "ACCOUNT_VERIFIED";

export const notify = async (
  userId: string,
  type: NotificationType,
  title: string,
  body: string
) => {
  await prisma.notification.create({
    data: { userId, type, title, body },
  });
};
