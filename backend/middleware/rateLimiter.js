const rateLimit = require('express-rate-limit');
const logger    = require('../config/logger');

const isProd = process.env.NODE_ENV === 'production';

/* ── Helper: uniform 429 response ────────────────────── */
const handler429 = (req, res) => {
  logger.warn('Rate limit hit', {
    ip:   req.ip,
    path: req.originalUrl,
  });
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down and try again later.',
    retryAfter: Math.ceil(req.rateLimit?.resetTime
      ? (req.rateLimit.resetTime - Date.now()) / 1000
      : 60),
  });
};

/* ── Key generator — use real IP behind Vercel proxy ── */
const realIpKey = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0].trim() ||
  req.headers['x-real-ip'] ||
  req.ip;

/* ── 1. Login / Register ────────────────────────────── */
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             isProd ? 50 : 10,   // ← higher in production
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  handler:         handler429,
  keyGenerator:    realIpKey,          // ← use real IP
  skipSuccessfulRequests: true,
});

/* ── 2. General API ─────────────────────────────────── */
const apiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             isProd ? 1000 : 300, // ← higher in production
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  handler:         handler429,
  keyGenerator:    realIpKey,           // ← use real IP
  skip: (req) =>
    req.path.startsWith('/health') || req.method === 'OPTIONS',
});

/* ── 3. External API v1 ─────────────────────────────── */
const externalApiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             200,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  handler:         handler429,
  keyGenerator: (req) =>
    req.headers['x-api-key']?.slice(0, 12) || realIpKey(req),
});

/* ── 4. File upload ─────────────────────────────────── */
const uploadLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             20,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  handler:         handler429,
  keyGenerator:    realIpKey,
});

module.exports = { authLimiter, apiLimiter, externalApiLimiter, uploadLimiter };
