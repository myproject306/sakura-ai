// ══════════════════════════════════════════
// Sakura AI — Main Express Server
// ══════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const winston    = require('winston');

// ── Logger ──────────────────────────────
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

global.logger = logger;

// ── App ──────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security Middleware ──────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5500',
    'https://sakura.ai',
    'https://www.sakura.ai',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Stripe webhook needs raw body BEFORE json parser ──
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// ── Body Parsers ─────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request Logging ──────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Static Files (serve frontend) ────────
app.use(express.static(path.join(__dirname, '..')));

// ── Health Check ─────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Sakura AI API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── API Routes ───────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/stripe',   require('./routes/stripe'));
app.use('/api/tools',    require('./routes/tools'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/ai',       require('./routes/ai'));


// ── 404 Handler ──────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── SPA Fallback (serve frontend for all non-API routes) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Global Error Handler ─────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Log to DB if Prisma is available
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.errorLog.create({
      data: {
        userId: req.user?.id,
        endpoint: req.url,
        error: err.message,
        stack: err.stack,
        severity: 'error',
      }
    }).catch(() => {});
  } catch (_) {}

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
});

// ── Start Server ─────────────────────────
app.listen(PORT, () => {
  logger.info(`🌸 Sakura AI Backend running on port ${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5500'}`);
});

module.exports = app;
