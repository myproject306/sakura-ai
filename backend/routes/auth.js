// ══════════════════════════════════════════
// Sakura AI — Auth Routes
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/google
// GET  /api/auth/me
// POST /api/auth/refresh
// POST /api/auth/logout
// POST /api/auth/forgot-password
// ══════════════════════════════════════════

const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const prisma       = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Token Helpers ────────────────────────
function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── POST /api/auth/register ──────────────
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name required'),
  body('lastName').trim().notEmpty().withMessage('Last name required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body;

    // Check existing
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        passwordHash,
        credits: 100,
        plan: 'free',
      },
    });

    const accessToken  = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logger.info('New user registered', { userId: user.id, email: user.email });

    res.status(201).json({
      message: 'Account created successfully',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Registration error', { error: err.message });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken  = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logger.info('User logged in', { userId: user.id });

    res.json({
      message: 'Login successful',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/google ────────────────
// Verify Google ID token from frontend
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Google ID token required' });

    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { sub: googleId, email, name, given_name, family_name, picture } = payload;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Update Google info if needed
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatar: picture },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          name,
          firstName: given_name,
          lastName: family_name,
          avatar: picture,
          credits: 100,
          plan: 'free',
        },
      });
      logger.info('New Google user registered', { userId: user.id, email });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const accessToken  = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      message: 'Google login successful',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Google auth error', { error: err.message });
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// ── GET /api/auth/me ─────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, firstName: true, lastName: true,
        avatar: true, role: true, plan: true, stripeCustomerId: true,
        stripeSubscriptionId: true, subscriptionStatus: true,
        trialEndsAt: true, currentPeriodEnd: true,
        credits: true, monthlyTokensUsed: true, createdAt: true,
      },
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── POST /api/auth/refresh ───────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const newAccessToken  = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── POST /api/auth/logout ────────────────
router.post('/logout', authMiddleware, (req, res) => {
  // JWT is stateless; client should delete tokens
  // In production, maintain a token blacklist in Redis
  logger.info('User logged out', { userId: req.user.id });
  res.json({ message: 'Logged out successfully' });
});

// ── PUT /api/auth/profile ────────────────
router.put('/profile', authMiddleware, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
], async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const data = {};
    if (firstName) { data.firstName = firstName; data.name = `${firstName} ${req.user.lastName || ''}`; }
    if (lastName)  { data.lastName  = lastName;  data.name = `${req.user.firstName || ''} ${lastName}`; }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// ── DELETE /api/auth/account ─────────────
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    logger.info('User account deleted', { userId: req.user.id });
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

module.exports = router;
