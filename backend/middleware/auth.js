// ══════════════════════════════════════════
// Sakura AI — JWT Auth Middleware
// ══════════════════════════════════════════

const jwt          = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── Verify JWT and attach user to req ────
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token missing' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        credits: true,
        monthlyTokensUsed: true,
        lastTokenReset: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Reset monthly tokens if new month
    const now = new Date();
    const lastReset = new Date(user.lastTokenReset);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { monthlyTokensUsed: 0, lastTokenReset: now },
      });
      user.monthlyTokensUsed = 0;
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    res.status(500).json({ error: 'Authentication error' });
  }
}

// ── Require active subscription ──────────
function requireSubscription(req, res, next) {
  const { plan, subscriptionStatus, trialEndsAt } = req.user;

  const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const trialValid = trialEndsAt && new Date(trialEndsAt) > new Date();

  if (plan === 'free' && !isActive && !trialValid) {
    return res.status(403).json({
      error: 'Active subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
      upgradeUrl: '/pricing.html',
    });
  }
  next();
}

// ── Require admin role ───────────────────
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ── Check plan level ─────────────────────
function requirePlan(...plans) {
  return (req, res, next) => {
    if (!plans.includes(req.user.plan)) {
      return res.status(403).json({
        error: `This feature requires one of: ${plans.join(', ')} plan`,
        code: 'PLAN_UPGRADE_REQUIRED',
        upgradeUrl: '/pricing.html',
      });
    }
    next();
  };
}

// ── Check credits ────────────────────────
function requireCredits(amount = 1) {
  return (req, res, next) => {
    if (req.user.credits < amount) {
      return res.status(402).json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        creditsRequired: amount,
        creditsAvailable: req.user.credits,
        upgradeUrl: '/pricing.html',
      });
    }
    next();
  };
}

// ── Optional auth (attach user if token present) ──
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (user && user.isActive) req.user = user;
  } catch (_) {}
  next();
}

module.exports = {
  authMiddleware,
  requireSubscription,
  requireAdmin,
  requirePlan,
  requireCredits,
  optionalAuth,
};
