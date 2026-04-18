const crypto = require('crypto');
const db     = require('../config/db');

/**
 * Middleware: authenticate external callers via API key
 * Expects header:  X-API-Key: lc_live_xxxxxxxxxxxxxxxx
 * OR query param:  ?api_key=lc_live_xxxxxxxxxxxxxxxx
 *
 * Attaches req.apiClient = { id, name, client_id, permissions, rate_limit }
 */
const apiKeyAuth = (requiredPermission) => async (req, res, next) => {
  const startTime = Date.now();
  let apiClientId = null;

  try {
    const rawKey = req.headers['x-api-key'] || req.query.api_key;
    if (!rawKey) {
      return res.status(401).json({
        success: false,
        error: 'MISSING_API_KEY',
        message: 'Provide your API key via X-API-Key header or api_key query parameter',
      });
    }

    // Hash the incoming key to compare with stored hash
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const [rows] = await db.query(
      `SELECT ac.*, c.name AS client_name
       FROM api_clients ac
       LEFT JOIN clients c ON ac.client_id = c.id
       WHERE ac.api_key = ? AND ac.is_active = 1
       AND (ac.expires_at IS NULL OR ac.expires_at > NOW())`,
      [hashedKey]
    );

    if (!rows.length) {
      await logAudit({ apiClientId: null, req, res, statusCode: 401, startTime });
      return res.status(401).json({
        success: false,
        error: 'INVALID_API_KEY',
        message: 'Invalid or expired API key',
      });
    }

    const apiClient = rows[0];
    apiClientId = apiClient.id;

    // Parse permissions
    let permissions = [];
    try {
      permissions = typeof apiClient.permissions === 'string'
        ? JSON.parse(apiClient.permissions)
        : (apiClient.permissions || []);
    } catch (_) {}

    // Check required permission
    if (requiredPermission && !permissions.includes(requiredPermission) && !permissions.includes('*')) {
      await logAudit({ apiClientId, req, res, statusCode: 403, startTime });
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `This API key does not have the '${requiredPermission}' permission`,
      });
    }

    // Update last_used_at (fire and forget)
    db.query('UPDATE api_clients SET last_used_at = NOW() WHERE id = ?', [apiClient.id]).catch(() => {});

    req.apiClient = {
      id:          apiClient.id,
      name:        apiClient.name,
      client_id:   apiClient.client_id,
      client_name: apiClient.client_name,
      permissions,
      rate_limit:  apiClient.rate_limit,
    };

    next();

    // Log after response
    res.on('finish', () => {
      logAudit({ apiClientId, req, res, statusCode: res.statusCode, startTime }).catch(() => {});
    });

  } catch (err) {
    console.error('API key auth error:', err.message);
    res.status(500).json({ success: false, error: 'AUTH_ERROR', message: 'Authentication service error' });
  }
};

async function logAudit({ apiClientId, req, res, statusCode, startTime }) {
  try {
    const duration = Date.now() - startTime;
    const body = { ...req.body };
    // Redact sensitive fields
    ['password', 'api_key', 'auth_key_value'].forEach(k => { if (body[k]) body[k] = '[REDACTED]'; });

    await db.query(
      `INSERT INTO api_audit_log (api_client_id, endpoint, method, ip_address, request_body, response_code, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        apiClientId,
        req.originalUrl || req.url,
        req.method,
        req.ip || req.connection?.remoteAddress,
        JSON.stringify(body),
        statusCode,
        duration,
      ]
    );
  } catch (_) { /* non-critical */ }
}

module.exports = { apiKeyAuth };