const https  = require('https');
const http   = require('http');
const url    = require('url');
const db     = require('../config/db');

/* ─── Helper: make HTTP(S) request ──────────────────────── */
const httpRequest = (options, postData) => new Promise((resolve, reject) => {
  const parsed    = url.parse(options.url);
  const isHttps   = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;

  const reqOptions = {
    hostname: parsed.hostname,
    port:     parsed.port || (isHttps ? 443 : 80),
    path:     parsed.path,
    method:   options.method || 'POST',
    headers:  options.headers || {},
    timeout:  (options.timeout || 30) * 1000,
  };

  const req = transport.request(reqOptions, (response) => {
    let data = '';
    response.on('data', chunk => { data += chunk; });
    response.on('end', () => {
      try { resolve({ status: response.statusCode, body: JSON.parse(data) }); }
      catch { resolve({ status: response.statusCode, body: data }); }
    });
  });

  req.on('error', reject);
  req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
  req.end();
});

/* ─── Build auth headers for a lab ──────────────────────── */
const buildAuthHeaders = (lab) => {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const keyValue = lab.auth_key_value || '';

  switch (lab.auth_type) {
    case 'api_key':  headers[lab.auth_key_name || 'X-API-Key'] = keyValue; break;
    case 'bearer':   headers['Authorization'] = keyValue.startsWith('Bearer ') ? keyValue : `Bearer ${keyValue}`; break;
    case 'basic':    headers['Authorization'] = `Basic ${Buffer.from(keyValue).toString('base64')}`; break;
    default:         headers[lab.auth_key_name || 'X-API-Key'] = keyValue;
  }

  // Merge any extra headers
  if (lab.extra_headers) {
    try {
      const extra = typeof lab.extra_headers === 'string' ? JSON.parse(lab.extra_headers) : lab.extra_headers;
      Object.assign(headers, extra);
    } catch (_) {}
  }
  return headers;
};

/* ─── Map our test codes to lab-specific codes ───────────── */
const mapTestCodes = (testCode, testCodeMapping) => {
  if (!testCodeMapping) return testCode;
  try {
    const map = typeof testCodeMapping === 'string' ? JSON.parse(testCodeMapping) : testCodeMapping;
    return map[testCode] || testCode;
  } catch { return testCode; }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/admin/bookings/:bookingId/push-to-lab
   Push a booking to a third-party lab
   ───────────────────────────────────────────────────────────── */
exports.pushToLab = async (req, res) => {
  const startTime = Date.now();
  let pushId = null;

  try {
    const { bookingId } = req.params;
    const { lab_id, dry_run = false } = req.body;

    if (!lab_id) return res.status(400).json({ success: false, message: 'lab_id is required' });

    // Fetch booking with tests
    const [bookings] = await db.query(`
      SELECT b.*, c.name AS client_name,
        GROUP_CONCAT(bi.test_code SEPARATOR ',') AS test_codes_raw,
        GROUP_CONCAT(bi.test_name SEPARATOR '|') AS test_names_raw
      FROM bookings b
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      WHERE b.id = ? GROUP BY b.id`, [bookingId]);

    if (!bookings.length)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const booking = bookings[0];

    // Fetch lab config
    const [labs] = await db.query('SELECT * FROM third_party_labs WHERE id = ? AND is_active = 1', [lab_id]);
    if (!labs.length)
      return res.status(404).json({ success: false, message: 'Lab not found or inactive' });

    const lab = labs[0];

    // Build test list with mapped codes
    const testCodes = (booking.test_codes_raw || '').split(',').filter(Boolean);
    const testNames = (booking.test_names_raw || '').split('|').filter(Boolean);
    const mappedTests = testCodes.map((code, i) => ({
      original_code: code,
      lab_code:      mapTestCodes(code, lab.test_code_mapping),
      name:          testNames[i] || code,
    }));

    // Construct payload
    const payload = {
      reference_number:  booking.booking_number,
      patient: {
        name:    booking.patient_name,
        age:     booking.patient_age,
        gender:  booking.patient_gender,
        phone:   booking.patient_phone,
        address: booking.patient_address,
      },
      collection: {
        type:    booking.collection_type,
        date:    booking.collection_date,
        time:    booking.collection_time,
        address: booking.collection_address,
      },
      tests: mappedTests.map(t => t.lab_code),
      tests_detail: mappedTests,
      client_name: booking.client_name || null,
      notes: booking.notes || null,
      amount: booking.final_amount,
    };

    // ── Create push log entry ──────────────────────────────
    const [pushRes] = await db.query(
      `INSERT INTO lab_pushes (booking_id, lab_id, push_status, request_payload, pushed_by)
       VALUES (?, ?, 'pending', ?, ?)`,
      [bookingId, lab_id, JSON.stringify(payload), req.user.id]
    );
    pushId = pushRes.insertId;

    if (dry_run) {
      await db.query('UPDATE lab_pushes SET push_status=?, response_payload=? WHERE id=?',
        ['success', JSON.stringify({ dry_run: true }), pushId]);
      return res.json({
        success: true,
        dry_run: true,
        message: 'Dry run — no actual request sent',
        payload,
        lab: { id: lab.id, name: lab.name, endpoint: lab.api_base_url + lab.booking_endpoint },
      });
    }

    // ── Make the actual HTTP request ───────────────────────
    const endpoint = lab.api_base_url.replace(/\/$/, '') + lab.booking_endpoint;
    let result;
    let pushStatus = 'success';
    let externalRef = null;
    let errorMsg = null;

    try {
      result = await httpRequest({
        url:     endpoint,
        method:  'POST',
        headers: buildAuthHeaders(lab),
        timeout: lab.timeout_seconds || 30,
      }, payload);

      if (result.status >= 200 && result.status < 300) {
        // Try to extract external reference from common response patterns
        const body = result.body;
        externalRef = body?.id || body?.booking_id || body?.order_id ||
                      body?.reference || body?.ref_id || body?.data?.id || null;
        pushStatus = 'success';
      } else {
        pushStatus = 'failed';
        errorMsg = `HTTP ${result.status}: ${JSON.stringify(result.body).substring(0, 200)}`;
      }
    } catch (httpErr) {
      pushStatus = 'failed';
      result = { status: 0, body: null };
      errorMsg = httpErr.message;
    }

    const duration = Date.now() - startTime;

    // Update push log
    await db.query(
      `UPDATE lab_pushes SET push_status=?, response_payload=?, http_status=?,
        error_message=?, external_ref=?, completed_at=NOW() WHERE id=?`,
      [pushStatus, JSON.stringify(result?.body), result?.status, errorMsg, externalRef, pushId]
    );

    // Update booking push status
    if (pushStatus === 'success') {
      await db.query(
        `UPDATE bookings SET push_status='pushed', pushed_to_lab_id=?, external_booking_ref=? WHERE id=?`,
        [lab_id, externalRef, bookingId]
      );
    } else {
      await db.query("UPDATE bookings SET push_status='failed' WHERE id=?", [bookingId]);
    }

    res.json({
      success: pushStatus === 'success',
      push_id: pushId,
      push_status: pushStatus,
      http_status: result?.status,
      external_ref: externalRef,
      lab: { id: lab.id, name: lab.name },
      error: errorMsg || undefined,
      duration_ms: duration,
      message: pushStatus === 'success'
        ? `Booking pushed to ${lab.name} successfully`
        : `Push to ${lab.name} failed: ${errorMsg}`,
    });
  } catch (err) {
    if (pushId) {
      await db.query("UPDATE lab_pushes SET push_status='failed', error_message=? WHERE id=?",
        [err.message, pushId]).catch(() => {});
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/bookings/:bookingId/push-log
   ───────────────────────────────────────────────────────────── */
exports.getPushLog = async (req, res) => {
  try {
    const [logs] = await db.query(`
      SELECT lp.*, tpl.name AS lab_name, tpl.code AS lab_code, u.name AS pushed_by_name
      FROM lab_pushes lp
      JOIN third_party_labs tpl ON lp.lab_id = tpl.id
      LEFT JOIN users u ON lp.pushed_by = u.id
      WHERE lp.booking_id = ?
      ORDER BY lp.pushed_at DESC`, [req.params.bookingId]);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── Third-party lab CRUD ──────────────────────────────────── */
exports.getLabs = async (req, res) => {
  try {
    const [labs] = await db.query(`
      SELECT tpl.id, tpl.name, tpl.code, tpl.api_base_url, tpl.auth_type,
             tpl.booking_endpoint, tpl.is_active, tpl.timeout_seconds, tpl.created_at,
             (SELECT COUNT(*) FROM lab_pushes lp WHERE lp.lab_id = tpl.id AND lp.push_status='success') AS total_pushes,
             (SELECT COUNT(*) FROM lab_pushes lp WHERE lp.lab_id = tpl.id AND lp.push_status='failed'
              AND DATE(lp.pushed_at) = CURDATE()) AS today_failures
      FROM third_party_labs tpl ORDER BY tpl.name`);
    res.json({ success: true, labs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLab = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM third_party_labs WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Lab not found' });
    // Redact auth value (show only last 4 chars)
    const lab = { ...rows[0] };
    if (lab.auth_key_value && lab.auth_key_value.length > 8) {
      lab.auth_key_value = '••••••••' + lab.auth_key_value.slice(-4);
    }
    res.json({ success: true, lab });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createLab = async (req, res) => {
  try {
    const {
      name, code, api_base_url, auth_type, auth_key_name, auth_key_value,
      booking_endpoint, report_webhook_secret, test_code_mapping, extra_headers,
      timeout_seconds, retry_attempts, notes
    } = req.body;

    if (!name || !code || !api_base_url)
      return res.status(400).json({ success: false, message: 'name, code, api_base_url required' });

    const [result] = await db.query(
      `INSERT INTO third_party_labs
        (name, code, api_base_url, auth_type, auth_key_name, auth_key_value,
         booking_endpoint, report_webhook_secret, test_code_mapping, extra_headers,
         timeout_seconds, retry_attempts, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, code.toUpperCase(), api_base_url, auth_type || 'api_key', auth_key_name, auth_key_value,
       booking_endpoint || '/bookings', report_webhook_secret, 
       test_code_mapping ? JSON.stringify(test_code_mapping) : null,
       extra_headers ? JSON.stringify(extra_headers) : null,
       timeout_seconds || 30, retry_attempts || 3, notes]
    );
    res.status(201).json({ success: true, message: 'Lab created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLab = async (req, res) => {
  try {
    const {
      name, api_base_url, auth_type, auth_key_name, auth_key_value,
      booking_endpoint, report_webhook_secret, test_code_mapping, extra_headers,
      timeout_seconds, retry_attempts, is_active, notes
    } = req.body;

    // Only update auth_key_value if it's not the masked placeholder
    const keyUpdate = auth_key_value && !auth_key_value.startsWith('••••');

    await db.query(
      `UPDATE third_party_labs SET
        name=?, api_base_url=?, auth_type=?, auth_key_name=?,
        ${keyUpdate ? 'auth_key_value=?,' : ''}
        booking_endpoint=?, report_webhook_secret=?,
        test_code_mapping=?, extra_headers=?,
        timeout_seconds=?, retry_attempts=?, is_active=?, notes=?
       WHERE id=?`,
      [
        name, api_base_url, auth_type, auth_key_name,
        ...(keyUpdate ? [auth_key_value] : []),
        booking_endpoint, report_webhook_secret,
        test_code_mapping ? JSON.stringify(test_code_mapping) : null,
        extra_headers ? JSON.stringify(extra_headers) : null,
        timeout_seconds, retry_attempts, is_active ? 1 : 0, notes,
        req.params.id,
      ]
    );
    res.json({ success: true, message: 'Lab updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteLab = async (req, res) => {
  try {
    await db.query('UPDATE third_party_labs SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Lab deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/admin/lab-push-history ──────────────────────── */
exports.getPushHistory = async (req, res) => {
  try {
    const { lab_id, status, date } = req.query;
    let q = `
      SELECT lp.id, lp.booking_id, lp.external_ref, lp.push_status,
             lp.http_status, lp.error_message, lp.pushed_at, lp.completed_at,
             b.booking_number, b.patient_name,
             tpl.name AS lab_name, u.name AS pushed_by_name
      FROM lab_pushes lp
      JOIN bookings b ON lp.booking_id = b.id
      JOIN third_party_labs tpl ON lp.lab_id = tpl.id
      LEFT JOIN users u ON lp.pushed_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (lab_id) { q += ' AND lp.lab_id = ?';          params.push(lab_id); }
    if (status) { q += ' AND lp.push_status = ?';     params.push(status); }
    if (date)   { q += ' AND DATE(lp.pushed_at) = ?'; params.push(date); }
    q += ' ORDER BY lp.pushed_at DESC LIMIT 200';
    const [logs] = await db.query(q, params);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};