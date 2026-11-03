import crypto from 'crypto';
import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { notify } from '../utils/notify';
import { initializeChapaPayment, verifyChapaPayment } from '../utils/chapa';
import { initializeWaafiPayment, checkWaafiPayment } from '../utils/waafi';

const API_BASE = process.env.API_URL || 'https://sahid-freight-production.up.railway.app';

// ── POST /payments/initiate ──────────────────────────────────────────────────
export const initiatePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, provider, phone } = req.body;
    const userId = req.user!.userId;

    if (!bookingId || !provider) {
      return res.status(400).json({ message: 'bookingId and provider are required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        load: true,
        sender: true,
        owner: true,
      },
    });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.senderId !== userId) {
      return res.status(403).json({ message: 'Only the cargo sender can initiate payment' });
    }
    if (!['ACCEPTED', 'IN_TRANSIT'].includes(booking.status)) {
      return res.status(400).json({ message: 'Payment can only be made for accepted or in-transit bookings' });
    }

    // Check for existing completed payment
    const existing = await prisma.payment.findUnique({ where: { bookingId } });
    if (existing?.status === 'COMPLETED') {
      return res.status(400).json({ message: 'Payment already completed for this booking' });
    }

    const txRef = `SF-${crypto.randomUUID()}`;
    const senderName = booking.sender.fullName.split(' ');

    if (provider === 'CASH') {
      const payment = await prisma.payment.upsert({
        where: { bookingId },
        create: {
          bookingId,
          payerId: userId,
          amount: booking.agreedPrice,
          currency: booking.currency,
          provider: 'CASH',
          status: 'COMPLETED',
          providerRef: txRef,
          paidAt: new Date(),
        },
        update: {
          provider: 'CASH',
          status: 'COMPLETED',
          providerRef: txRef,
          paidAt: new Date(),
        },
      });

      await notify(
        booking.ownerId,
        'PAYMENT_RECEIVED',
        'Cash payment confirmed',
        `Cash payment arranged for: ${booking.load.title}`
      );

      return res.status(200).json({ payment, message: 'Cash payment recorded' });
    }

    if (provider === 'CHAPA') {
      const chapaRes = await initializeChapaPayment({
        amount: booking.agreedPrice,
        currency: booking.currency === 'ETB' ? 'ETB' : 'ETB',
        email: booking.sender.email || `${booking.sender.phone.replace('+', '')}@sahidfreight.com`,
        firstName: senderName[0] || 'User',
        lastName: senderName[1] || 'Freight',
        phone: booking.sender.phone,
        txRef,
        callbackUrl: `${API_BASE}/payments/webhook/chapa`,
        returnUrl: `${API_BASE}/payments/return`,
        description: `Payment for ${booking.load.title}`,
      });

      const checkoutUrl = chapaRes?.data?.checkout_url;

      const payment = await prisma.payment.upsert({
        where: { bookingId },
        create: {
          bookingId,
          payerId: userId,
          amount: booking.agreedPrice,
          currency: booking.currency,
          provider: 'CHAPA',
          status: 'PROCESSING',
          providerRef: txRef,
          providerStatus: chapaRes?.status,
        },
        update: {
          provider: 'CHAPA',
          status: 'PROCESSING',
          providerRef: txRef,
          providerStatus: chapaRes?.status,
        },
      });

      return res.status(200).json({ payment, checkoutUrl });
    }

    if (provider === 'WAAFI') {
      if (!phone) {
        return res.status(400).json({ message: 'phone is required for Waafi payment' });
      }

      const waafiRes = await initializeWaafiPayment({
        amount: booking.agreedPrice,
        phone,
        description: `Payment for ${booking.load.title}`,
        referenceId: txRef,
      });

      const waafiStatus = waafiRes?.params?.state;
      const isApproved = waafiStatus === 'APPROVED';

      const payment = await prisma.payment.upsert({
        where: { bookingId },
        create: {
          bookingId,
          payerId: userId,
          amount: booking.agreedPrice,
          currency: 'USD',
          provider: 'WAAFI',
          status: isApproved ? 'COMPLETED' : 'PROCESSING',
          providerRef: txRef,
          providerStatus: waafiStatus,
          paidAt: isApproved ? new Date() : null,
        },
        update: {
          provider: 'WAAFI',
          status: isApproved ? 'COMPLETED' : 'PROCESSING',
          providerRef: txRef,
          providerStatus: waafiStatus,
          paidAt: isApproved ? new Date() : null,
        },
      });

      if (isApproved) {
        await notify(
          booking.ownerId,
          'PAYMENT_RECEIVED',
          'Payment received',
          `Waafi payment received for: ${booking.load.title}`
        );
      }

      return res.status(200).json({
        payment,
        message: isApproved
          ? 'Payment completed successfully'
          : 'Payment request sent. Check your phone for EVC Plus / ZAAD prompt.',
        waafiStatus,
      });
    }

    return res.status(400).json({ message: 'Invalid provider. Use CHAPA, WAAFI, or CASH' });
  } catch (error: any) {
    console.error('Payment initiate error:', error);
    return res.status(500).json({ message: error.message || 'Payment failed' });
  }
};

// ── POST /payments/verify ────────────────────────────────────────────────────
export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user!.userId;

    const payment = await prisma.payment.findUnique({
      where: { bookingId },
      include: { booking: { include: { load: true } } },
    });

    if (!payment) return res.status(404).json({ message: 'No payment found for this booking' });
    if (payment.payerId !== userId) return res.status(403).json({ message: 'Not authorized' });
    if (payment.status === 'COMPLETED') {
      return res.status(200).json({ payment, message: 'Payment already completed' });
    }

    if (payment.provider === 'CHAPA' && payment.providerRef) {
      const verifyRes = await verifyChapaPayment(payment.providerRef);
      const chapaStatus = verifyRes?.data?.status;
      const isCompleted = chapaStatus === 'success';

      const updated = await prisma.payment.update({
        where: { bookingId },
        data: {
          status: isCompleted ? 'COMPLETED' : chapaStatus === 'failed' ? 'FAILED' : 'PROCESSING',
          providerStatus: chapaStatus,
          paidAt: isCompleted ? new Date() : null,
        },
      });

      if (isCompleted) {
        await notify(
          payment.booking.ownerId,
          'PAYMENT_RECEIVED',
          'Payment received',
          `Chapa payment confirmed for: ${payment.booking.load.title}`
        );
      }

      return res.status(200).json({ payment: updated, chapaStatus });
    }

    if (payment.provider === 'WAAFI' && payment.providerRef) {
      const checkRes = await checkWaafiPayment(payment.providerRef);
      const waafiStatus = checkRes?.params?.state;
      const isApproved = waafiStatus === 'APPROVED';

      const updated = await prisma.payment.update({
        where: { bookingId },
        data: {
          status: isApproved ? 'COMPLETED' : waafiStatus === 'DECLINED' ? 'FAILED' : 'PROCESSING',
          providerStatus: waafiStatus,
          paidAt: isApproved ? new Date() : null,
        },
      });

      if (isApproved) {
        await notify(
          payment.booking.ownerId,
          'PAYMENT_RECEIVED',
          'Payment received',
          `Waafi payment confirmed for: ${payment.booking.load.title}`
        );
      }

      return res.status(200).json({ payment: updated, waafiStatus });
    }

    return res.status(200).json({ payment });
  } catch (error: any) {
    console.error('Payment verify error:', error);
    return res.status(500).json({ message: error.message || 'Verification failed' });
  }
};

// ── GET /payments/:bookingId ─────────────────────────────────────────────────
export const getPaymentByBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.userId;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const isSender = booking.senderId === userId;
    const isOwner = booking.ownerId === userId;
    if (!isSender && !isOwner && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const payment = await prisma.payment.findUnique({ where: { bookingId } });
    return res.status(200).json({ payment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── POST /payments/webhook/chapa (public) ────────────────────────────────────
// Verifies the Chapa-Signature header against the raw request body using
// CHAPA_WEBHOOK_SECRET. Without a valid signature the payload is rejected.
export const chapaWebhook = async (req: any, res: Response) => {
  try {
    const secret = process.env.CHAPA_WEBHOOK_SECRET;
    if (!secret) {
      console.error('Chapa webhook: CHAPA_WEBHOOK_SECRET not configured');
      return res.status(500).json({ message: 'Webhook not configured' });
    }

    const rawBody: Buffer | undefined = req.rawBody;
    if (!rawBody) {
      return res.status(400).json({ message: 'Missing body' });
    }

    const headerSig = (req.headers['chapa-signature'] || req.headers['x-chapa-signature']) as string | undefined;
    if (!headerSig) {
      return res.status(401).json({ message: 'Missing signature' });
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(headerSig, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const { trx_ref, status } = req.body;
    if (!trx_ref) return res.status(400).json({ message: 'Missing trx_ref' });

    const payment = await prisma.payment.findFirst({
      where: { providerRef: trx_ref },
      include: { booking: { include: { load: true } } },
    });

    if (!payment) return res.status(200).json({ received: true });

    const isCompleted = status === 'success';
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: isCompleted ? 'COMPLETED' : 'FAILED',
        providerStatus: status,
        paidAt: isCompleted ? new Date() : null,
      },
    });

    if (isCompleted) {
      await notify(
        payment.booking.ownerId,
        'PAYMENT_RECEIVED',
        'Payment received',
        `Payment confirmed for: ${payment.booking.load.title}`
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Chapa webhook error:', error);
    return res.status(200).json({ received: true }); // Always 200 for webhooks
  }
};

// ── GET /payments/history ────────────────────────────────────────────────────
export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const payments = await prisma.payment.findMany({
      where: { payerId: userId },
      include: {
        booking: {
          include: {
            load: { select: { title: true, pickupCity: true, deliveryCity: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ payments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};
