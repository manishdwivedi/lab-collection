/**
 * Structured logger using Winston
 * Writes JSON logs to rotating daily files + coloured console in dev
 */
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs   = require('fs');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const isProd = process.env.NODE_ENV === 'production';

/* ── Shared formatters ───────────────────────────────── */
const baseFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
);

const jsonFormat = format.combine(baseFormat, format.json());

const consoleFormat = format.combine(
  baseFormat,
  format.colorize(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${message}${extras}`;
  })
);

/* ── Transports ──────────────────────────────────────── */
const fileTransports = [
  // All logs
  new transports.DailyRotateFile({
    filename:      path.join(LOG_DIR, 'app-%DATE%.log'),
    datePattern:   'YYYY-MM-DD',
    zippedArchive: true,
    maxSize:       '20m',
    maxFiles:      '30d',
    format:        jsonFormat,
  }),
  // Errors only
  new transports.DailyRotateFile({
    filename:      path.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern:   'YYYY-MM-DD',
    zippedArchive: true,
    maxSize:       '10m',
    maxFiles:      '30d',
    level:         'error',
    format:        jsonFormat,
  }),
];

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  transports: [
    ...fileTransports,
    new transports.Console({ format: consoleFormat }),
  ],
  exitOnError: false,
});

/* ── Express request logger middleware ───────────────── */
logger.requestMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level    = res.statusCode >= 500 ? 'error'
                   : res.statusCode >= 400 ? 'warn'
                   : 'info';
    logger[level]('HTTP', {
      method:   req.method,
      path:     req.originalUrl,
      status:   res.statusCode,
      duration: `${duration}ms`,
      ip:       req.ip || req.connection?.remoteAddress,
      user_id:  req.user?.id || null,
    });
  });
  next();
};

module.exports = logger;