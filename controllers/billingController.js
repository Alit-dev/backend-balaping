/**
 * Billing Controller
 * Handles Stripe integration, subscriptions, and usage tracking
 */

const Subscription = require('../models/Subscription');
const Team = require('../models/Team');

// Stripe configuration with dummy/test keys
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_development');

// Price IDs (these would be created in your Stripe dashboard)
const PRICE_IDS = {
    pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_monthly',
};

// @desc    Get subscription status
// @route   GET /api/teams/:teamId/billing
// @access  Private
exports.getSubscription = async (req, res) => {
    try {
        let subscription = await Subscription.findOne({ teamId: req.params.teamId });

        // Create default free subscription if none exists
        if (!subscription) {
            subscription = await Subscription.create({
                teamId: req.params.teamId,
                plan: 'free',
                status: 'active',
                limits: Subscription.PLANS.free.limits,
            });
        }

        res.status(200).json({
            success: true,
            subscription: {
                plan: subscription.plan,
                status: subscription.status,
                limits: subscription.limits,
                usage: subscription.usage,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            },
            plans: Subscription.PLANS,
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Create checkout session for upgrade
// @route   POST /api/teams/:teamId/billing/checkout
// @access  Private
exports.createCheckoutSession = async (req, res) => {
    try {
        const { plan } = req.body;

        if (!plan || !['pro', 'enterprise'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'Invalid plan' });
        }

        const team = await Team.findById(req.params.teamId);
        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        let subscription = await Subscription.findOne({ teamId: req.params.teamId });

        // Create or get Stripe customer
        let customerId = subscription?.stripeCustomerId;
        if (!customerId) {
            // In development/test mode, create a mock customer ID
            if (process.env.NODE_ENV === 'development' || !process.env.STRIPE_SECRET_KEY) {
                customerId = `cus_mock_${Date.now()}`;
            } else {
                const customer = await stripe.customers.create({
                    email: req.user.email,
                    name: req.user.name,
                    metadata: {
                        teamId: req.params.teamId,
                        userId: req.user._id.toString(),
                    },
                });
                customerId = customer.id;
            }

            // Save customer ID
            if (!subscription) {
                subscription = await Subscription.create({
                    teamId: req.params.teamId,
                    stripeCustomerId: customerId,
                    plan: 'free',
                    status: 'active',
                    limits: Subscription.PLANS.free.limits,
                });
            } else {
                subscription.stripeCustomerId = customerId;
                await subscription.save();
            }
        }

        // In development/test mode, return a mock checkout URL
        if (process.env.NODE_ENV === 'development' || !process.env.STRIPE_SECRET_KEY) {
            console.log('📦 [DEV] Mock checkout session created for plan:', plan);
            return res.status(200).json({
                success: true,
                url: `${process.env.FRONTEND_URL}/dashboard/settings?mock_checkout=true&plan=${plan}`,
                sessionId: `cs_mock_${Date.now()}`,
                mode: 'development',
            });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: PRICE_IDS[plan],
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/dashboard/settings?checkout=success`,
            cancel_url: `${process.env.FRONTEND_URL}/dashboard/settings?checkout=canceled`,
            metadata: {
                teamId: req.params.teamId,
                plan,
            },
        });

        res.status(200).json({
            success: true,
            url: session.url,
            sessionId: session.id,
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ success: false, message: 'Failed to create checkout session' });
    }
};

// @desc    Stripe webhook handler
// @route   POST /api/billing/webhook
// @access  Public (but verified with Stripe signature)
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];

    // In development mode, auto-accept webhooks
    if (process.env.NODE_ENV === 'development' || !process.env.STRIPE_WEBHOOK_SECRET) {
        console.log('📦 [DEV] Mock webhook received:', req.body.type || 'unknown');
        return res.status(200).json({ received: true });
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutComplete(event.data.object);
            break;

        case 'customer.subscription.updated':
            await handleSubscriptionUpdate(event.data.object);
            break;

        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object);
            break;

        case 'invoice.payment_succeeded':
            await handlePaymentSuccess(event.data.object);
            break;

        case 'invoice.payment_failed':
            await handlePaymentFailed(event.data.object);
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
};

// @desc    Cancel subscription
// @route   POST /api/teams/:teamId/billing/cancel
// @access  Private
exports.cancelSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ teamId: req.params.teamId });

        if (!subscription || subscription.plan === 'free') {
            return res.status(400).json({ success: false, message: 'No active subscription to cancel' });
        }

        // In development mode
        if (process.env.NODE_ENV === 'development' || !subscription.stripeSubscriptionId?.startsWith('sub_')) {
            subscription.cancelAtPeriodEnd = true;
            await subscription.save();
            console.log('📦 [DEV] Mock subscription canceled');
            return res.status(200).json({
                success: true,
                message: 'Subscription will be canceled at period end',
            });
        }

        // Cancel at period end
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        subscription.cancelAtPeriodEnd = true;
        await subscription.save();

        res.status(200).json({
            success: true,
            message: 'Subscription will be canceled at the end of the billing period',
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Reactivate canceled subscription
// @route   POST /api/teams/:teamId/billing/reactivate
// @access  Private
exports.reactivateSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ teamId: req.params.teamId });

        if (!subscription || !subscription.cancelAtPeriodEnd) {
            return res.status(400).json({ success: false, message: 'No canceled subscription to reactivate' });
        }

        // Development mode
        if (process.env.NODE_ENV === 'development' || !subscription.stripeSubscriptionId?.startsWith('sub_')) {
            subscription.cancelAtPeriodEnd = false;
            await subscription.save();
            console.log('📦 [DEV] Mock subscription reactivated');
            return res.status(200).json({
                success: true,
                message: 'Subscription reactivated',
            });
        }

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: false,
        });

        subscription.cancelAtPeriodEnd = false;
        await subscription.save();

        res.status(200).json({
            success: true,
            message: 'Subscription reactivated',
        });
    } catch (error) {
        console.error('Reactivate subscription error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get usage stats
// @route   GET /api/teams/:teamId/billing/usage
// @access  Private
exports.getUsage = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ teamId: req.params.teamId });

        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }

        // Count actual usage from database
        const Monitor = require('../models/Monitor');
        const AlertChannel = require('../models/AlertChannel');
        const Team = require('../models/Team');

        const [monitorsCount, alertChannelsCount, team] = await Promise.all([
            Monitor.countDocuments({ teamId: req.params.teamId }),
            AlertChannel.countDocuments({ teamId: req.params.teamId }),
            Team.findById(req.params.teamId),
        ]);

        const usage = {
            monitors: monitorsCount,
            alertChannels: alertChannelsCount,
            teamMembers: team?.members?.length || 1,
        };

        // Update stored usage
        subscription.usage = usage;
        await subscription.save();

        res.status(200).json({
            success: true,
            usage,
            limits: subscription.limits,
            percentages: {
                monitors: calculatePercentage(usage.monitors, subscription.limits.monitors),
                alertChannels: calculatePercentage(usage.alertChannels, subscription.limits.alertChannels),
                teamMembers: calculatePercentage(usage.teamMembers, subscription.limits.teamMembers),
            },
        });
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Mock upgrade for development
 */
exports.mockUpgrade = async (req, res) => {
    try {
        if (process.env.NODE_ENV !== 'development') {
            return res.status(400).json({ success: false, message: 'Only available in development' });
        }

        const { plan } = req.body;
        if (!['free', 'pro', 'enterprise'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'Invalid plan' });
        }

        let subscription = await Subscription.findOne({ teamId: req.params.teamId });

        if (!subscription) {
            subscription = new Subscription({ teamId: req.params.teamId });
        }

        subscription.plan = plan;
        subscription.status = 'active';
        subscription.limits = Subscription.PLANS[plan].limits;
        subscription.currentPeriodStart = new Date();
        subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        subscription.cancelAtPeriodEnd = false;

        await subscription.save();

        console.log(`📦 [DEV] Mock upgrade to ${plan}`);

        res.status(200).json({
            success: true,
            message: `Upgraded to ${plan}`,
            subscription,
        });
    } catch (error) {
        console.error('Mock upgrade error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Webhook handlers
async function handleCheckoutComplete(session) {
    const { teamId, plan } = session.metadata;

    const subscription = await Subscription.findOne({ teamId });
    if (subscription) {
        subscription.plan = plan;
        subscription.status = 'active';
        subscription.stripeSubscriptionId = session.subscription;
        subscription.limits = Subscription.PLANS[plan].limits;
        await subscription.save();
    }

    console.log(`✅ Checkout complete: Team ${teamId} upgraded to ${plan}`);
}

async function handleSubscriptionUpdate(stripeSubscription) {
    const subscription = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
        subscription.status = stripeSubscription.status;
        subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
        subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
        subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
        await subscription.save();
    }
}

async function handleSubscriptionDeleted(stripeSubscription) {
    const subscription = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
        subscription.plan = 'free';
        subscription.status = 'inactive';
        subscription.limits = Subscription.PLANS.free.limits;
        subscription.stripeSubscriptionId = null;
        await subscription.save();
    }

    console.log(`⚠️ Subscription deleted, downgraded to free`);
}

async function handlePaymentSuccess(invoice) {
    console.log(`💰 Payment succeeded: ${invoice.amount_paid / 100} ${invoice.currency}`);
}

async function handlePaymentFailed(invoice) {
    console.log(`❌ Payment failed for customer ${invoice.customer}`);
}

function calculatePercentage(used, limit) {
    if (limit === -1) return 0; // Unlimited
    return Math.min(100, Math.round((used / limit) * 100));
}
