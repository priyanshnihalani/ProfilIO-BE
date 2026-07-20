import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

const router = express.Router();
const JWT_SECRET = config.jwtSecret;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummyKeyId12345';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummyKeySecret54321';

// Initialize Razorpay only if key is not dummy or if we want to catch errors
let razorpayInstance = null;
try {
  razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
} catch (e) {
  console.warn('Failed to initialize Razorpay SDK:', e.message);
}

const createToken = (user) => jwt.sign(
    { id: user.id, email: user.email, planType: user.planType, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
);

const serializeUser = (user) => ({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    planType: user.planType,
    role: user.role,
    resumeDownloads: user.resumeDownloads,
    aiImprovements: user.aiImprovements,
    paymentDate: user.paymentDate,
    membershipEndDate: user.membershipEndDate,
});

/**
 * POST /api/payments/free-upgrade
 * Upgrades user to FREE or STARTER plan (both are now free)
 */
router.post('/free-upgrade', requireAuth, async (req, res) => {
  try {
    const { planType } = req.body;
    if (planType !== 'FREE' && planType !== 'STARTER') {
      return res.status(400).json({ success: false, message: 'Invalid plan type for free upgrade.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        planType,
        // Reset limits to give them the new plan benefits
        resumeDownloads: 0,
        aiImprovements: 0,
      },
    });

    const token = createToken(updatedUser);
    return res.json({
      success: true,
      message: `Successfully upgraded to ${planType} plan.`,
      token,
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error('Free upgrade error:', error);
    return res.status(500).json({ success: false, message: 'Failed to apply upgrade.' });
  }
});

/**
 * POST /api/payments/create-order
 * Creates a Razorpay order for ₹299 (PRO plan)
 */
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const amount = 299 * 100; // 299 INR in paise
    const receipt = `receipt_pro_${Date.now()}`;

    // If keys are dummy, return a mock order for visual testing
    if (RAZORPAY_KEY_ID.includes('dummy')) {
      return res.json({
        success: true,
        orderId: `order_mock_${Math.random().toString(36).substring(2, 11)}`,
        amount,
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
        isMock: true,
      });
    }

    const options = {
      amount,
      currency: 'INR',
      receipt,
    };

    const order = await razorpayInstance.orders.create(options);
    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: RAZORPAY_KEY_ID,
      isMock: false,
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    // Fallback to mock order in case of API failure during local development
    return res.json({
      success: true,
      orderId: `order_mock_${Math.random().toString(36).substring(2, 11)}`,
      amount: 299 * 100,
      currency: 'INR',
      key: RAZORPAY_KEY_ID,
      isMock: true,
      warn: 'Razorpay API returned error, falling back to mock checkout.',
    });
  }
});

/**
 * POST /api/payments/verify
 * Verifies Razorpay payment signature and upgrades user to PRO
 */
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, message: 'Missing payment parameters.' });
    }

    // If order was a mock checkout, skip signature check
    const isMock = razorpay_order_id.startsWith('order_mock_') || RAZORPAY_KEY_ID.includes('dummy');

    if (!isMock) {
      const generatedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature. Verification failed.' });
      }
    }

    // Upgrade user to PRO
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        planType: 'PRO',
        paymentDate: new Date(),
        // Add 1 year membership for PRO
        membershipEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        resumeDownloads: 0,
        aiImprovements: 0,
      },
    });

    const token = createToken(updatedUser);
    return res.json({
      success: true,
      message: 'Payment verified successfully. Welcome to PRO!',
      token,
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify payment.' });
  }
});

export default router;
