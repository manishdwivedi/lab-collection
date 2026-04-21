/**
 * External API Controller
 * Endpoints consumed by 3rd-party clients (hospitals, LIMS, etc.)
 * All routes protected by apiKeyAuth middleware.
 */
const path         = require('path');
const fs           = require('fs');
const db           = require('../config/db');
const { UPLOAD_DIR }  = require('../middleware/upload');
const emailService = require('../services/emailService');

// Re-use booking creation logic
const { createBooking: _createBooking } = require('./bookingController');

/* ─────────────────────────────────────────────────────────────
   POST /api/v1/bookings
   External booking creation — authenticated via API key
   Permission required: bookings:write
   ───────────────────────────────────────────────────────────── */
exports.externalCreateBooking = async (req, res) => {
  try {
    const {
      patient_name, patient_age, patient_gender, patient_phone, patient_address,
      collection_type, collection_date, collection_time, collection_address,
      test_ids, test_codes,          // accept either test IDs or lab codes
      notes, external_reference_id, // caller's own ref
    } = req.body;

    if (!patient_name || !patient_phone)
      return res.status(400).json({
        success: false, error: 'VALIDATION_ERROR',
        message: 'patient_name and patient_phone are required',
      });

    // Resolve test_ids from test_codes if provided
    let resolvedTestIds = test_ids || [];
    if ((!resolvedTestIds.length) && test_codes?.length) {
      for (const code of test_codes) {
        const [rows] = await db.query('SELECT id FROM tests WHERE code = ? AND is_active = 1', [code.trim()]);
        if (rows.length) resolvedTestIds.push(rows[0].id);
      }
    }
    if (!resolvedTestIds.length)
      return res.status(400).json({
        success: false, error: 'NO_VALID_TESTS',
        message: 'No valid tests found. Provide test_ids or test_codes.',
      });

    // Determine client_id from API key's linked client
    const clientId = req.apiClient.client_id || null;

    // Build booking
    const generateBookingNumber = () => {
      const d = new Date();
      return `EXT${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${Math.floor(Math.random()*9000)+1000}`;
    };

    // Price each test
    let totalAmount = 0;
    const bookingItems = [];
    for (const testId of resolvedTestIds) {
      const [testRow] = await db.query('SELECT * FROM tests WHERE id = ? AND is_active = 1', [testId]);
      if (!testRow.length) continue;
      const test = testRow[0];

      let price = parseFloat(test.base_price);
      if (clientId) {
        const [rateItem] = await db.query(`
          SELECT rli.price FROM rate_list_items rli
          JOIN client_rate_lists crl ON rli.rate_list_id = crl.rate_list_id
          WHERE crl.client_id = ? AND rli.test_id = ? AND crl.is_active = 1
          AND (crl.effective_to IS NULL OR crl.effective_to >= CURDATE())
          ORDER BY crl.created_at DESC LIMIT 1`, [clientId, testId]);
        if (rateItem.length) price = parseFloat(rateItem[0].price);
      }
      totalAmount += price;
      bookingItems.push({ test_id: testId, test_name: test.name, test_code: test.code, unit_price: price, quantity: 1, total_price: price });
    }

    const bookingNumber = generateBookingNumber();

    const [result] = await db.query(`
      INSERT INTO bookings
        (booking_number, client_id, patient_name, patient_age, patient_gender,
         patient_phone, patient_address, collection_type, collection_date,
         collection_time, collection_address, total_amount, final_amount,
         notes, payment_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        bookingNumber, clientId,
        patient_name, patient_age || null, patient_gender || null,
        patient_phone, patient_address || null,
        collection_type || 'home',
        collection_date || null, collection_time || null,
        collection_address || null,
        totalAmount, totalAmount,
        notes || null,
        'pending',        // external bookings default to pending payment
      ]
    );

    const bookingId = result.insertId;
    for (const item of bookingItems) {
      await db.query(
        'INSERT INTO booking_items (booking_id, test_id, test_name, test_code, unit_price, quantity, total_price) VALUES (?,?,?,?,?,?,?)',
        [bookingId, item.test_id, item.test_name, item.test_code, item.unit_price, item.quantity, item.total_price]
      );
    }

    res.status(201).json({
      success: true,
      booking: {
        id:             bookingId,
        booking_number: bookingNumber,
        patient_name,
        patient_phone,
        total_amount:   totalAmount,
        tests:          bookingItems.map(i => ({ code: i.test_code, name: i.test_name, price: i.unit_price })),
        status:         'pending',
        created_at:     new Date().toISOString(),
      },
      message: 'Booking created successfully',
    });
  } catch (err) {
    console.error('External booking error:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/v1/bookings/:bookingNumber
   Get booking status — Permission: bookings:read
   ───────────────────────────────────────────────────────────── */
exports.externalGetBooking = async (req, res) => {
  try {
    const clientId = req.apiClient.client_id;

    const [rows] = await db.query(`
      SELECT b.id, b.booking_number, b.patient_name, b.patient_phone,
             b.collection_type, b.collection_date, b.collection_time,
             b.booking_status, b.payment_status, b.report_status,
             b.total_amount, b.final_amount, b.created_at,
             GROUP_CONCAT(bi.test_name SEPARATOR ', ') AS tests
      FROM bookings b
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      WHERE b.booking_number = ?
      ${clientId ? 'AND b.client_id = ?' : ''}
      GROUP BY b.id`,
      clientId ? [req.params.bookingNumber, clientId] : [req.params.bookingNumber]
    );

    if (!rows.length)
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });

    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/v1/bookings/:bookingNumber/reports
   Upload report by 3rd-party lab — Permission: reports:write
   Accepts: multipart/form-data  field name: "report"
   OR JSON: { file_url, file_name, notes }
   ───────────────────────────────────────────────────────────── */
exports.externalUploadReport = async (req, res) => {
  try {
    const { bookingNumber } = req.params;
    const clientId          = req.apiClient.client_id;

    // Look up booking
    const [rows] = await db.query(
      `SELECT id FROM bookings WHERE booking_number = ? ${clientId ? 'AND client_id = ?' : ''}`,
      clientId ? [bookingNumber, clientId] : [bookingNumber]
    );
    if (!rows.length) {
      if (req.file) fs.existsSync(req.file.path) && fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });
    }
    const bookingId = rows[0].id;

    // --- Case 1: File uploaded as multipart ---
    if (req.file) {
      const relativePath = path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/');
      const [adminUser] = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const uploadedBy  = adminUser[0]?.id || 1;

      await db.query(
        `INSERT INTO booking_reports
           (booking_id, file_name, file_path, file_size, mime_type, uploaded_by, notes)
         VALUES (?,?,?,?,?,?,?)`,
        [bookingId, req.file.originalname, relativePath, req.file.size, req.file.mimetype, uploadedBy, req.body.notes || null]
      );
      await db.query(
        `UPDATE bookings SET report_status = 'ready',
          booking_status = CASE WHEN booking_status IN ('processing','sample_collected') THEN 'completed' ELSE booking_status END
         WHERE id = ?`, [bookingId]
      );

      // Email notification — fire and forget
      _sendReportEmail(bookingId, [{ file_name: req.file.originalname, file_size: req.file.size, mime_type: req.file.mimetype }], req.body.notes || null);

      return res.status(201).json({
        success: true,
        message: 'Report uploaded successfully',
        booking_number: bookingNumber,
        file_name: req.file.originalname,
      });
    }

    // --- Case 2: JSON body with file_url (remote file reference) ---
    const { file_url, file_name, notes, mime_type } = req.body;
    if (file_url && file_name) {
      const [adminUser] = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const uploadedBy  = adminUser[0]?.id || 1;

      await db.query(
        `INSERT INTO booking_reports
           (booking_id, file_name, file_path, file_size, mime_type, uploaded_by, notes)
         VALUES (?,?,?,?,?,?,?)`,
        [bookingId, file_name, file_url, 0, mime_type || 'application/pdf', uploadedBy, notes || null]
      );
      await db.query(
        `UPDATE bookings SET report_status = 'ready',
          booking_status = CASE WHEN booking_status IN ('processing','sample_collected') THEN 'completed' ELSE booking_status END
         WHERE id = ?`, [bookingId]
      );

      // Email notification — fire and forget
      _sendReportEmail(bookingId, [{ file_name, file_size: 0, mime_type: mime_type || 'application/pdf' }], notes || null);

      return res.status(201).json({
        success: true,
        message: 'Report reference recorded successfully',
        booking_number: bookingNumber,
        file_name,
      });
    }

    return res.status(400).json({
      success: false, error: 'VALIDATION_ERROR',
      message: 'Provide either a multipart file upload or JSON body with file_url and file_name',
    });
  } catch (err) {
    if (req.file) fs.existsSync(req.file.path) && fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/v1/tests
   List available tests (with client-specific prices if API key
   has a linked client) — Permission: bookings:read
   ───────────────────────────────────────────────────────────── */
exports.externalGetTests = async (req, res) => {
  try {
    const clientId    = req.apiClient.client_id;
    const { category, search } = req.query;

    const [rl] = clientId ? await db.query(
      `SELECT rate_list_id FROM client_rate_lists
       WHERE client_id = ? AND is_active = 1
       AND (effective_to IS NULL OR effective_to >= CURDATE())
       ORDER BY created_at DESC LIMIT 1`, [clientId]
    ) : [[]];
    const rateListId = rl[0]?.rate_list_id || null;

    let q = `
      SELECT t.id, t.code, t.name, t.description, t.sample_type, t.report_time,
             t.fasting_required, t.base_price,
             c.name AS category,
             COALESCE(rli.price, t.base_price) AS price
      FROM tests t
      LEFT JOIN test_categories c  ON t.category_id = c.id
      LEFT JOIN rate_list_items rli ON rli.test_id = t.id AND rli.rate_list_id = ?
      WHERE t.is_active = 1
    `;
    const params = [rateListId];
    if (category) { q += ' AND c.name = ?'; params.push(category); }
    if (search)   { q += ' AND (t.name LIKE ? OR t.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    q += ' ORDER BY c.name, t.name';

    const [tests] = await db.query(q, params);
    res.json({ success: true, count: tests.length, tests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
};

/* ── Internal helper shared across upload paths ─────────── */
async function _sendReportEmail(bookingId, reportFiles, labNotes) {
  try {
    const [rows] = await db.query(`
      SELECT b.booking_number, b.patient_name, b.collection_date, b.id,
             u.email AS patient_email,
             GROUP_CONCAT(bi.test_name SEPARATOR ', ') AS tests
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      WHERE b.id = ? GROUP BY b.id`, [bookingId]);

    const info = rows[0];
    if (!info?.patient_email) return;

    await emailService.sendReportReadyEmail({
      to:            info.patient_email,
      patientName:   info.patient_name,
      bookingNumber: info.booking_number,
      tests:         info.tests,
      reportFiles,
      collectionDate: info.collection_date,
      labNotes,
      bookingId,
    });
  } catch (err) {
    console.error('[Email] Non-fatal error in external upload:', err.message);
  }
}