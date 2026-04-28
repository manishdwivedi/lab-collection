const bcrypt = require('bcryptjs');
const db     = require('../config/db');

/* ────────────────────────────────────────────────────────────
   Shared helper: resolve client_id for the calling user
   – admin passes client_id in body
   – client_user uses their linked client_id
   ──────────────────────────────────────────────────────────── */
const resolveClientId = (req) => {
  if (req.user.role === 'admin') return req.body.client_id || null;
  if (req.user.role === 'client_user') return req.user.client_id;
  return null;
};

/* ── GET /api/client/bookings ─── client portal sees own bookings ── */
exports.getClientBookings = async (req, res) => {
  try {
    const clientId = req.user.client_id;
    if (!clientId) return res.status(403).json({ success: false, message: 'No client linked' });

    const { status, date_from, date_to, search } = req.query;
    let q = `
      SELECT b.id, b.booking_number, b.patient_name, b.patient_phone,
             b.final_amount, b.booking_status, b.payment_status,
             b.report_status, b.collection_type, b.collection_date,
             b.created_at,
             p.id AS phlebo_profile_id,
             pu.name AS phlebo_name,
             GROUP_CONCAT(bi.test_name SEPARATOR ', ') AS tests
      FROM bookings b
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      LEFT JOIN phlebotomists p  ON b.phlebo_id = p.id
      LEFT JOIN users pu         ON p.user_id = pu.id
      WHERE b.client_id = ?
    `;
    const params = [clientId];
    if (status)    { q += ' AND b.booking_status = ?';          params.push(status); }
    if (date_from) { q += ' AND DATE(b.created_at) >= ?';       params.push(date_from); }
    if (date_to)   { q += ' AND DATE(b.created_at) <= ?';       params.push(date_to); }
    if (search)    { q += ' AND (b.booking_number LIKE ? OR b.patient_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    q += ' GROUP BY b.id ORDER BY b.created_at DESC LIMIT 200';

    const [bookings] = await db.query(q, params);
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/client/bookings/:id ─── single booking detail ── */
exports.getClientBooking = async (req, res) => {
  try {
    const clientId = req.user.client_id;
    const [rows] = await db.query(`
      SELECT b.*, pu.name AS phlebo_name, p.phone AS phlebo_phone, p.employee_code
      FROM bookings b
      LEFT JOIN phlebotomists p ON b.phlebo_id = p.id
      LEFT JOIN users pu        ON p.user_id   = pu.id
      WHERE b.id = ? AND b.client_id = ?
    `, [req.params.id, clientId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Booking not found' });

    const [items] = await db.query('SELECT * FROM booking_items WHERE booking_id = ?', [req.params.id]);
    const [reports] = await db.query(
      'SELECT id, file_name, file_size, mime_type, notes, created_at FROM booking_reports WHERE booking_id = ? AND is_active = 1',
      [req.params.id]
    );
    res.json({ success: true, booking: { ...rows[0], items, reports } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/client/bookings ─── client creates booking ── */
exports.createClientBooking = async (req, res) => {
  try {
    const clientId = req.user.client_id;
    if (!clientId) return res.status(403).json({ success: false, message: 'No client linked' });

    // Delegate to the shared booking creation logic
    req.body.client_id = clientId;
    // use existing createBooking but set user_id to creating user
    const bookingController = require('./bookingController');
    return bookingController.createBooking(req, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/client/profile ─── client sees their own info ── */
exports.getClientProfile = async (req, res) => {
  try {
    const clientId = req.user.client_id;
    const [rows] = await db.query(
      `SELECT c.*, rl.name AS rate_list_name
       FROM clients c
       LEFT JOIN client_rate_lists crl ON c.id = crl.client_id AND crl.is_active = 1
       LEFT JOIN rate_lists rl ON crl.rate_list_id = rl.id
       WHERE c.id = ?`, [clientId]
    );
    res.json({ success: true, client: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/client/tests ─── tests with client-specific prices ── */
exports.getClientTests = async (req, res) => {
  try {
    const clientId = req.user.client_id;
    // Fetch active rate list for client
    const [rl] = await db.query(
      `SELECT rate_list_id FROM client_rate_lists WHERE client_id = ? AND is_active = 1
       AND (effective_to IS NULL OR effective_to >= CURDATE())
       ORDER BY created_at DESC LIMIT 1`, [clientId]
    );
    const rateListId = rl[0]?.rate_list_id || null;

    const [tests] = await db.query(`
      SELECT t.id, t.name, t.code, t.description, t.sample_type, t.report_time,
             t.fasting_required, t.base_price, c.name AS category_name,
             COALESCE(rli.price, t.base_price) AS client_price
      FROM tests t
      LEFT JOIN test_categories c ON t.category_id = c.id
      LEFT JOIN rate_list_items rli ON rli.test_id = t.id AND rli.rate_list_id = ?
      WHERE t.is_active = 1
      ORDER BY c.name, t.name
    `, [rateListId]);
    res.json({ success: true, tests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   ADMIN: create a client portal user and link to a client
   POST /api/admin/clients/:clientId/users
   ───────────────────────────────────────────────────────────── */
exports.createClientUser = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, email, phone, password, is_primary } = req.body;
    const { clientId } = req.params;

    if (!name || !email || !phone) return res.status(400).json({ success: false, message: 'name, email, phone required' });

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Email already registered' });

    const hashed = await bcrypt.hash(password || 'Client@123', 10);
    const [uRes] = await conn.query(
      'INSERT INTO users (name, email, phone, password, role) VALUES (?,?,?,?,?)',
      [name, email, phone, hashed, 'client_user']
    );

    await conn.query(
      'INSERT INTO client_users (client_id, user_id, is_primary) VALUES (?,?,?)',
      [clientId, uRes.insertId, is_primary ? 1 : 0]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Client portal user created', userId: uRes.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ── GET /api/admin/clients/:clientId/users ── */
exports.getClientUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT cu.id, cu.is_primary, cu.is_active, cu.created_at,
             u.id AS user_id, u.name, u.email, u.phone, u.is_active AS user_active
      FROM client_users cu
      JOIN users u ON cu.user_id = u.id
      WHERE cu.client_id = ?
      ORDER BY cu.is_primary DESC, u.name
    `, [req.params.clientId]);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── DELETE /api/admin/client-users/:id ── */
exports.deleteClientUser = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id FROM client_users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    await db.query('UPDATE client_users SET is_active = 0 WHERE id = ?', [req.params.id]);
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [rows[0].user_id]);
    res.json({ success: true, message: 'Client user deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/admin/clients/:clientId/rate-list-tests ──────────
   Returns ALL active tests with the effective price for a specific
   client (rate list price if assigned, else base price).
   Also returns the active rate list info for that client.
   ─────────────────────────────────────────────────────────── */
exports.getClientRateListTests = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { search, category_id } = req.query;

    // Get client info + active rate list
    const [clientRows] = await db.query(`
      SELECT c.id, c.name, c.code,
             crl.rate_list_id, rl.name AS rate_list_name,
             crl.effective_from, crl.effective_to
      FROM   clients c
      LEFT   JOIN client_rate_lists crl
               ON c.id = crl.client_id AND crl.is_active = 1
               AND (crl.effective_to IS NULL OR crl.effective_to >= CURDATE())
      LEFT   JOIN rate_lists rl ON crl.rate_list_id = rl.id
      WHERE  c.id = ?
      ORDER  BY crl.created_at DESC
      LIMIT  1
    `, [clientId]);

    if (!clientRows.length)
      return res.status(404).json({ success: false, message: 'Client not found' });

    const client     = clientRows[0];
    const rateListId = client.rate_list_id || null;

    // Build test query with effective prices
    let where  = 'WHERE t.is_active = 1';
    const params = [rateListId];

    if (category_id) { where += ' AND t.category_id = ?'; params.push(category_id); }
    if (search)      {
      where += ' AND (t.name LIKE ? OR t.code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [tests] = await db.query(`
      SELECT t.id, t.type, t.name, t.code, t.description,
             t.sample_type, t.report_time, t.fasting_required,
             t.base_price,
             COALESCE(rli.price, t.base_price) AS effective_price,
             CASE WHEN rli.price IS NOT NULL THEN 1 ELSE 0 END AS has_custom_price,
             rli.price AS list_price,
             cat.name AS category
      FROM   tests t
      LEFT   JOIN rate_list_items rli
               ON rli.test_id = t.id AND rli.rate_list_id = ?
      LEFT   JOIN test_categories cat ON t.category_id = cat.id
      ${where}
      ORDER  BY cat.name, t.type, t.name
    `, params);

    // Compute savings summary
    const withCustom = tests.filter(t => t.has_custom_price);
    const totalSavings = withCustom.reduce(
      (sum, t) => sum + (parseFloat(t.base_price) - parseFloat(t.list_price)), 0
    );

    res.json({
      success: true,
      client: {
        id:              client.id,
        name:            client.name,
        code:            client.code,
        rate_list_id:    rateListId,
        rate_list_name:  client.rate_list_name || null,
        effective_from:  client.effective_from,
        effective_to:    client.effective_to,
      },
      tests,
      summary: {
        total_tests:        tests.length,
        custom_priced:      withCustom.length,
        base_priced:        tests.length - withCustom.length,
        avg_savings_pct:    withCustom.length
          ? (withCustom.reduce((s, t) => s + ((parseFloat(t.base_price) - parseFloat(t.list_price)) / parseFloat(t.base_price)) * 100, 0) / withCustom.length).toFixed(1)
          : 0,
        total_savings:      totalSavings.toFixed(2),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};