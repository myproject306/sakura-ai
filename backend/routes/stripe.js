// ══════════════════════════════════════════
// Sakura AI — Stripe Routes
// GET  /api/stripe/prices
// POST /api/stripe/create-checkout-session
// POST /api/stripe/webhook
// POST /api/stripe/customer-portal
// GET  /api/stripe/subscription
// POST /api/stripe/cancel
// ══════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const prisma = new PrismaClient();

// ── Plan metadata ────────────────────────
const PLAN_PRICE_MAP = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro:     process.env.STRIPE_PRO_PRICE_ID,
  team:    process.env.STRIPE_TEAM_PRICE_ID,
};

const PRICE_PLAN_MAP = {}; // populated after fetching prices

// ── GET /api/stripe/prices ───────────────
// Fetch live prices from Stripe (never hardcode)
router.get('/prices', async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 20,
    });

    const formatted = prices.data
      .filter(p => p.recurring) // only subscription prices
      .map(p => ({
        id:          p.id,
        productId:   p.product.id,
        productName: p.product.name,
        description: p.product.description,
        amount:      p.unit_amount,
        currency:    p.currency,
        interval:    p.recurring.interval,
        intervalCount: p.recurring.interval_count,
        trialDays:   p.recurring.trial_period_days || parseInt(process.env.STRIPE_TRIAL_DAYS) || 0,
        metadata:    p.product.metadata,
      }));

    res.json({ prices: formatted });
  } catch (err) {
    logger.error('Stripe prices fetch error', { error: err.message });
    // Fallback to env-configured prices if Stripe is unavailable
    res.json({
      prices: [
        { id: process.env.STRIPE_STARTER_PRICE_ID, productName: 'Starter', amount: 900,  currency: 'usd', interval: 'month', trialDays: parseInt(process.env.STRIPE_TRIAL_DAYS) || 7 },
        { id: process.env.STRIPE_PRO_PRICE_ID,     productName: 'Pro',     amount: 2900, currency: 'usd', interval: 'month', trialDays: parseInt(process.env.STRIPE_TRIAL_DAYS) || 7 },
        { id: process.env.STRIPE_TEAM_PRICE_ID,    productName: 'Team',    amount: 7900, currency: 'usd', interval: 'month', trialDays: 0 },
      ],
      fallback: true,
    });
  }
});

// ── POST /api/stripe/create-checkout-session ──
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const { priceId, plan } = req.body;
    const user = req.user;

    const resolvedPriceId = priceId || PLAN_PRICE_MAP[plan];
    if (!resolvedPriceId) {
      return res.status(400).json({ error: 'Invalid plan or price ID' });
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.name,
        metadata: { userId: user.id, plan: plan || 'unknown' },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data:  { stripeCustomerId: customerId },
      });
    }

    const trialDays = parseInt(process.env.STRIPE_TRIAL_DAYS) || 0;

    const sessionParams = {
      customer:             customerId,
      payment_method_types: ['card'],
      line_items: [{
        price:    resolvedPriceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}&plan=${plan || 'pro'}`,
      cancel_url:  `${process.env.FRONTEND_URL}/pricing.html?canceled=true`,
      metadata: {
        userId: user.id,
        plan:   plan || 'unknown',
      },
      subscription_data: {
        metadata: { userId: user.id, plan: plan || 'unknown' },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    };

    // Add trial if configured
    if (trialDays > 0) {
      sessionParams.subscription_data.trial_period_days = trialDays;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    logger.info('Checkout session created', { userId: user.id, sessionId: session.id, plan });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    logger.error('Checkout session error', { error: err.message });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── POST /api/stripe/webhook ─────────────
// Raw body required — configured in server.js
router.post('/webhook', async (req, res) => {
  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Idempotency check
  const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (existing?.processed) {
    return res.json({ received: true, duplicate: true });
  }

  // Record event
  await prisma.webhookEvent.upsert({
    where:  { id: event.id },
    update: {},
    create: { id: event.id, type: event.type },
  });

  try {
    switch (event.type) {

      // ── Subscription activated / trial started ──
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.userId;
        if (!userId) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const plan = getPlanFromSubscription(subscription);

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus:   subscription.status,
            currentPeriodEnd:     new Date(subscription.current_period_end * 1000),
            trialEndsAt:          subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
            credits: getPlanCredits(plan),
          },
        });

        logger.info('Subscription activated', { userId, plan, subscriptionId: subscription.id });
        break;
      }

      // ── Subscription renewed ──
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        const plan = getPlanFromSubscription(subscription);

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            subscriptionStatus: subscription.status,
            currentPeriodEnd:   new Date(subscription.current_period_end * 1000),
            // Reset monthly credits on renewal
            credits:            getPlanCredits(plan),
            monthlyTokensUsed:  0,
            lastTokenReset:     new Date(),
          },
        });

        logger.info('Subscription renewed', { userId, plan });
        break;
      }

      // ── Payment failed ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: 'past_due' },
        });

        logger.warn('Payment failed', { userId, subscriptionId: subscription.id });
        break;
      }

      // ── Subscription cancelled ──
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan:               'free',
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            credits:            10,
          },
        });

        logger.info('Subscription cancelled', { userId });
        break;
      }

      // ── Subscription updated (upgrade/downgrade) ──
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        const plan = getPlanFromSubscription(subscription);

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            subscriptionStatus: subscription.status,
            currentPeriodEnd:   new Date(subscription.current_period_end * 1000),
            trialEndsAt:        subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });

        logger.info('Subscription updated', { userId, plan, status: subscription.status });
        break;
      }

      // ── Trial ending soon ──
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        logger.info('Trial ending soon', { userId, trialEnd: subscription.trial_end });
        // TODO: Send email notification
        break;
      }

      default:
        logger.debug('Unhandled webhook event', { type: event.type });
    }

    // Mark as processed
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data:  { processed: true, processedAt: new Date() },
    });

    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook processing error', { eventType: event.type, error: err.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── POST /api/stripe/customer-portal ─────
router.post('/customer-portal', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found. Please subscribe first.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error('Customer portal error', { error: err.message });
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// ── GET /api/stripe/subscription ─────────
router.get('/subscription', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeSubscriptionId) {
      return res.json({ subscription: null, plan: user.plan });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['items.data.price.product'],
    });

    res.json({
      subscription: {
        id:              subscription.id,
        status:          subscription.status,
        plan:            user.plan,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEnd:        subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items:           subscription.items.data.map(item => ({
          priceId:     item.price.id,
          productName: item.price.product.name,
          amount:      item.price.unit_amount,
          interval:    item.price.recurring.interval,
        })),
      },
    });
  } catch (err) {
    logger.error('Subscription fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ── POST /api/stripe/cancel ───────────────
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel at period end (not immediately)
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    logger.info('Subscription set to cancel at period end', { userId: user.id });

    res.json({
      message: 'Subscription will be cancelled at the end of the billing period',
      cancelAt: new Date(subscription.current_period_end * 1000),
    });
  } catch (err) {
    logger.error('Subscription cancel error', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ── Helpers ──────────────────────────────
function getPlanFromSubscription(subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter';
  if (priceId === process.env.STRIPE_PRO_PRICE_ID)     return 'pro';
  if (priceId === process.env.STRIPE_TEAM_PRICE_ID)    return 'team';
  // Fallback: check metadata
  return subscription.metadata?.plan || 'starter';
}

function getPlanCredits(plan) {
  const credits = { free: 10, starter: 50, pro: 200, team: 1000 };
  return credits[plan] || 10;
}

module.exports = router;
