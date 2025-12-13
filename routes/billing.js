const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, checkTeamAccess } = require('../middleware/auth');
const billingController = require('../controllers/billingController');

// Webhook route (no auth - uses Stripe signature)
router.post('/webhook', express.raw({ type: 'application/json' }), billingController.handleWebhook);

// All other routes require authentication and team access
router.use(protect);
router.use(checkTeamAccess);

// GET /api/teams/:teamId/billing
router.get('/', billingController.getSubscription);

// POST /api/teams/:teamId/billing/checkout
router.post('/checkout', billingController.createCheckoutSession);

// POST /api/teams/:teamId/billing/cancel
router.post('/cancel', billingController.cancelSubscription);

// POST /api/teams/:teamId/billing/reactivate
router.post('/reactivate', billingController.reactivateSubscription);

// GET /api/teams/:teamId/billing/usage
router.get('/usage', billingController.getUsage);

// POST /api/teams/:teamId/billing/mock-upgrade (development only)
router.post('/mock-upgrade', billingController.mockUpgrade);

module.exports = router;
