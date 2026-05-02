require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');

const logger                                       = require('./config/logger');
const routes                                       = require('./routes');
const { apiLimiter }                               = require('./middleware/rateLimiter');

const app  = express();
const isProd = process.env.NODE_ENV === 'production';

/* ── 1. Security Headers (helmet) ──────────────────────────
   Sets: X-Content-Type-Options, X-Frame-Options, HSTS,
         Referrer-Policy, X-XSS-Protection, CSP, etc.      */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'checkout.razorpay.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:     ["'self'", 'fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", "https://*.vercel.app"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  hsts: isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}));

/* ── 2. Trust Proxy (required when behind Nginx / load balancer) */
// if (isProd) app.set('trust proxy', 1);
app.set('trust proxy', 1);

/* ── 3. CORS — lock to specific origin in production ───────── */
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://lab-collection-drab.vercel.app/')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    logger.warn('CORS blocked', { origin });
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

/* ── 4. Body parsers ───────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

/* ── 5. Request logger ─────────────────────────────────────── */
app.use(logger.requestMiddleware);

/* ── 6. Global rate limiter ─────────────────────────────────── */
app.use('/api', apiLimiter);

/* ── 7. Static files — only serve uploads via authenticated
        download endpoint, NOT as public static assets.
        Remove the static serve in production to avoid path
        traversal and unauthorised access.                       */
if (!isProd) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

/* ── 8. API Routes ──────────────────────────────────────────── */
app.use('/api', routes);

/* ── 9. Health check (no rate limit on this one) ───────────── */
app.get('/health', (req, res) => {
  res.json({
    status:      'OK',
    service:     'LabCollect API',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
  });
});

/* ── 10. 404 handler ────────────────────────────────────────── */
app.use((req, res) => {
  logger.warn('404', { method: req.method, path: req.originalUrl });
  res.status(404).json({ success: false, message: 'Route not found' });
});

/* ── 11. Global error handler ───────────────────────────────── */
app.use((err, req, res, next) => {               // eslint-disable-line no-unused-vars
  // CORS errors
  if (err.message === 'Not allowed by CORS')
    return res.status(403).json({ success: false, message: 'CORS policy violation' });

  // Multer / file upload errors
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 20 MB.' });
  if (err.code === 'LIMIT_FILE_COUNT')
    return res.status(400).json({ success: false, message: 'Too many files. Maximum is 10 per upload.' });
  if (err.message?.includes('Only PDF'))
    return res.status(400).json({ success: false, message: err.message });

  // Log all other errors with full stack
  logger.error('Unhandled error', {
    message:    err.message,
    stack:      err.stack,
    method:     req.method,
    path:       req.originalUrl,
    user_id:    req.user?.id,
    ip:         req.ip,
  });

  // ⚠️  Never expose internal details in production
  const message = isProd ? 'An internal server error occurred' : err.message;
  res.status(err.status || 500).json({ success: false, message });
});

/* ── Start ──────────────────────────────────────────────────── */
if (process.env.NODE_ENV !== 'production') {
  const PORT = parseInt(process.env.PORT || '5001', 10);
  app.listen(PORT, () => {
    logger.info('Server started', {
      port:        PORT,
      environment: process.env.NODE_ENV || 'development',
      pid:         process.pid,
    });
  });
}

app.get('/db-test', async (req, res) => {
  try {
    const pool = require('./config/db');
    console.log('Attempting DB connection...');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);
    
    const conn = await pool.getConnection();
    console.log('Connected!');
    const [rows] = await conn.query('SELECT 1+1 as result');
    conn.release();
    res.json({ success: true, result: rows[0].result });
  } catch (err) {
    console.error('DB Error:', err);
    res.json({ 
      success: false, 
      error: err.message,
      code: err.code,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      db: process.env.DB_NAME
    });
  }
});

/* ── Graceful shutdown ──────────────────────────────────────── */
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('uncaughtException',  err => logger.error('Uncaught exception',  { error: err.message, stack: err.stack }));
process.on('unhandledRejection', err => logger.error('Unhandled rejection', { error: String(err) }));

module.exports = app;
