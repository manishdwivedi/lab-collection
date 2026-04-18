-- ============================================================
-- Migration: Phlebotomists + Client Login + Admin Booking
-- Run against existing lab_collection database
-- ============================================================
USE lab_collection;

-- ── 1. Extend user roles ──────────────────────────────────
ALTER TABLE users
  MODIFY COLUMN role ENUM('patient','admin','phlebo','client_user') DEFAULT 'patient';

-- ── 2. Phlebotomists table ────────────────────────────────
CREATE TABLE IF NOT EXISTS phlebotomists (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL UNIQUE,          -- links to users table (role = phlebo)
  employee_code   VARCHAR(50) UNIQUE NOT NULL,
  phone           VARCHAR(20) NOT NULL,
  alternate_phone VARCHAR(20),
  address         TEXT,
  city            VARCHAR(100),
  experience_years INT DEFAULT 0,
  qualification   VARCHAR(200),
  is_available    BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE,
  joined_date     DATE,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── 3. Phlebo assignment on bookings ──────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS phlebo_id INT DEFAULT NULL AFTER client_id,
  ADD COLUMN IF NOT EXISTS phlebo_assigned_at DATETIME DEFAULT NULL AFTER phlebo_id,
  ADD FOREIGN KEY fk_booking_phlebo (phlebo_id) REFERENCES phlebotomists(id) ON DELETE SET NULL;

-- ── 4. Client users — link a login user to a client ───────
-- A client company can have multiple portal logins
CREATE TABLE IF NOT EXISTS client_users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  user_id    INT NOT NULL UNIQUE,              -- role = client_user in users table
  is_primary BOOLEAN DEFAULT FALSE,            -- main contact
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);

-- ── 5. Index helpers ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_phlebo   ON bookings(phlebo_id);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users(client_id);

-- ── 6. Sample phlebotomist user + profile ─────────────────
-- Password: Phlebo@123  (bcrypt hash)
INSERT IGNORE INTO users (name, email, phone, password, role) VALUES
  ('Rajiv Kumar',  'rajiv.phlebo@labcollection.com', '9812345601',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'phlebo'),
  ('Sunita Devi',  'sunita.phlebo@labcollection.com', '9812345602',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'phlebo'),
  ('Mohit Sharma', 'mohit.phlebo@labcollection.com',  '9812345603',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'phlebo');

INSERT IGNORE INTO phlebotomists (user_id, employee_code, phone, city, experience_years, qualification, joined_date)
  SELECT id, CONCAT('PHB00', ROW_NUMBER() OVER (ORDER BY id)),
         phone, 'Ludhiana', 3, 'DMLT', '2022-01-01'
  FROM users WHERE role = 'phlebo';

-- ── 7. Sample client portal user for Apollo Clinics ───────
INSERT IGNORE INTO users (name, email, phone, password, role) VALUES
  ('Apollo Portal', 'portal@apolloclinics.com', '9876543210',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client_user');

INSERT IGNORE INTO client_users (client_id, user_id, is_primary)
  SELECT 1, u.id, TRUE FROM users u WHERE u.email = 'portal@apolloclinics.com' LIMIT 1;
