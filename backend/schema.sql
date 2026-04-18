-- ============================================
-- Lab Collection Management System - Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS lab_collection;
USE lab_collection;

-- Users (Patients)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  address TEXT,
  date_of_birth DATE,
  gender ENUM('male','female','other'),
  role ENUM('patient','admin') DEFAULT 'patient',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Test Categories
CREATE TABLE IF NOT EXISTS test_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tests / Services
CREATE TABLE IF NOT EXISTS tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  sample_type VARCHAR(100),
  report_time VARCHAR(50),
  fasting_required BOOLEAN DEFAULT FALSE,
  base_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES test_categories(id) ON DELETE SET NULL
);

-- Clients (Companies / Hospitals that send patients for home collection)
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  contact_person VARCHAR(150),
  email VARCHAR(150),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  gst_number VARCHAR(50),
  credit_limit DECIMAL(12,2) DEFAULT 0,
  payment_terms INT DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rate Lists (Independent module)
CREATE TABLE IF NOT EXISTS rate_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rate List Items (per test pricing in a ratelist)
CREATE TABLE IF NOT EXISTS rate_list_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rate_list_id INT NOT NULL,
  test_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (rate_list_id) REFERENCES rate_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  UNIQUE KEY unique_rate_test (rate_list_id, test_id)
);

-- Client Rate List Assignment
CREATE TABLE IF NOT EXISTS client_rate_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  rate_list_id INT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (rate_list_id) REFERENCES rate_lists(id) ON DELETE CASCADE
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_number VARCHAR(50) UNIQUE NOT NULL,
  user_id INT,
  client_id INT,
  patient_name VARCHAR(150) NOT NULL,
  patient_age INT,
  patient_gender ENUM('male','female','other'),
  patient_phone VARCHAR(20),
  patient_address TEXT,
  collection_type ENUM('home','walkin') DEFAULT 'walkin',
  collection_date DATE,
  collection_time VARCHAR(20),
  collection_address TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL,
  payment_status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_id VARCHAR(200),
  payment_order_id VARCHAR(200),
  booking_status ENUM('pending','confirmed','sample_collected','processing','completed','cancelled') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- Booking Items (tests in a booking)
CREATE TABLE IF NOT EXISTS booking_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  test_id INT NOT NULL,
  test_name VARCHAR(200) NOT NULL,
  test_code VARCHAR(50),
  rate_list_id INT,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Payments Log
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_gateway VARCHAR(50),
  gateway_order_id VARCHAR(200),
  gateway_payment_id VARCHAR(200),
  gateway_signature VARCHAR(500),
  status ENUM('initiated','success','failed','refunded') DEFAULT 'initiated',
  response_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ============================================
-- SEED DATA
-- ============================================

-- Admin user (password: Admin@123)
INSERT INTO users (name, email, phone, password, role) VALUES
('Admin User', 'admin@labcollection.com', '9999999999', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Test Categories
INSERT INTO test_categories (name, description, icon) VALUES
('Blood Tests', 'Complete blood analysis and related tests', 'droplet'),
('Urine Tests', 'Urine examination and culture tests', 'flask'),
('Thyroid', 'Thyroid function tests', 'activity'),
('Diabetes', 'Blood sugar and HbA1c tests', 'heart'),
('Liver Function', 'Liver enzyme and function tests', 'shield'),
('Kidney Function', 'Renal function and creatinine tests', 'cpu'),
('Lipid Profile', 'Cholesterol and triglycerides', 'bar-chart'),
('Vitamins & Minerals', 'Vitamin D, B12, Iron etc.', 'sun');

-- Tests
INSERT INTO tests (category_id, name, code, description, sample_type, report_time, fasting_required, base_price) VALUES
(1, 'Complete Blood Count (CBC)', 'CBC001', 'Measures different components of blood', 'Blood (EDTA)', '6-8 hours', FALSE, 250.00),
(1, 'ESR (Erythrocyte Sedimentation Rate)', 'ESR001', 'Detects inflammation in body', 'Blood (EDTA)', '3-4 hours', FALSE, 150.00),
(1, 'Peripheral Smear', 'PS001', 'Microscopic examination of blood cells', 'Blood (EDTA)', '24 hours', FALSE, 300.00),
(2, 'Urine Routine & Microscopy', 'URM001', 'Complete urine examination', 'Urine (Midstream)', '3-4 hours', FALSE, 180.00),
(2, 'Urine Culture & Sensitivity', 'UCS001', 'Detection of urinary tract infection', 'Urine (Midstream)', '48-72 hours', FALSE, 600.00),
(3, 'T3, T4, TSH (Thyroid Panel)', 'TPL001', 'Complete thyroid function test', 'Blood (Serum)', '6-8 hours', FALSE, 850.00),
(3, 'TSH Only', 'TSH001', 'Thyroid Stimulating Hormone test', 'Blood (Serum)', '6-8 hours', FALSE, 350.00),
(3, 'Free T3, Free T4, TSH', 'FTP001', 'Free thyroid hormones', 'Blood (Serum)', '6-8 hours', FALSE, 1100.00),
(4, 'Fasting Blood Sugar (FBS)', 'FBS001', 'Blood glucose fasting', 'Blood (Fluoride)', '2-3 hours', TRUE, 120.00),
(4, 'Post Prandial Blood Sugar (PPBS)', 'PPBS001', '2hr after meal blood glucose', 'Blood (Fluoride)', '2-3 hours', FALSE, 120.00),
(4, 'HbA1c (Glycated Hemoglobin)', 'HBA001', '3 month average blood sugar', 'Blood (EDTA)', '6-8 hours', FALSE, 450.00),
(4, 'Diabetes Panel (FBS+PPBS+HbA1c)', 'DPN001', 'Complete diabetes monitoring panel', 'Blood (Multiple)', '6-8 hours', TRUE, 650.00),
(5, 'Liver Function Test (LFT)', 'LFT001', 'Complete liver enzyme panel', 'Blood (Serum)', '6-8 hours', FALSE, 750.00),
(5, 'SGOT (AST)', 'SGOT01', 'Aspartate Aminotransferase', 'Blood (Serum)', '3-4 hours', FALSE, 200.00),
(5, 'SGPT (ALT)', 'SGPT01', 'Alanine Aminotransferase', 'Blood (Serum)', '3-4 hours', FALSE, 200.00),
(6, 'Kidney Function Test (KFT)', 'KFT001', 'Complete renal function panel', 'Blood (Serum)', '6-8 hours', FALSE, 700.00),
(6, 'Serum Creatinine', 'SCR001', 'Kidney health marker', 'Blood (Serum)', '3-4 hours', FALSE, 180.00),
(6, 'Blood Urea Nitrogen (BUN)', 'BUN001', 'Urea in blood test', 'Blood (Serum)', '3-4 hours', FALSE, 180.00),
(7, 'Lipid Profile', 'LPF001', 'Total cholesterol, HDL, LDL, Triglycerides', 'Blood (Serum)', '6-8 hours', TRUE, 650.00),
(7, 'Total Cholesterol', 'TCH001', 'Serum cholesterol test', 'Blood (Serum)', '3-4 hours', TRUE, 200.00),
(8, 'Vitamin D (25-OH)', 'VTD001', 'Vitamin D3 levels', 'Blood (Serum)', '24 hours', FALSE, 1200.00),
(8, 'Vitamin B12', 'VTB001', 'Cobalamin level test', 'Blood (Serum)', '24 hours', FALSE, 900.00),
(8, 'Iron Studies (Iron, TIBC, Ferritin)', 'IRN001', 'Iron deficiency panel', 'Blood (Serum)', '24 hours', FALSE, 1100.00),
(1, 'CRP (C-Reactive Protein)', 'CRP001', 'Inflammation marker', 'Blood (Serum)', '6-8 hours', FALSE, 400.00),
(1, 'Dengue NS1 Antigen', 'DNG001', 'Dengue fever detection', 'Blood (Serum)', '6-8 hours', FALSE, 800.00);

-- Sample Clients
INSERT INTO clients (name, code, contact_person, email, phone, address, city, credit_limit, payment_terms) VALUES
('Apollo Clinics Pvt Ltd', 'APOLLO01', 'Dr. Rajesh Kumar', 'apollo@example.com', '9876543210', '123 MG Road', 'Ludhiana', 50000.00, 30),
('City Hospital', 'CITYH01', 'Dr. Priya Singh', 'cityhosp@example.com', '9876543211', '456 Civil Lines', 'Ludhiana', 30000.00, 15),
('HealthCare Plus', 'HCP001', 'Mr. Amit Sharma', 'hcp@example.com', '9876543212', '789 Model Town', 'Ludhiana', 20000.00, 30),
('Wellness Center', 'WLC001', 'Ms. Neha Gupta', 'wellness@example.com', '9876543213', '321 Sarabha Nagar', 'Ludhiana', 15000.00, 30);

-- Rate Lists
INSERT INTO rate_lists (name, description, discount_type) VALUES
('Standard Rate', 'Default rate list for walk-in patients', 'percentage'),
('Apollo Special Rate', 'Special discounted rates for Apollo Clinics', 'fixed'),
('Corporate Rate', 'Corporate client discounted rates', 'percentage'),
('Premium Rate', 'Premium package rates with added services', 'fixed');

-- Rate List Items (Apollo Special Rate - client_id=1 gets these)
INSERT INTO rate_list_items (rate_list_id, test_id, price) VALUES
-- Apollo Special Rate (rate_list_id=2)
(2, 1, 200.00), (2, 6, 700.00), (2, 9, 100.00), (2, 11, 380.00),
(2, 13, 620.00), (2, 16, 580.00), (2, 19, 540.00), (2, 21, 1000.00),
(2, 22, 750.00), (2, 25, 680.00),
-- Corporate Rate (rate_list_id=3)
(3, 1, 220.00), (3, 6, 720.00), (3, 9, 100.00), (3, 11, 400.00),
(3, 13, 650.00), (3, 16, 600.00), (3, 19, 560.00),
-- Premium Rate (rate_list_id=4)
(4, 1, 300.00), (4, 6, 1000.00), (4, 9, 150.00), (4, 11, 500.00),
(4, 13, 850.00), (4, 16, 800.00), (4, 19, 750.00);

-- Assign rate lists to clients
INSERT INTO client_rate_lists (client_id, rate_list_id, effective_from) VALUES
(1, 2, '2024-01-01'),
(2, 3, '2024-01-01'),
(3, 3, '2024-01-01'),
(4, 4, '2024-01-01');
