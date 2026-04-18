-- ============================================================
-- Migration: External API Integration
-- Adds: API key auth, third-party lab push, external booking API
-- Run against existing lab_collection database
-- ============================================================
USE lab_collection;

-- ── 1. API Clients (3rd-party systems that call our API) ──
CREATE TABLE IF NOT EXISTS api_clients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,           -- "Apollo LIMS", "City Hospital System"
  description   TEXT,
  api_key       VARCHAR(64) UNIQUE NOT NULL,      -- hashed, shown once
  api_key_prefix VARCHAR(12) NOT NULL,            -- "lc_live_xxxx" shown in UI
  client_id     INT DEFAULT NULL,                 -- optional link to clients table
  permissions   JSON NOT NULL,                    -- ["bookings:write","reports:write","bookings:read"]
  rate_limit    INT DEFAULT 100,                  -- requests per minute
  is_active     BOOLEAN DEFAULT TRUE,
  last_used_at  DATETIME DEFAULT NULL,
  expires_at    DATETIME DEFAULT NULL,            -- NULL = no expiry
  created_by    INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id)  REFERENCES clients(id)  ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL
);

-- ── 2. Third-Party Labs (labs we PUSH bookings TO) ─────────
CREATE TABLE IF NOT EXISTS third_party_labs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,          -- "Thyrocare", "SRL Diagnostics"
  code            VARCHAR(50) UNIQUE NOT NULL,     -- "THYROCARE"
  api_base_url    VARCHAR(500) NOT NULL,           -- https://api.thyrocare.com/v1
  auth_type       ENUM('api_key','bearer','basic','oauth2') DEFAULT 'api_key',
  auth_key_name   VARCHAR(100) DEFAULT 'X-API-Key', -- header / param name
  auth_key_value  TEXT,                            -- encrypted in prod; plaintext for dev
  booking_endpoint VARCHAR(200) DEFAULT '/bookings',
  report_webhook_secret VARCHAR(200),             -- HMAC secret for incoming webhooks
  test_code_mapping JSON,                         -- {"CBC001":"THYRO_CBC","TSH001":"T1234"}
  extra_headers   JSON DEFAULT NULL,              -- {"X-Partner-Id":"LC123"}
  timeout_seconds INT DEFAULT 30,
  retry_attempts  INT DEFAULT 3,
  is_active       BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── 3. Lab Push Log (track every push attempt) ─────────────
CREATE TABLE IF NOT EXISTS lab_pushes (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT NOT NULL,
  lab_id           INT NOT NULL,
  external_ref     VARCHAR(200) DEFAULT NULL,  -- lab's own booking ID
  push_status      ENUM('pending','success','failed','partial','cancelled') DEFAULT 'pending',
  request_payload  JSON,
  response_payload JSON,
  http_status      INT,
  error_message    TEXT,
  pushed_by        INT DEFAULT NULL,           -- admin user who triggered
  pushed_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at     DATETIME DEFAULT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (lab_id)     REFERENCES third_party_labs(id) ON DELETE CASCADE,
  FOREIGN KEY (pushed_by)  REFERENCES users(id) ON DELETE SET NULL
);

-- ── 4. API Audit Log (every external API call we receive) ──
CREATE TABLE IF NOT EXISTS api_audit_log (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  api_client_id  INT DEFAULT NULL,
  endpoint       VARCHAR(300) NOT NULL,
  method         VARCHAR(10) NOT NULL,
  ip_address     VARCHAR(60),
  request_body   JSON,
  response_code  INT,
  response_body  JSON,
  duration_ms    INT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_client_id) REFERENCES api_clients(id) ON DELETE SET NULL
);

-- ── 5. Track external_booking_ref on bookings ─────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS external_booking_ref VARCHAR(200) DEFAULT NULL
    COMMENT 'Reference ID assigned by third-party lab after push'
    AFTER report_status,
  ADD COLUMN IF NOT EXISTS pushed_to_lab_id INT DEFAULT NULL
    COMMENT 'Which lab this booking was pushed to'
    AFTER external_booking_ref,
  ADD COLUMN IF NOT EXISTS push_status ENUM('not_pushed','pushed','failed','synced') DEFAULT 'not_pushed'
    AFTER pushed_to_lab_id,
  ADD FOREIGN KEY IF NOT EXISTS fk_booking_lab (pushed_to_lab_id) REFERENCES third_party_labs(id) ON DELETE SET NULL;

-- ── 6. Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_api_clients_key    ON api_clients(api_key);
CREATE INDEX IF NOT EXISTS idx_lab_pushes_booking ON lab_pushes(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_client       ON api_audit_log(api_client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_push      ON bookings(push_status);

-- ── 7. Sample data ─────────────────────────────────────────
-- Sample third-party lab (Thyrocare-style)
INSERT IGNORE INTO third_party_labs 
  (name, code, api_base_url, auth_type, auth_key_name, auth_key_value, 
   booking_endpoint, test_code_mapping, timeout_seconds) VALUES
(
  'Thyrocare Technologies', 
  'THYROCARE',
  'https://api.thyrocare.com/v1',
  'api_key',
  'X-API-Key',
  'DEMO_KEY_REPLACE_WITH_REAL',
  '/order/create',
  '{"CBC001":"CBC","TSH001":"T3T4TSH","LFT001":"LFT","KFT001":"KFT","VTD001":"VITD","VTB001":"VITB12","DPN001":"DIABETES"}',
  30
),
(
  'SRL Diagnostics',
  'SRL',
  'https://api.srl.in/v2',
  'bearer',
  'Authorization',
  'Bearer DEMO_TOKEN_REPLACE',
  '/lab/booking',
  '{"CBC001":"SRL_CBC","TSH001":"SRL_THYROID","VTD001":"SRL_VITD"}',
  30
);
