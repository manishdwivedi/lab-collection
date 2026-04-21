const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const logger = require('../config/logger');

const isProd = process.env.NODE_ENV === 'production';

/* ── Token helpers ──────────────────────────────────────── */
const generateAccessToken = (id) =>
  jwt.sign({ id, type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });

const generateRefreshToken = (id) =>
  jwt.sign({ id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });

const REFRESH_COOKIE_NAME = 'lc_refresh';

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });
};

const clearRefreshCookie = (res) =>
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });

function parseExpireToSeconds(str) {
  const m = str.match(/^(\d+)([smhd])$/);
  if (!m) return 900;
  return parseInt(m[1]) * { s:1, m:60, h:3600, d:86400 }[m[2]];
}

/* ── POST /api/auth/register ────────────────────────────── */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, address, date_of_birth, gender } = req.body;

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);  // bcrypt cost 12 (up from 10)
    const [result] = await db.query(
      'INSERT INTO users (name, email, phone, password, address, date_of_birth, gender) VALUES (?,?,?,?,?,?,?)',
      [name, email, phone, hashedPassword, address || null, date_of_birth || null, gender || null]
    );

    const userId  = result.insertId;
    const access  = generateAccessToken(userId);
    const refresh = generateRefreshToken(userId);
    setRefreshCookie(res, refresh);

    logger.info('User registered', { user_id: userId, email, ip: req.ip });

    res.status(201).json({
      success: true,
      token:   access,
      expiresIn: parseExpireToSeconds(process.env.JWT_EXPIRE || '15m'),
      user: { id: userId, name, email, phone, role: 'patient' },
    });
  } catch (err) {
    logger.error('Register error', { error: err.message, ip: req.ip });
    res.status(500).json({ success: false, message: isProd ? 'Registration failed' : err.message });
  }
};

/* ── POST /api/auth/login ───────────────────────────────── */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, password FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    // Constant-time comparison to prevent user enumeration via timing attacks
    const dummyHash = '$2a$12$dummyhashfortimingnull000000000000000000000000000000';
    const hash      = rows[0]?.password || dummyHash;
    const isMatch   = await bcrypt.compare(password, hash);

    if (!rows.length || !isMatch) {
      logger.warn('Failed login', { email, ip: req.ip });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user    = rows[0];
    const access  = generateAccessToken(user.id);
    const refresh = generateRefreshToken(user.id);
    setRefreshCookie(res, refresh);

    logger.info('User logged in', { user_id: user.id, role: user.role, ip: req.ip });

    res.json({
      success: true,
      token:   access,
      expiresIn: parseExpireToSeconds(process.env.JWT_EXPIRE || '15m'),
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message, ip: req.ip });
    res.status(500).json({ success: false, message: isProd ? 'Login failed' : err.message });
  }
};

/* ── POST /api/auth/refresh ─────────────────────────────── */
exports.refresh = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token)
      return res.status(401).json({ success: false, message: 'No refresh token', code: 'NO_REFRESH_TOKEN' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'Refresh token expired', code: 'REFRESH_EXPIRED' });
    }

    if (decoded.type !== 'refresh')
      return res.status(401).json({ success: false, message: 'Invalid token type', code: 'INVALID_TOKEN_TYPE' });

    const [rows] = await db.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );
    if (!rows.length) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const user       = rows[0];
    const newAccess  = generateAccessToken(user.id);
    const newRefresh = generateRefreshToken(user.id);   // rotate refresh token
    setRefreshCookie(res, newRefresh);

    res.json({
      success: true,
      token:   newAccess,
      expiresIn: parseExpireToSeconds(process.env.JWT_EXPIRE || '15m'),
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) {
    logger.error('Refresh error', { error: err.message });
    res.status(500).json({ success: false, message: isProd ? 'Token refresh failed' : err.message });
  }
};

/* ── POST /api/auth/logout ──────────────────────────────── */
exports.logout = async (req, res) => {
  clearRefreshCookie(res);
  logger.info('User logged out', { user_id: req.user?.id, ip: req.ip });
  res.json({ success: true, message: 'Logged out successfully' });
};

/* ── GET /api/auth/me ───────────────────────────────────── */
exports.getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, address, date_of_birth, gender, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    logger.error('getMe error', { error: err.message, user_id: req.user?.id });
    res.status(500).json({ success: false, message: isProd ? 'Failed to fetch profile' : err.message });
  }
};

/* ── PUT /api/auth/profile ──────────────────────────────── */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address, date_of_birth, gender } = req.body;
    await db.query(
      'UPDATE users SET name=?, phone=?, address=?, date_of_birth=?, gender=? WHERE id=?',
      [name, phone, address || null, date_of_birth || null, gender || null, req.user.id]
    );
    logger.info('Profile updated', { user_id: req.user.id });
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    logger.error('Profile update error', { error: err.message, user_id: req.user?.id });
    res.status(500).json({ success: false, message: isProd ? 'Update failed' : err.message });
  }
};
