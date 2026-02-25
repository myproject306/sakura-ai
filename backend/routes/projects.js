// ══════════════════════════════════════════
// Sakura AI — Projects Routes
// GET    /api/projects
// GET    /api/projects/:id
// DELETE /api/projects/:id
// PUT    /api/projects/:id/favorite
// GET    /api/projects/favorites
// GET    /api/projects/stats
// ══════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const prisma = new PrismaClient();

// ── GET /api/projects ────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 20,
      category,
      search,
      favorite,
      sortBy   = 'createdAt',
      order    = 'desc',
    } = req.query;

    const where = { userId: req.user.id };
    if (category)          where.category   = category;
    if (favorite === 'true') where.isFavorite = true;
    if (search) {
      where.OR = [
        { title:    { contains: search } },
        { toolName: { contains: search } },
        { output:   { contains: search } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip:    (parseInt(page) - 1) * parseInt(limit),
        take:    parseInt(limit),
        select: {
          id:         true,
          title:      true,
          toolName:   true,
          category:   true,
          outputType: true,
          isFavorite: true,
          createdAt:  true,
          // Truncate output for list view
          output:     true,
        },
      }),
      prisma.project.count({ where }),
    ]);

    // Truncate output for list view
    const truncated = projects.map(p => ({
      ...p,
      outputPreview: p.output?.substring(0, 200) + (p.output?.length > 200 ? '...' : ''),
      output: undefined,
    }));

    res.json({
      projects: truncated,
      pagination: {
        page:       parseInt(page),
        limit:      parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('Projects fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ── GET /api/projects/stats ──────────────
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [total, favorites, byCategory, recent] = await Promise.all([
      prisma.project.count({ where: { userId } }),
      prisma.project.count({ where: { userId, isFavorite: true } }),
      prisma.project.groupBy({
        by:     ['category'],
        where:  { userId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.project.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        take:    5,
        select: {
          id: true, title: true, toolName: true,
          category: true, outputType: true, createdAt: true,
        },
      }),
    ]);

    // Total AI generations (from usage table)
    const totalGenerations = await prisma.usage.count({
      where: { userId, success: true },
    });

    res.json({
      totalProjects:    total,
      favorites,
      totalGenerations,
      byCategory:       byCategory.map(c => ({ category: c.category, count: c._count.id })),
      recentProjects:   recent,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/projects/favorites ──────────
router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where:   { userId: req.user.id, isFavorite: true },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select: {
        id: true, title: true, toolName: true,
        category: true, outputType: true, isFavorite: true, createdAt: true,
        output: true,
      },
    });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// ── GET /api/projects/:id ────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ── PUT /api/projects/:id ────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data:  { title: title || project.title },
    });

    res.json({ project: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ── PUT /api/projects/:id/favorite ───────
router.put('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data:  { isFavorite: !project.isFavorite },
    });

    res.json({ isFavorite: updated.isFavorite });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// ── DELETE /api/projects/:id ─────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ── DELETE /api/projects (bulk) ───────────
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Project IDs array required' });
    }

    await prisma.project.deleteMany({
      where: { id: { in: ids }, userId: req.user.id },
    });

    res.json({ message: `${ids.length} projects deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete projects' });
  }
});

// ── GET /api/projects/templates ──────────
router.get('/templates/list', authMiddleware, async (req, res) => {
  try {
    const { category } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;

    const templates = await prisma.template.findMany({
      where,
      orderBy: { uses: 'desc' },
    });

    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ── POST /api/projects/templates/:id/use ─
router.post('/templates/:id/use', authMiddleware, async (req, res) => {
  try {
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Increment uses
    await prisma.template.update({
      where: { id: req.params.id },
      data:  { uses: { increment: 1 } },
    });

    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to use template' });
  }
});

module.exports = router;
