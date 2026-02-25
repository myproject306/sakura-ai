// ══════════════════════════════════════════
// Sakura AI — Tools Routes
// POST /api/tools/run
// GET  /api/tools/status/:jobId
// GET  /api/tools/list
// POST /api/tools/improve
// ══════════════════════════════════════════

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireSubscription } = require('../middleware/auth');
const { toolLimiter, heavyToolLimiter, checkTokenLimit, checkFreeDailyLimit, FREE_DAILY_LIMIT } = require('../middleware/rateLimit');
const { addHeavyJob, runLightJob, getJobStatus } = require('../services/queue');
const cp = require('../services/copilotProvider');   // hidden AI engine

const prisma  = new PrismaClient();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

// ── Tool category map ────────────────────
const TOOL_CATEGORIES = {
  // Writing
  'article-writer':         'writing',
  'email-writer':           'writing',
  'social-media-posts':     'writing',
  'text-summarizer':        'writing',
  'text-rewriter':          'writing',
  'marketing-copy':         'writing',
  'product-description':    'writing',
  'ad-copy':                'specialized',
  'customer-support':       'specialized',
  'social-media-calendar':  'specialized',
  // Code
  'code-generator':         'code',
  'bug-fixer':              'code',
  'code-explainer':         'code',
  'documentation-writer':   'code',
  'automation-scripts':     'code',
  // Business
  'business-plan':          'business',
  'cv-resume':              'business',
  'presentation-builder':   'business',
  'sop-workflow':           'business',
  'formal-email':           'business',
  // Study
  'lesson-simplifier':      'study',
  'qa-generator':           'study',
  'study-plan':             'study',
  'step-by-step-solver':    'study',
  // Image (credits-based)
  'text-to-image':          'image',
  'logo-generator':         'image',
  'social-media-designer':  'image',
  'poster-maker':           'image',
  'photo-enhancer':         'image',
  'background-remover':     'image',
  // Audio (credits-based)
  'text-to-speech':         'audio',
  'voice-over-generator':   'audio',
  'speech-to-text':         'audio',
  'noise-remover':          'audio',
  // Data
  'excel-csv-analyzer':     'data',
  'report-generator':       'data',
  'business-insights':      'data',
};

// Heavy tools that go through the queue
const HEAVY_TOOLS = new Set([
  'text-to-image', 'logo-generator', 'social-media-designer',
  'poster-maker', 'photo-enhancer', 'background-remover',
  'text-to-speech', 'voice-over-generator', 'speech-to-text',
  'noise-remover',
]);

// Tools requiring Pro or Team plan
const PRO_TOOLS = new Set([
  'text-to-image', 'logo-generator', 'social-media-designer',
  'poster-maker', 'photo-enhancer', 'background-remover',
  'text-to-speech', 'voice-over-generator', 'speech-to-text',
  'noise-remover', 'excel-csv-analyzer', 'report-generator',
  'business-insights', 'business-plan', 'cv-resume',
  'presentation-builder', 'sop-workflow',
]);

// Tools available on the FREE plan (basic only — 6 out of 35+)
const FREE_TOOLS = new Set([
  'article-writer',
  'email-writer',
  'text-summarizer',
  'text-rewriter',
  'code-generator',
  'lesson-simplifier',
]);

// Max words shown to free users before truncation + blur
const FREE_OUTPUT_WORD_LIMIT = 200;

// ── Truncate output for free users ───────
function truncateFreeOutput(text, toolName) {
  if (!text || typeof text !== 'string') return text;
  const words = text.split(/\s+/);
  if (words.length <= FREE_OUTPUT_WORD_LIMIT) return text; // Short enough, no truncation
  const truncated = words.slice(0, FREE_OUTPUT_WORD_LIMIT).join(' ');
  return truncated + '\n\n[SAKURA_FREE_TRUNCATED]'; // Marker for frontend blur effect
}

// ── GET /api/tools/list ──────────────────
router.get('/list', (req, res) => {
  const tools = Object.entries(TOOL_CATEGORIES).map(([id, category]) => ({
    id,
    category,
    isHeavy:    HEAVY_TOOLS.has(id),
    requiresPro: PRO_TOOLS.has(id),
    isFreeAvailable: FREE_TOOLS.has(id),
  }));
  res.json({ tools, freeDailyLimit: FREE_DAILY_LIMIT, freeToolCount: FREE_TOOLS.size });
});

// ── POST /api/tools/run ──────────────────
router.post('/run',
  authMiddleware,
  requireSubscription,
  toolLimiter,
  checkFreeDailyLimit,   // ← Free users: max 5/day
  checkTokenLimit,
  async (req, res) => {
    try {
      const { toolName, params = {}, projectTitle } = req.body;

      if (!toolName) {
        return res.status(400).json({ error: 'toolName is required' });
      }

      const category = TOOL_CATEGORIES[toolName];
      if (!category) {
        return res.status(400).json({ error: `Unknown tool: ${toolName}` });
      }

      // ── Free user restrictions ──────────
      if (req.isFreeUser) {
        // Only allow FREE_TOOLS
        if (!FREE_TOOLS.has(toolName)) {
          return res.status(403).json({
            error: 'This tool is not available on the free plan. Upgrade to access all 35+ tools.',
            code:  'FREE_PLAN_TOOL_RESTRICTED',
            upgradeUrl: '/pricing.html',
            isFreeLimit: true,
            freeTools: [...FREE_TOOLS],
          });
        }
        // No heavy tools for free users
        if (HEAVY_TOOLS.has(toolName)) {
          return res.status(403).json({
            error: 'Image and audio tools require a paid plan.',
            code:  'FREE_PLAN_TOOL_RESTRICTED',
            upgradeUrl: '/pricing.html',
            isFreeLimit: true,
          });
        }
      }

      // Check plan for Pro tools (paid users)
      if (PRO_TOOLS.has(toolName) && !['pro', 'team'].includes(req.user.plan)) {
        return res.status(403).json({
          error: 'This tool requires a Pro or Team plan',
          code:  'PLAN_UPGRADE_REQUIRED',
          upgradeUrl: '/pricing.html',
        });
      }

      // Check credits for heavy tools
      if (HEAVY_TOOLS.has(toolName) && req.user.credits < 1) {
        return res.status(402).json({
          error: 'Insufficient credits for this tool',
          code:  'INSUFFICIENT_CREDITS',
          creditsAvailable: req.user.credits,
          upgradeUrl: '/pricing.html',
        });
      }

      const jobData = {
        userId:       req.user.id,
        toolName,
        category,
        params,
        projectTitle: projectTitle || `${toolName} — ${new Date().toLocaleDateString()}`,
        isFreeUser:   req.isFreeUser || false,   // ← Pass to queue/router
      };

      // Heavy tools → queue; light tools → synchronous
      if (HEAVY_TOOLS.has(toolName)) {
        const { jobId, queued } = await addHeavyJob(jobData);
        return res.json({
          jobId,
          queued,
          message: queued
            ? 'Job queued. Poll /api/tools/status/:jobId for result.'
            : 'Processing started.',
        });
      }

      // Light tool — run synchronously
      const result = await runLightJob(jobData);

      // ── Truncate output for free users ──
      let finalOutput = result.output;
      let isTruncated = false;
      if (req.isFreeUser && result.outputType === 'text') {
        finalOutput = truncateFreeOutput(result.output, toolName);
        isTruncated = finalOutput.includes('[SAKURA_FREE_TRUNCATED]');
      }

      res.json({
        success:    true,
        output:     finalOutput,
        outputType: result.outputType,
        tokensUsed: result.tokensUsed,
        projectId:  req.isFreeUser ? null : result.projectId,  // No saving for free
        durationMs: result.durationMs,
        isFreeUser: req.isFreeUser || false,
        isTruncated,
        freeDailyRemaining: req.freeDailyRemaining ?? null,
        upgradeUrl: req.isFreeUser ? '/pricing.html' : null,
      });

    } catch (err) {
      logger.error('Tool run error', { error: err.message, toolName: req.body.toolName });

      // Provide user-friendly error messages
      if (err.message?.includes('API key')) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
      }
      if (err.message?.includes('rate limit') || err.status === 429) {
        return res.status(429).json({ error: 'AI service rate limit reached. Please try again in a moment.' });
      }

      res.status(500).json({ error: 'Tool execution failed. Please try again.' });
    }
  }
);

// ── POST /api/tools/run-audio (with file upload) ──
router.post('/run-audio',
  authMiddleware,
  requireSubscription,
  heavyToolLimiter,
  upload.single('audio'),
  async (req, res) => {
    try {
      const { toolName } = req.body;

      if (!['speech-to-text', 'noise-remover'].includes(toolName)) {
        return res.status(400).json({ error: 'Invalid audio tool' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Audio file required' });
      }

      if (req.user.credits < 1) {
        return res.status(402).json({ error: 'Insufficient credits', creditsAvailable: req.user.credits });
      }

      const jobData = {
        userId:   req.user.id,
        toolName,
        category: 'audio',
        params: {
          audioBuffer: req.file.buffer,
          mimeType:    req.file.mimetype,
          ...JSON.parse(req.body.params || '{}'),
        },
      };

      const { jobId } = await addHeavyJob(jobData);
      res.json({ jobId, message: 'Audio processing started.' });

    } catch (err) {
      logger.error('Audio tool error', { error: err.message });
      res.status(500).json({ error: 'Audio processing failed' });
    }
  }
);

// ── GET /api/tools/status/:jobId ─────────
router.get('/status/:jobId', authMiddleware, async (req, res) => {
  try {
    const status = await getJobStatus(req.params.jobId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// ── POST /api/tools/improve ──────────────
// Improve a previous result — PAID USERS ONLY
router.post('/improve',
  authMiddleware,
  requireSubscription,
  toolLimiter,
  async (req, res) => {
    // Block free users
    if (req.isFreeUser) {
      return res.status(403).json({
        error: 'The Improve feature requires a paid plan. Upgrade to unlock it.',
        code:  'FREE_PLAN_FEATURE_RESTRICTED',
        upgradeUrl: '/pricing.html',
        isFreeLimit: true,
      });
    }
    try {
      const { projectId, instruction } = req.body;

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.user.id },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Route through hidden provider engine (Copilot/Gemini) with sanitization
      const { text: improvedOutput, tokensUsed } = await cp.generate({
        systemPrompt: 'You are an expert editor. Improve the provided content based on the user\'s instruction while maintaining the original intent and quality.',
        userPrompt:   `Original content:\n\n${project.output}\n\nImprovement instruction: ${instruction || 'Make it better, clearer, and more engaging.'}`,
        maxTokens:    2000,
        temperature:  0.7,
      });

      // Update project with improved output
      const updated = await prisma.project.update({
        where: { id: projectId },
        data:  { output: improvedOutput },
      });

      // Track usage
      await prisma.usage.create({
        data: {
          userId:    req.user.id,
          toolName:  `${project.toolName}-improve`,
          category:  project.category,
          tokensUsed,
          success:   true,
        },
      });

      res.json({
        success: true,
        output:  improvedOutput,
        projectId,
        tokensUsed,
      });

    } catch (err) {
      logger.error('Improve tool error', { error: err.message });
      res.status(500).json({ error: 'Failed to improve result' });
    }
  }
);

// ── POST /api/tools/regenerate ────────────
// Regenerate — PAID USERS ONLY
router.post('/regenerate',
  authMiddleware,
  requireSubscription,
  toolLimiter,
  async (req, res) => {
    // Block free users
    if (req.isFreeUser) {
      return res.status(403).json({
        error: 'The Regenerate feature requires a paid plan. Upgrade to unlock it.',
        code:  'FREE_PLAN_FEATURE_RESTRICTED',
        upgradeUrl: '/pricing.html',
        isFreeLimit: true,
      });
    }
    try {
      const { projectId } = req.body;

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.user.id },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const category = TOOL_CATEGORIES[project.toolName];
      const params   = JSON.parse(project.input || '{}');

      const jobData = {
        userId:       req.user.id,
        toolName:     project.toolName,
        category:     category || project.category,
        params,
        projectTitle: `${project.title} (regenerated)`,
      };

      if (HEAVY_TOOLS.has(project.toolName)) {
        const { jobId } = await addHeavyJob(jobData);
        return res.json({ jobId, message: 'Regeneration queued.' });
      }

      const result = await runLightJob(jobData);
      res.json({
        success:    true,
        output:     result.output,
        outputType: result.outputType,
        projectId:  result.projectId,
      });

    } catch (err) {
      logger.error('Regenerate error', { error: err.message });
      res.status(500).json({ error: 'Regeneration failed' });
    }
  }
);

// ── GET /api/tools/usage ─────────────────
router.get('/usage', authMiddleware, async (req, res) => {
  try {
    const { plan, monthlyTokensUsed, credits } = req.user;
    const { PLAN_TOKEN_LIMITS, PLAN_CREDIT_LIMITS, FREE_DAILY_LIMIT } = require('../middleware/rateLimit');

    const tokenLimit  = PLAN_TOKEN_LIMITS[plan]  || PLAN_TOKEN_LIMITS.free;
    const creditLimit = PLAN_CREDIT_LIMITS[plan] || PLAN_CREDIT_LIMITS.free;

    // Get free daily usage from cache
    let freeDailyUsed = 0;
    let freeDailyRemaining = null;
    if (plan === 'free') {
      const { freeDailyCache } = require('../middleware/rateLimit');
      const today    = new Date().toISOString().slice(0, 10);
      const cacheKey = `free_daily_${req.user.id}_${today}`;
      // Note: freeDailyCache is not exported, so we approximate
      freeDailyRemaining = FREE_DAILY_LIMIT; // Will be updated by frontend tracking
    }

    const usageByTool = await prisma.usage.groupBy({
      by:     ['toolName', 'category'],
      where:  { userId: req.user.id },
      _count: { id: true },
      _sum:   { tokensUsed: true, creditsUsed: true },
      orderBy: { _count: { id: 'desc' } },
      take:   10,
    });

    res.json({
      plan,
      isFreeUser: plan === 'free',
      tokens: {
        used:       monthlyTokensUsed,
        limit:      tokenLimit,
        percentage: Math.min(100, Math.round((monthlyTokensUsed / tokenLimit) * 100)),
      },
      credits: {
        available: credits,
        limit:     creditLimit,
        used:      creditLimit - credits,
        percentage: Math.min(100, Math.round(((creditLimit - credits) / creditLimit) * 100)),
      },
      freeDaily: plan === 'free' ? {
        limit: FREE_DAILY_LIMIT,
        remaining: freeDailyRemaining,
      } : null,
      freeTools: plan === 'free' ? [...FREE_TOOLS] : null,
      topTools: usageByTool.map(u => ({
        toolName:   u.toolName,
        category:   u.category,
        uses:       u._count.id,
        tokensUsed: u._sum.tokensUsed || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

module.exports = router;
