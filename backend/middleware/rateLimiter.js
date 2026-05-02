const rateLimit = require('express-rate-limit');
const logger    = require('../config/logger');

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

/* ── 1. Login / Register — strict (brute-force protection) ── */
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,  // 15 minutes
  max:              10,               // 10 attempts per window
  standardHeaders:  'draft-7',
  legacyHeaders:    false,
  handler:          handler429,
  skipSuccessfulRequests: true,        // only count failures
});

/* ── 2. General API ─────────────────────────────────── */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 100,  // higher for prod
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
  handler: (req, res) => {
    res.status(429).json({ success: false, message: 'Too many requests' });
  }
});

/* ── 3. External API v1 — per API key ─────────────────
   Real per-key limiting is enforced in apiKeyAuth.js
   This adds a global IP-based safety net              */
const externalApiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             200,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  handler:         handler429,
  keyGenerator: (req) =>
    req.headers['x-api-key']?.slice(0, 12) || req.ip,  // key by API prefix or IP
});

/* ── 4. File upload — prevent upload flooding ─────── */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      20,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  handler:  handler429,
});

module.exports = { authLimiter, apiLimiter, externalApiLimiter, uploadLimiter };
