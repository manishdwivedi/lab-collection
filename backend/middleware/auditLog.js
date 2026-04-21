/**
 * Audit Trail
 * Logs all mutating operations (INSERT / UPDATE / DELETE) to audit_log table.
 * Used as middleware on sensitive admin routes.
 */
const db     = require('../config/db');
const logger = require('../config/logger');

/**
 * Creates an Express middleware that logs admin actions to the audit_log table.
 *
 * @param {string} action  - Human-readable action label, e.g. 'update_booking'
 * @param {string} entity  - Table / resource name, e.g. 'bookings'
 */
const auditLog = (action, entity) => async (req, res, next) => {
  // Capture original json() to intercept the response body
  const originalJson = res.json.bind(res);

  res.json = async (body) => {
    // Only log successful mutations
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return originalJson(body);
    }

    try {
      const entityId =
        req.params?.id ||
        req.params?.bookingId ||
        req.params?.reportId ||
        body?.id ||
        body?.bookingId ||
        null;

      await db.query(
        `INSERT INTO audit_log
           (user_id, user_email, user_role, action, entity, entity_id,
            request_method, request_path, request_body, response_status, ip_address)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.user?.id    || null,
          req.user?.email || null,
          req.user?.role  || null,
          action,
          entity,
          entityId ? String(entityId) : null,
          req.method,
          req.originalUrl,
          JSON.stringify(sanitiseBody(req.body)),
          res.statusCode,
          req.ip || req.connection?.remoteAddress || null,
        ]
      );
    } catch (err) {
      // Non-fatal — log but don't block the response
      logger.error('Audit log insert failed', { error: err.message });
    }

    return originalJson(body);
  };

  next();
};

/** Remove sensitive fields before storing request body */
function sanitiseBody(body = {}) {
  const REDACT = ['password', 'auth_key_value', 'api_key', 'token', 'refresh_token'];
  const clean  = { ...body };
  REDACT.forEach(k => { if (clean[k]) clean[k] = '[REDACTED]'; });
  return clean;
}

module.exports = { auditLog };