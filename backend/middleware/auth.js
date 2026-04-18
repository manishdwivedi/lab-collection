const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await db.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = rows[0];

    // Attach phlebo profile id if role is phlebo
    if (req.user.role === 'phlebo') {
      const [ph] = await db.query('SELECT id FROM phlebotomists WHERE user_id = ?', [req.user.id]);
      req.user.phlebo_id = ph[0]?.id || null;
    }

    // Attach client_id if role is client_user
    if (req.user.role === 'client_user') {
      const [cu] = await db.query(
        'SELECT client_id FROM client_users WHERE user_id = ? AND is_active = 1',
        [req.user.id]
      );
      req.user.client_id = cu[0]?.client_id || null;
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const adminOrPhlebo = (req, res, next) => {
  if (!['admin', 'phlebo'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
};

const clientUserOnly = (req, res, next) => {
  if (req.user.role !== 'client_user') {
    return res.status(403).json({ success: false, message: 'Client portal access required' });
  }
  next();
};

module.exports = { protect, adminOnly, adminOrPhlebo, clientUserOnly };