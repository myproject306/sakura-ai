// ══════════════════════════════════════════
// Sakura AI — Google genai Interactions API
// POST /api/ai/interact
// GET  /api/ai/status
// ══════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const { spawn } = require('child_process');
const path    = require('path');
const { authMiddleware, requireSubscription } = require('../middleware/auth');
const { toolLimiter } = require('../middleware/rateLimit');

// ── GET /api/ai/status ────────────────────
router.get('/status', (req, res) => {
  const hasApiKey = !!(process.env.GOOGLE_API_KEY);
  res.json({
    configured: hasApiKey,
    service:    'google-genai-interactions',
    model:      process.env.GEMINI_NATIVE_MODEL || 'gemini-2.0-flash',
  });
});

// ── POST /api/ai/interact ─────────────────
router.post('/interact',
  authMiddleware,
  requireSubscription,
  toolLimiter,
  async (req, res) => {
    try {
      const { input, model } = req.body;

      if (!input || typeof input !== 'string' || !input.trim()) {
        return res.status(400).json({ error: 'input is required' });
      }

      const apiKey     = process.env.GOOGLE_API_KEY;
      const modelToUse = model || process.env.GEMINI_NATIVE_MODEL || 'gemini-2.0-flash';

      if (!apiKey) {
        return res.status(503).json({
          error: 'Google AI service not configured',
          code:  'GOOGLE_API_KEY_MISSING',
        });
      }

      const scriptPath = path.join(__dirname, '..', 'services', 'genaiInteractions.py');

      // Spawn Python process
      const py = spawn('python3', [scriptPath, input.trim(), modelToUse], {
        env: { ...process.env, GOOGLE_API_KEY: apiKey },
      });

      let stdout = '';
      let stderr = '';

      py.stdout.on('data', (d) => { stdout += d.toString(); });
      py.stderr.on('data', (d) => { stderr += d.toString(); });

      py.on('close', (code) => {
        try {
          const result = JSON.parse(stdout.trim());

          if (!result.success) {
            global.logger?.warn('genai interact failed', { error: result.error });
            return res.status(500).json({ error: result.error || 'AI request failed' });
          }

          res.json({
            success: true,
            text:    result.text,
            model:   result.model,
          });

        } catch (parseErr) {
          global.logger?.error('genai parse error', { stdout, stderr, parseErr: parseErr.message });
          res.status(500).json({ error: 'Failed to parse AI response' });
        }
      });

      py.on('error', (err) => {
        global.logger?.error('genai spawn error', { error: err.message });
        res.status(500).json({ error: 'Failed to start AI process' });
      });

    } catch (err) {
      global.logger?.error('AI interact error', { error: err.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
