const bcrypt = require('bcryptjs');
const db     = require('../config/db');

/* ── GET /api/admin/phlebos ─────────────────────────────── */
exports.getPhlebos = async (req, res) => {
  try {
    const [phlebos] = await db.query(`
      SELECT p.*, u.name, u.email, u.is_active AS user_active,
        (SELECT COUNT(*) FROM bookings b WHERE b.phlebo_id = p.id
          AND DATE(b.collection_date) = CURDATE()) AS today_assignments,
        (SELECT COUNT(*) FROM bookings b WHERE b.phlebo_id = p.id
          AND b.booking_status NOT IN ('completed','cancelled')) AS pending_assignments
      FROM phlebotomists p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_active = 1
      ORDER BY u.name
    `);
    res.json({ success: true, phlebos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/admin/phlebos/:id ─────────────────────────── */
exports.getPhlebo = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, u.name, u.email, u.phone AS user_phone, u.is_active AS user_active
      FROM phlebotomists p JOIN users u ON p.user_id = u.id
      WHERE p.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Phlebotomist not found' });

    const [assignments] = await db.query(`
      SELECT b.id, b.booking_number, b.patient_name, b.collection_date,
             b.collection_time, b.booking_status, b.created_at
      FROM bookings b WHERE b.phlebo_id = ?
      ORDER BY b.collection_date DESC, b.collection_time
      LIMIT 20
    `, [req.params.id]);

    res.json({ success: true, phlebo: { ...rows[0], assignments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/admin/phlebos ────────────────────────────── */
exports.createPhlebo = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name, email, phone, password,
      employee_code, alternate_phone, address, city,
      experience_years, qualification, joined_date, notes
    } = req.body;

    if (!name || !email || !phone || !employee_code)
      return res.status(400).json({ success: false, message: 'name, email, phone, employee_code required' });

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const hashed = await bcrypt.hash(password || 'Phlebo@123', 10);
    const [uRes] = await conn.query(
      'INSERT INTO users (name, email, phone, password, role) VALUES (?,?,?,?,?)',
      [name, email, phone, hashed, 'phlebo']
    );
    const userId = uRes.insertId;

    const [pRes] = await conn.query(
      `INSERT INTO phlebotomists
        (user_id, employee_code, phone, alternate_phone, address, city,
         experience_years, qualification, joined_date, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [userId, employee_code, phone, alternate_phone, address, city,
       experience_years || 0, qualification, joined_date, notes]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Phlebotomist created', id: pRes.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ── PUT /api/admin/phlebos/:id ─────────────────────────── */
exports.updatePhlebo = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name, phone, is_available, is_active,
      alternate_phone, address, city,
      experience_years, qualification, joined_date, notes
    } = req.body;

    const [rows] = await conn.query('SELECT user_id FROM phlebotomists WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    await conn.query('UPDATE users SET name=?, phone=?, is_active=? WHERE id=?',
      [name, phone, is_active !== false ? 1 : 0, rows[0].user_id]);

    await conn.query(
      `UPDATE phlebotomists SET phone=?, alternate_phone=?, address=?, city=?,
        experience_years=?, qualification=?, joined_date=?, notes=?,
        is_available=?, is_active=? WHERE id=?`,
      [phone, alternate_phone, address, city, experience_years || 0,
       qualification, joined_date, notes,
       is_available !== false ? 1 : 0, is_active !== false ? 1 : 0, req.params.id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Phlebotomist updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ── DELETE /api/admin/phlebos/:id ─────────────────────── */
exports.deletePhlebo = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id FROM phlebotomists WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    await db.query('UPDATE phlebotomists SET is_active = 0 WHERE id = ?', [req.params.id]);
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [rows[0].user_id]);
    res.json({ success: true, message: 'Phlebotomist deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/admin/phlebos/available ───────────────────── */
exports.getAvailablePhlebos = async (req, res) => {
  try {
    const { date } = req.query;
    const [phlebos] = await db.query(`
      SELECT p.id, u.name, p.employee_code, p.phone, p.city,
        (SELECT COUNT(*) FROM bookings b
          WHERE b.phlebo_id = p.id
          AND (? IS NULL OR DATE(b.collection_date) = ?)
          AND b.booking_status NOT IN ('completed','cancelled')) AS assigned_count
      FROM phlebotomists p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_active = 1 AND p.is_available = 1 AND u.is_active = 1
      ORDER BY assigned_count ASC, u.name
    `, [date || null, date || null]);
    res.json({ success: true, phlebos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/admin/bookings/:id/assign-phlebo ─────────── */
exports.assignPhlebo = async (req, res) => {
  try {
    const { phlebo_id } = req.body;
    const { id: bookingId } = req.params;

    const [booking] = await db.query('SELECT id, collection_type FROM bookings WHERE id = ?', [bookingId]);
    if (!booking.length) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (phlebo_id) {
      const [ph] = await db.query('SELECT id FROM phlebotomists WHERE id = ? AND is_active = 1', [phlebo_id]);
      if (!ph.length) return res.status(404).json({ success: false, message: 'Phlebotomist not found' });
    }

    await db.query(
      'UPDATE bookings SET phlebo_id = ?, phlebo_assigned_at = ? WHERE id = ?',
      [phlebo_id || null, phlebo_id ? new Date() : null, bookingId]
    );

    res.json({ success: true, message: phlebo_id ? 'Phlebotomist assigned' : 'Assignment removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/phlebo/my-assignments ─────────────────────── */
exports.getMyAssignments = async (req, res) => {
  try {
    const phleId = req.user.phlebo_id;
    if (!phleId) return res.status(403).json({ success: false, message: 'Phlebo profile not found' });

    const { date } = req.query;
    let query = `
      SELECT b.id, b.booking_number, b.patient_name, b.patient_phone,
             b.patient_address, b.collection_date, b.collection_time,
             b.collection_address, b.booking_status,
             GROUP_CONCAT(bi.test_name SEPARATOR ', ') AS tests
      FROM bookings b
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      WHERE b.phlebo_id = ? AND b.collection_type = 'home'
    `;
    const params = [phleId];
    if (date) { query += ' AND DATE(b.collection_date) = ?'; params.push(date); }
    query += ' GROUP BY b.id ORDER BY b.collection_date, b.collection_time';

    const [assignments] = await db.query(query, params);
    res.json({ success: true, assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};