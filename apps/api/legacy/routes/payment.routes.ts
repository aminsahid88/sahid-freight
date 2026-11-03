import { Router } from 'express';
import {
  initiatePayment,
  verifyPayment,
  getPaymentByBooking,
  chapaWebhook,
  getPaymentHistory,
} from '../controllers/payment.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Public webhook — must be before protect middleware
router.post('/webhook/chapa', chapaWebhook);

// Protected routes
router.post('/initiate', protect, initiatePayment);
router.post('/verify', protect, verifyPayment);
router.get('/history', protect, getPaymentHistory);
router.get('/:bookingId', protect, getPaymentByBooking);

export default router;
