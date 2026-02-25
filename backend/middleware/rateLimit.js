// ══════════════════════════════════════════
// Sakura AI — Rate Limiting Middleware
// ══════════════════════════════════════════

const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 900 }); // 15 min default

// ── Plan-based token limits ──────────────
const PLAN_TOKEN_LIMITS = {
  free:     5_000,    // Very limited — encourages upgrade
  starter:  parseInt(process.env.STARTER_MONTHLY_TOKENS) || 500_000,
  pro:      parseInt(process.env.PRO_MONTHLY_TOKENS)     || 2_000_000,
  team:     parseInt(process.env.TEAM_MONTHLY_TOKENS)    || 10_000_000,
};

const PLAN_CREDIT_LIMITS = {
  free:     3,        // Only 3 credits/month for free
  starter:  parseInt(process.env.STARTER_MONTHLY_CREDITS) || 50,
  pro:      parseInt(process.env.PRO_MONTHLY_CREDITS)      || 200,
  team:     parseInt(process.env.TEAM_MONTHLY_CREDITS)     || 1000,
};

// ── Free tier daily request limit ────────
const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT) || 5;

// ── General API rate limiter ─────────────
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  keyGenerator: (req) => req.user?.id || req.ip,
});

// ── Auth route limiter (stricter) ────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' },
  keyGenerator: (req) => req.ip,
});

// ── Tool execution limiter ───────────────
const toolLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: parseInt(process.env.TOOL_RATE_LIMIT_MAX) || 20,
  message: { error: 'Too many tool requests. Please slow down.' },
  keyGenerator: (req) => req.user?.id || req.ip,
});

// ── Heavy tool limiter (image/audio/video) ──
const heavyToolLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  message: { error: 'Too many heavy tool requests. Please wait a moment.' },
  keyGenerator: (req) => req.user?.id || req.ip,
});

// ── Free tier daily usage cache (in-memory) ──
// Key: userId, Value: { count, date }
const freeDailyCache = new NodeCache({ stdTTL: 86400 }); // 24h TTL

// ── Check & increment free daily limit ───
async function checkFreeDailyLimit(req, res, next) {
  if (!req.isFreeUser) return next(); // Only applies to free users

  const userId = req.user.id;
  const today  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const cacheKey = `free_daily_${userId}_${today}`;

  const current = freeDailyCache.get(cacheKey) || 0;

  if (current >= FREE_DAILY_LIMIT) {
    return res.status(429).json({
      error: `Free plan limit reached. You've used all ${FREE_DAILY_LIMIT} daily requests.`,
      code:  'FREE_DAILY_LIMIT_EXCEEDED',
      limit: FREE_DAILY_LIMIT,
      used:  current,
      resetDate: getTomorrowStart(),
      upgradeUrl: '/pricing.html',
      isFreeLimit: true,
    });
  }

  // Increment counter
  freeDailyCache.set(cacheKey, current + 1);
  req.freeDailyUsed      = current + 1;
  req.freeDailyRemaining = FREE_DAILY_LIMIT - (current + 1);
  next();
}

// ── Fair-use token check middleware ──────
async function checkTokenLimit(req, res, next) {
  if (!req.user) return next();

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, monthlyTokensUsed: true, lastTokenReset: true },
    });

    if (!user) return next();

    const limit = PLAN_TOKEN_LIMITS[user.plan] || PLAN_TOKEN_LIMITS.free;

    if (user.monthlyTokensUsed >= limit) {
      return res.status(429).json({
        error: req.isFreeUser
          ? `Free plan monthly limit reached (${limit.toLocaleString()} tokens). Upgrade for 100x more.`
          : 'Monthly token limit reached',
        code: 'TOKEN_LIMIT_EXCEEDED',
        limit,
        used: user.monthlyTokensUsed,
        resetDate: getNextMonthStart(),
        upgradeUrl: '/pricing.html',
        isFreeLimit: req.isFreeUser || false,
      });
    }

    req.tokenLimit = limit;
    req.tokensUsed = user.monthlyTokensUsed;
    next();
  } catch (err) {
    next(); // Don't block on rate limit errors
  } finally {
    await prisma.$disconnect();
  }
}

// ── Credit check middleware ───────────────
async function checkCredits(creditsRequired = 1) {
  return async (req, res, next) => {
    if (!req.user) return next();

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { credits: true, plan: true },
      });

      if (!user) return next();

      if (user.credits < creditsRequired) {
        return res.status(402).json({
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          creditsRequired,
          creditsAvailable: user.credits,
          upgradeUrl: '/pricing.html',
        });
      }

      req.creditsRequired = creditsRequired;
      next();
    } catch (err) {
      next();
    } finally {
      await prisma.$disconnect();
    }
  };
}

// ── Deduct credits after successful tool use ──
async function deductCredits(userId, amount = 1) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
    });
  } catch (err) {
    logger.error('Failed to deduct credits', { userId, amount, error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

// ── Add tokens used ──────────────────────
async function addTokensUsed(userId, tokens) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyTokensUsed: { increment: tokens } },
    });
  } catch (err) {
    logger.error('Failed to update token usage', { userId, tokens, error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

// ── Helpers ──────────────────────────────
function getNextMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
}

function getTomorrowStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

module.exports = {
  generalLimiter,
  authLimiter,
  toolLimiter,
  heavyToolLimiter,
  checkTokenLimit,
  checkFreeDailyLimit,
  checkCredits,
  deductCredits,
  addTokensUsed,
  PLAN_TOKEN_LIMITS,
  PLAN_CREDIT_LIMITS,
  FREE_DAILY_LIMIT,
};
