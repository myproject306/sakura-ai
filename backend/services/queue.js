// ══════════════════════════════════════════
// Sakura AI — Job Queue Service
// Uses Bull (Redis) for heavy jobs.
// Falls back to in-memory processing in dev.
// ══════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const { routeTool }    = require('./toolRouter');
const { deductCredits, addTokensUsed } = require('../middleware/rateLimit');

const prisma = new PrismaClient();

// ── In-memory job store (dev fallback) ───
const inMemoryJobs = new Map();
let jobCounter = 0;

// ── Try to initialize Bull queue ─────────
let queue = null;
let useQueue = false;

if (process.env.REDIS_URL) {
  try {
    const Bull = require('bull');
    queue = new Bull('sakura-ai-tools', process.env.REDIS_URL, {
      defaultJobOptions: {
        attempts:  3,
        backoff:   { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail:     50,
      },
    });

    // ── Process jobs ──────────────────────
    queue.process('tool-job', 5, async (job) => {
      return await processToolJob(job.data);
    });

    queue.on('completed', (job, result) => {
      logger.info('Job completed', { jobId: job.id, toolName: job.data.toolName });
    });

    queue.on('failed', (job, err) => {
      logger.error('Job failed', { jobId: job.id, toolName: job.data.toolName, error: err.message });
    });

    useQueue = true;
    logger.info('Bull queue initialized with Redis');
  } catch (err) {
    logger.warn('Bull/Redis not available, using in-memory processing', { error: err.message });
  }
}

// ══════════════════════════════════════════
// CORE JOB PROCESSOR
// ══════════════════════════════════════════

async function processToolJob(jobData) {
  const { userId, toolName, category, params, projectTitle, isFreeUser = false } = jobData;

  try {
    // Run the tool — pass isFreeUser for reduced tokens/no Bing
    const result = await routeTool(toolName, category, params, isFreeUser);

    // Track usage
    await prisma.usage.create({
      data: {
        userId,
        toolName,
        category,
        tokensUsed:  result.tokensUsed  || 0,
        creditsUsed: result.creditsUsed || 0,
        durationMs:  result.durationMs  || 0,
        success:     true,
      },
    });

    // Deduct credits for heavy tools
    if (result.creditsUsed > 0) {
      await deductCredits(userId, result.creditsUsed);
    }

    // Add tokens used
    if (result.tokensUsed > 0) {
      await addTokensUsed(userId, result.tokensUsed);
    }

    // Auto-save to projects — FREE users don't get project saving
    let projectId = null;
    if (!isFreeUser) {
      const project = await prisma.project.create({
        data: {
          userId,
          title:      projectTitle || `${toolName} — ${new Date().toLocaleDateString()}`,
          toolName,
          category,
          input:      JSON.stringify(params),
          output:     result.output,
          outputType: result.outputType || 'text',
        },
      });
      projectId = project.id;
    }

    return {
      success:    true,
      output:     result.output,
      outputType: result.outputType,
      tokensUsed: result.tokensUsed,
      creditsUsed: result.creditsUsed,
      projectId,
      durationMs: result.durationMs,
      isFreeUser,
    };

  } catch (err) {
    // Log error
    await prisma.usage.create({
      data: {
        userId,
        toolName,
        category,
        tokensUsed:  0,
        creditsUsed: 0,
        success:     false,
      },
    }).catch(() => {});

    await prisma.errorLog.create({
      data: {
        userId,
        toolName,
        error:    err.message,
        stack:    err.stack,
        severity: 'error',
      },
    }).catch(() => {});

    throw err;
  }
}

// ══════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════

/**
 * Add a tool job to the queue (heavy tools: image, audio, video)
 * Returns a jobId for polling
 */
async function addHeavyJob(jobData) {
  if (useQueue && queue) {
    const job = await queue.add('tool-job', jobData, {
      priority: getPriority(jobData.userId),
    });
    return { jobId: job.id.toString(), queued: true };
  }

  // In-memory fallback: process immediately but async
  const jobId = `mem_${++jobCounter}_${Date.now()}`;
  inMemoryJobs.set(jobId, { status: 'processing', createdAt: Date.now() });

  // Process in background
  processToolJob(jobData)
    .then(result => {
      inMemoryJobs.set(jobId, { status: 'completed', result, completedAt: Date.now() });
    })
    .catch(err => {
      inMemoryJobs.set(jobId, { status: 'failed', error: err.message, failedAt: Date.now() });
    });

  return { jobId, queued: false };
}

/**
 * Run a light tool synchronously (text, code, data)
 */
async function runLightJob(jobData) {
  return await processToolJob(jobData);
}

/**
 * Get job status by ID
 */
async function getJobStatus(jobId) {
  // Check in-memory jobs
  if (jobId.startsWith('mem_')) {
    const job = inMemoryJobs.get(jobId);
    if (!job) return { status: 'not_found' };
    return job;
  }

  // Check Bull queue
  if (useQueue && queue) {
    const job = await queue.getJob(jobId);
    if (!job) return { status: 'not_found' };

    const state = await job.getState();
    const result = job.returnvalue;
    const failReason = job.failedReason;

    return {
      status:    state,
      result:    state === 'completed' ? result : null,
      error:     state === 'failed'    ? failReason : null,
      progress:  job.progress(),
      createdAt: new Date(job.timestamp),
    };
  }

  return { status: 'not_found' };
}

/**
 * Get queue metrics (for admin)
 */
async function getQueueMetrics() {
  if (!useQueue || !queue) {
    return {
      active:    0,
      waiting:   0,
      completed: inMemoryJobs.size,
      failed:    0,
      mode:      'in-memory',
    };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed, mode: 'redis' };
}

// ── Helper ───────────────────────────────
function getPriority(userId) {
  // Could implement plan-based priority here
  return 0; // Normal priority
}

// ── Cleanup old in-memory jobs ────────────
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
  for (const [id, job] of inMemoryJobs.entries()) {
    if (job.createdAt < cutoff) inMemoryJobs.delete(id);
  }
}, 10 * 60 * 1000); // Every 10 min

module.exports = { addHeavyJob, runLightJob, getJobStatus, getQueueMetrics };
