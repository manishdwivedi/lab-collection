const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

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
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,           // not accessible from JS
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'lax',          // CSRF protection
    maxAge,
    path: '/api/auth',        // only sent on auth routes
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
};

/* ── POST /api/auth/register ────────────────────────────── */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, address, date_of_birth, gender } = req.body;
    if (!name || !email || !phone || !password)
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, phone, password, address, date_of_birth, gender) VALUES (?,?,?,?,?,?,?)',
      [name, email, phone, hashedPassword, address, date_of_birth, gender]
    );

    const userId   = result.insertId;
    const access   = generateAccessToken(userId);
    const refresh  = generateRefreshToken(userId);
    setRefreshCookie(res, refresh);

    res.status(201).json({
      success: true,
      token: access,
      expiresIn: parseInt(process.env.JWT_EXPIRE_SECONDS || '900'),
      user: { id: userId, name, email, phone, role: 'patient' },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/auth/login ───────────────────────────────── */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Please provide email and password' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const access  = generateAccessToken(user.id);
    const refresh = generateRefreshToken(user.id);
    setRefreshCookie(res, refresh);

    // Parse access token expiry into seconds for client-side countdown
    const expireStr = process.env.JWT_EXPIRE || '15m';
    const expireSeconds = parseExpireToSeconds(expireStr);

    res.json({
      success: true,
      token: access,
      expiresIn: expireSeconds,           // seconds until access token expires
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/auth/refresh ─────────────────────────────── 
   Uses the httpOnly refresh cookie to issue a new access token
   The frontend calls this silently before the access token expires
   ─────────────────────────────────────────────────────────── */
exports.refresh = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token)
      return res.status(401).json({ success: false, message: 'No refresh token', code: 'NO_REFRESH_TOKEN' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'Refresh token expired or invalid', code: 'REFRESH_EXPIRED' });
    }

    if (decoded.type !== 'refresh')
      return res.status(401).json({ success: false, message: 'Invalid token type', code: 'INVALID_TOKEN_TYPE' });

    // Make sure user still exists and is active
    const [rows] = await db.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );
    if (!rows.length) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const user      = rows[0];
    const newAccess = generateAccessToken(user.id);

    // Optionally rotate the refresh token on every refresh (sliding window)
    const newRefresh = generateRefreshToken(user.id);
    setRefreshCookie(res, newRefresh);

    const expireSeconds = parseExpireToSeconds(process.env.JWT_EXPIRE || '15m');

    res.json({
      success: true,
      token: newAccess,
      expiresIn: expireSeconds,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/auth/logout ──────────────────────────────── */
exports.logout = async (req, res) => {
  clearRefreshCookie(res);
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
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── PUT /api/auth/profile ──────────────────────────────── */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address, date_of_birth, gender } = req.body;
    await db.query(
      'UPDATE users SET name=?, phone=?, address=?, date_of_birth=?, gender=? WHERE id=?',
      [name, phone, address, date_of_birth, gender, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── Helper: parse JWT expire string to seconds ─────────── */
function parseExpireToSeconds(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 min
  const val  = parseInt(match[1]);
  const unit = match[2];
  const map  = { s: 1, m: 60, h: 3600, d: 86400 };
  return val * (map[unit] || 60);
}
