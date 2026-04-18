const crypto = require('crypto');
const db     = require('../config/db');

/** Generate a secure API key and return both raw (shown once) and hashed (stored) */
const generateApiKey = () => {
  const raw    = 'lc_live_' + crypto.randomBytes(24).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.substring(0, 12);   // "lc_live_xxxx"
  return { raw, hashed, prefix };
};

/* ── GET /api/admin/api-clients ─── */
exports.getApiClients = async (req, res) => {
  try {
    const [clients] = await db.query(`
      SELECT ac.id, ac.name, ac.description, ac.api_key_prefix,
             ac.permissions, ac.rate_limit, ac.is_active,
             ac.last_used_at, ac.expires_at, ac.created_at,
             c.name AS client_name, c.id AS client_id,
             u.name AS created_by_name
      FROM api_clients ac
      LEFT JOIN clients c  ON ac.client_id  = c.id
      LEFT JOIN users   u  ON ac.created_by = u.id
      ORDER BY ac.created_at DESC
    `);
    res.json({ success: true, apiClients: clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/admin/api-clients ─── create new key */
exports.createApiClient = async (req, res) => {
  try {
    const { name, description, client_id, permissions, rate_limit, expires_at } = req.body;

    if (!name)         return res.status(400).json({ success: false, message: 'Name is required' });
    if (!permissions?.length)
      return res.status(400).json({ success: false, message: 'At least one permission required' });

    const { raw, hashed, prefix } = generateApiKey();

    await db.query(
      `INSERT INTO api_clients
         (name, description, api_key, api_key_prefix, client_id, permissions, rate_limit, expires_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        name, description || null, hashed, prefix,
        client_id || null,
        JSON.stringify(permissions),
        rate_limit || 100,
        expires_at || null,
        req.user.id,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'API key created. Copy the key now — it will NOT be shown again.',
      apiKey: raw,      // shown ONCE
      prefix,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── PUT /api/admin/api-clients/:id ─── update (not the key itself) */
exports.updateApiClient = async (req, res) => {
  try {
    const { name, description, permissions, rate_limit, is_active, expires_at } = req.body;
    await db.query(
      `UPDATE api_clients
       SET name=?, description=?, permissions=?, rate_limit=?, is_active=?, expires_at=?
       WHERE id=?`,
      [name, description, JSON.stringify(permissions), rate_limit, is_active ? 1 : 0, expires_at || null, req.params.id]
    );
    res.json({ success: true, message: 'API client updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/admin/api-clients/:id/rotate ─── regenerate key */
exports.rotateApiKey = async (req, res) => {
  try {
    const { raw, hashed, prefix } = generateApiKey();
    await db.query(
      'UPDATE api_clients SET api_key=?, api_key_prefix=? WHERE id=?',
      [hashed, prefix, req.params.id]
    );
    res.json({
      success: true,
      message: 'API key rotated. Copy the new key — it will NOT be shown again.',
      apiKey: raw,
      prefix,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── DELETE /api/admin/api-clients/:id ─── revoke */
exports.revokeApiClient = async (req, res) => {
  try {
    await db.query('UPDATE api_clients SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/admin/api-clients/:id/audit-log ─── */
exports.getAuditLog = async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT * FROM api_audit_log WHERE api_client_id = ?
       ORDER BY created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/admin/api-audit-log ─── all logs */
exports.getAllAuditLogs = async (req, res) => {
  try {
    const { api_client_id, date } = req.query;
    let q = `SELECT al.*, ac.name AS client_name
             FROM api_audit_log al LEFT JOIN api_clients ac ON al.api_client_id = ac.id
             WHERE 1=1`;
    const params = [];
    if (api_client_id) { q += ' AND al.api_client_id = ?'; params.push(api_client_id); }
    if (date)          { q += ' AND DATE(al.created_at) = ?'; params.push(date); }
    q += ' ORDER BY al.created_at DESC LIMIT 200';
    const [logs] = await db.query(q, params);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};