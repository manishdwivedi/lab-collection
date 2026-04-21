/**
 * Request validation using express-validator
 * Each exported array is a middleware chain for a specific route.
 */
const { body, param, query, validationResult } = require('express-validator');

/* ── Handle validation errors ──────────────────────── */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

/* ── Reusable field validators ───────────────────────── */
const phoneValidator = (field) =>
  body(field).optional({ nullable: true })
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage('Invalid phone number format');

const dateValidator = (field) =>
  body(field).optional({ nullable: true })
    .isISO8601().withMessage('Invalid date format (use YYYY-MM-DD)')
    .toDate();

/* ── Auth ─────────────────────────────────────────── */
exports.validateRegister = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email')
    .trim().normalizeEmail().isEmail().withMessage('Valid email is required'),
  body('phone')
    .trim().notEmpty().withMessage('Phone number is required')
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid phone number'),
  body('password')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('gender').optional()
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  dateValidator('date_of_birth'),
  validate,
];

exports.validateLogin = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

/* ── Bookings ─────────────────────────────────────── */
exports.validateCreateBooking = [
  body('patient_name')
    .trim().notEmpty().withMessage('Patient name is required')
    .isLength({ max: 150 }).withMessage('Patient name too long'),
  body('patient_phone')
    .trim().notEmpty().withMessage('Patient phone is required')
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid phone number'),
  body('patient_age').optional({ nullable: true })
    .isInt({ min: 0, max: 150 }).withMessage('Invalid age'),
  body('patient_gender').optional({ nullable: true })
    .isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('test_ids')
    .isArray({ min: 1 }).withMessage('At least one test must be selected'),
  body('test_ids.*')
    .isInt({ min: 1 }).withMessage('Invalid test ID'),
  body('collection_type')
    .optional().isIn(['home', 'walkin']).withMessage('Invalid collection type'),
  dateValidator('collection_date'),
  body('notes').optional({ nullable: true })
    .isLength({ max: 1000 }).withMessage('Notes too long'),
  validate,
];

exports.validateUpdateBooking = [
  param('id').isInt({ min: 1 }).withMessage('Invalid booking ID'),
  body('booking_status').optional()
    .isIn(['pending','confirmed','sample_collected','processing','completed','cancelled'])
    .withMessage('Invalid booking status'),
  body('payment_status').optional()
    .isIn(['pending','paid','failed','refunded']).withMessage('Invalid payment status'),
  dateValidator('collection_date'),
  validate,
];

/* ── Tests ────────────────────────────────────────── */
exports.validateCreateTest = [
  body('name')
    .trim().notEmpty().withMessage('Test name is required')
    .isLength({ max: 200 }).withMessage('Test name too long'),
  body('code')
    .trim().notEmpty().withMessage('Test code is required')
    .isAlphanumeric().withMessage('Code must be alphanumeric')
    .isLength({ max: 50 }).withMessage('Code too long')
    .toUpperCase(),
  body('base_price')
    .isFloat({ min: 0, max: 999999 }).withMessage('Invalid price'),
  body('category_id').optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Invalid category'),
  body('fasting_required').optional().isBoolean().toBoolean(),
  validate,
];

/* ── Clients ──────────────────────────────────────── */
exports.validateCreateClient = [
  body('name')
    .trim().notEmpty().withMessage('Client name is required')
    .isLength({ max: 200 }).withMessage('Name too long'),
  body('code')
    .trim().notEmpty().withMessage('Client code is required')
    .isAlphanumeric().withMessage('Code must be alphanumeric')
    .isLength({ max: 50 }).withMessage('Code too long')
    .toUpperCase(),
  phoneValidator('phone'),
  body('credit_limit').optional()
    .isFloat({ min: 0, max: 99999999 }).withMessage('Invalid credit limit'),
  body('payment_terms').optional()
    .isInt({ min: 0, max: 365 }).withMessage('Payment terms must be 0–365 days'),
  validate,
];

/* ── Phlebotomists ───────────────────────────────── */
exports.validateCreatePhlebo = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 150 }).withMessage('Name too long'),
  body('email')
    .trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('phone')
    .trim().notEmpty().withMessage('Phone required')
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid phone'),
  body('employee_code')
    .trim().notEmpty().withMessage('Employee code required')
    .isLength({ max: 50 }).withMessage('Code too long'),
  body('experience_years').optional()
    .isInt({ min: 0, max: 60 }).withMessage('Invalid experience years'),
  validate,
];

/* ── Rate Lists ──────────────────────────────────── */
exports.validateCreateRateList = [
  body('name')
    .trim().notEmpty().withMessage('Rate list name required')
    .isLength({ max: 200 }).withMessage('Name too long'),
  body('discount_type').optional()
    .isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
  body('items').optional().isArray(),
  body('items.*.test_id').optional().isInt({ min: 1 }),
  body('items.*.price').optional().isFloat({ min: 0, max: 999999 }),
  validate,
];

/* ── External API ────────────────────────────────── */
exports.validateExternalBooking = [
  body('patient_name')
    .trim().notEmpty().withMessage('patient_name is required')
    .isLength({ max: 150 }).withMessage('patient_name too long'),
  body('patient_phone')
    .trim().notEmpty().withMessage('patient_phone is required')
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid phone'),
  body('patient_age').optional({ nullable: true })
    .isInt({ min: 0, max: 150 }).withMessage('Invalid age'),
  body('collection_type').optional()
    .isIn(['home', 'walkin']).withMessage('Invalid collection type'),
  dateValidator('collection_date'),
  body('test_ids').optional().isArray(),
  body('test_codes').optional().isArray(),
  validate,
];

/* ── API Keys ──────────────────────────────────── */
exports.validateCreateApiKey = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 200 }).withMessage('Name too long'),
  body('permissions')
    .isArray({ min: 1 }).withMessage('At least one permission required'),
  body('permissions.*')
    .isIn(['bookings:read', 'bookings:write', 'reports:write', '*'])
    .withMessage('Invalid permission'),
  body('rate_limit').optional()
    .isInt({ min: 1, max: 10000 }).withMessage('Rate limit must be 1–10000'),
  validate,
];

/* ── Labs ──────────────────────────────────────── */
exports.validateCreateLab = [
  body('name').trim().notEmpty().withMessage('Lab name required'),
  body('code').trim().notEmpty().withMessage('Lab code required')
    .isAlphanumeric().withMessage('Code must be alphanumeric'),
  body('api_base_url')
    .trim().notEmpty().withMessage('API base URL required')
    .isURL({ require_tld: false }).withMessage('Invalid URL'),
  body('auth_type').optional()
    .isIn(['api_key','bearer','basic','oauth2']).withMessage('Invalid auth type'),
  validate,
];