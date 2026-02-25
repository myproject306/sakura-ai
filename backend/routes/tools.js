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
const { toolLimiter, heavyToolLimiter, checkTokenLimit } = require('../middleware/rateLimit');
const { addHeavyJob, runLightJob, getJobStatus } = require('../services/queue');

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

// ── GET /api/tools/list ──────────────────
router.get('/list', (req, res) => {
  const tools = Object.entries(TOOL_CATEGORIES).map(([id, category]) => ({
    id,
    category,
    isHeavy:   HEAVY_TOOLS.has(id),
    requiresPro: PRO_TOOLS.has(id),
  }));
  res.json({ tools });
});

// ── POST /api/tools/run ──────────────────
router.post('/run',
  authMiddleware,
  requireSubscription,
  toolLimiter,
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

      // Check plan for Pro tools
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

      res.json({
        success:    true,
        output:     result.output,
        outputType: result.outputType,
        tokensUsed: result.tokensUsed,
        projectId:  result.projectId,
        durationMs: result.durationMs,
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
// Improve a previous result
router.post('/improve',
  authMiddleware,
  requireSubscription,
  toolLimiter,
  async (req, res) => {
    try {
      const { projectId, instruction } = req.body;

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.user.id },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_TEXT || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert editor. Improve the provided content based on the user\'s instruction while maintaining the original intent and quality.',
          },
          {
            role: 'user',
            content: `Original content:\n\n${project.output}\n\nImprovement instruction: ${instruction || 'Make it better, clearer, and more engaging.'}`,
          },
        ],
        max_tokens:  2000,
        temperature: 0.7,
      });

      const improvedOutput = response.choices[0].message.content;
      const tokensUsed     = response.usage.total_tokens;

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
router.post('/regenerate',
  authMiddleware,
  requireSubscription,
  toolLimiter,
  async (req, res) => {
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
    const { PLAN_TOKEN_LIMITS, PLAN_CREDIT_LIMITS } = require('../middleware/rateLimit');

    const tokenLimit  = PLAN_TOKEN_LIMITS[plan]  || PLAN_TOKEN_LIMITS.free;
    const creditLimit = PLAN_CREDIT_LIMITS[plan] || PLAN_CREDIT_LIMITS.free;

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
