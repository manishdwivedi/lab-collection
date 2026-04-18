-- ============================================================
-- Migration: Add Report Upload Support
-- Run this against your existing lab_collection database
-- ============================================================

USE lab_collection;

-- Reports table: stores uploaded report files per booking
CREATE TABLE IF NOT EXISTS booking_reports (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  booking_id   INT NOT NULL,
  file_name    VARCHAR(255) NOT NULL,          -- original filename shown to patient
  file_path    VARCHAR(500) NOT NULL,          -- server path  (uploads/reports/...)
  file_size    INT NOT NULL,                   -- bytes
  mime_type    VARCHAR(100) NOT NULL,          -- application/pdf | image/jpeg | ...
  uploaded_by  INT NOT NULL,                   -- admin user id
  notes        TEXT,                           -- optional lab notes for this report
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id)  REFERENCES bookings(id)  ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)     ON DELETE RESTRICT
);

-- Add report_status column to bookings so we can track report availability
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS report_status
    ENUM('not_uploaded','partial','ready') DEFAULT 'not_uploaded'
    AFTER booking_status;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reports_booking ON booking_reports(booking_id);
