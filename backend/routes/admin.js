// ══════════════════════════════════════════
// Sakura AI — Admin Routes
// All routes require: authMiddleware + requireAdmin
// GET  /api/admin/dashboard
// GET  /api/admin/users
// PUT  /api/admin/users/:id
// GET  /api/admin/usage
// GET  /api/admin/logs
// GET  /api/admin/metrics
// POST /api/admin/templates
// PUT  /api/admin/templates/:id
// DELETE /api/admin/templates/:id
// ══════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { getQueueMetrics } = require('../services/queue');

const prisma = new PrismaClient();

// Apply auth + admin to all routes
router.use(authMiddleware, requireAdmin);

// ── GET /api/admin/dashboard ─────────────
router.get('/dashboard', async (req, res) => {
  try {
    const now      = new Date();
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeSubscriptions,
      newUsersToday,
      newUsersThisMonth,
      totalProjects,
      totalGenerations,
      recentErrors,
      queueMetrics,
      planBreakdown,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { subscriptionStatus: { in: ['active', 'trialing'] } } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.project.count(),
      prisma.usage.count({ where: { success: true } }),
      prisma.errorLog.count({ where: { createdAt: { gte: today }, severity: 'error' } }),
      getQueueMetrics(),
      prisma.user.groupBy({
        by:     ['plan'],
        _count: { id: true },
      }),
    ]);

    res.json({
      users: {
        total:         totalUsers,
        activeSubscriptions,
        newToday:      newUsersToday,
        newThisMonth:  newUsersThisMonth,
      },
      content: {
        totalProjects,
        totalGenerations,
      },
      errors: {
        todayCount: recentErrors,
      },
      queue: queueMetrics,
      planBreakdown: planBreakdown.map(p => ({ plan: p.plan, count: p._count.id })),
    });
  } catch (err) {
    logger.error('Admin dashboard error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ── GET /api/admin/users ─────────────────
router.get('/users', async (req, res) => {
  try {
    const {
      page   = 1,
      limit  = 25,
      search,
      plan,
      status,
      sortBy = 'createdAt',
      order  = 'desc',
    } = req.query;

    const where = {};
    if (plan)   where.plan = plan;
    if (status) where.subscriptionStatus = status;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name:  { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip:    (parseInt(page) - 1) * parseInt(limit),
        take:    parseInt(limit),
        select: {
          id: true, email: true, name: true, role: true,
          plan: true, subscriptionStatus: true, credits: true,
          monthlyTokensUsed: true, isActive: true, createdAt: true,
          stripeCustomerId: true, currentPeriodEnd: true,
          _count: { select: { projects: true, usages: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page:       parseInt(page),
        limit:      parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/admin/users/:id ─────────────
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        projects: { orderBy: { createdAt: 'desc' }, take: 10 },
        usages:   { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── PUT /api/admin/users/:id ─────────────
router.put('/users/:id', async (req, res) => {
  try {
    const { plan, role, isActive, credits } = req.body;
    const data = {};

    if (plan     !== undefined) data.plan     = plan;
    if (role     !== undefined) data.role     = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (credits  !== undefined) data.credits  = parseInt(credits);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });

    logger.info('Admin updated user', { adminId: req.user.id, targetUserId: req.params.id, changes: data });

    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── DELETE /api/admin/users/:id ───────────
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    logger.info('Admin deleted user', { adminId: req.user.id, targetUserId: req.params.id });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── GET /api/admin/usage ─────────────────
router.get('/usage', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const [byTool, byCategory, byDay, totals] = await Promise.all([
      // Top tools
      prisma.usage.groupBy({
        by:     ['toolName'],
        where:  { createdAt: { gte: since } },
        _count: { id: true },
        _sum:   { tokensUsed: true, creditsUsed: true },
        orderBy: { _count: { id: 'desc' } },
        take:   20,
      }),
      // By category
      prisma.usage.groupBy({
        by:     ['category'],
        where:  { createdAt: { gte: since } },
        _count: { id: true },
        _sum:   { tokensUsed: true },
      }),
      // Daily usage (last 30 days)
      prisma.$queryRaw`
        SELECT DATE(createdAt) as date, COUNT(*) as count, SUM(tokensUsed) as tokens
        FROM Usage
        WHERE createdAt >= ${since}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
        LIMIT 30
      `,
      // Totals
      prisma.usage.aggregate({
        where:  { createdAt: { gte: since } },
        _count: { id: true },
        _sum:   { tokensUsed: true, creditsUsed: true },
      }),
    ]);

    res.json({
      period: `${days} days`,
      totals: {
        requests:    totals._count.id,
        tokensUsed:  totals._sum.tokensUsed  || 0,
        creditsUsed: totals._sum.creditsUsed || 0,
      },
      byTool:     byTool.map(t => ({ toolName: t.toolName, uses: t._count.id, tokens: t._sum.tokensUsed || 0 })),
      byCategory: byCategory.map(c => ({ category: c.category, uses: c._count.id, tokens: c._sum.tokensUsed || 0 })),
      daily:      byDay,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// ── GET /api/admin/logs ──────────────────
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, severity, toolName } = req.query;
    const where = {};
    if (severity) where.severity = severity;
    if (toolName) where.toolName = toolName;

    const [logs, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (parseInt(page) - 1) * parseInt(limit),
        take:    parseInt(limit),
      }),
      prisma.errorLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ── GET /api/admin/metrics ───────────────
router.get('/metrics', async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Revenue from Stripe
    let revenue = { mrr: 0, arr: 0 };
    try {
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit:  100,
        expand: ['data.items.data.price'],
      });

      const mrr = subscriptions.data.reduce((sum, sub) => {
        const price = sub.items.data[0]?.price;
        if (!price) return sum;
        const monthly = price.recurring.interval === 'year'
          ? price.unit_amount / 12
          : price.unit_amount;
        return sum + monthly;
      }, 0);

      revenue = { mrr: mrr / 100, arr: (mrr * 12) / 100 };
    } catch (_) {}

    const queueMetrics = await getQueueMetrics();

    res.json({ revenue, queue: queueMetrics });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ── Templates CRUD ───────────────────────
router.get('/templates', async (req, res) => {
  try {
    const templates = await prisma.template.findMany({ orderBy: { uses: 'desc' } });
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const { title, category, emoji, description, prompt, variables } = req.body;
    const template = await prisma.template.create({
      data: { title, category, emoji, description, prompt, variables: JSON.stringify(variables || []) },
    });
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const template = await prisma.template.update({
      where: { id: req.params.id },
      data:  req.body,
    });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await prisma.template.delete({ where: { id: req.params.id } });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
