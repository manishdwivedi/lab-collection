const express         = require('express');
const router          = express.Router();

// Controllers
const authController        = require('../controllers/authController');
const testController        = require('../controllers/testController');
const bookingController     = require('../controllers/bookingController');
const paymentController     = require('../controllers/paymentController');
const rateListController    = require('../controllers/rateListController');
const clientController      = require('../controllers/clientController');
const reportController      = require('../controllers/reportController');
const phleboController      = require('../controllers/phleboController');
const clientPortalCtrl      = require('../controllers/clientPortalController');
const apiKeyController      = require('../controllers/apiKeyController');
const externalApiCtrl       = require('../controllers/externalApiController');
const labPushController     = require('../controllers/labPushController');

// Middleware
const { upload }                                     = require('../middleware/upload');
const { validateMagicBytes }                         = require('../middleware/fileValidator');
const { protect, adminOnly, adminOrPhlebo, clientUserOnly } = require('../middleware/auth');
const { apiKeyAuth }                                 = require('../middleware/apiKeyAuth');
const { authLimiter, externalApiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { auditLog }                                   = require('../middleware/auditLog');
const {
  validateRegister,
  validateLogin,
  validateCreateBooking,
  validateUpdateBooking,
  validateCreateTest,
  validateCreateClient,
  validateCreatePhlebo,
  validateCreateRateList,
  validateExternalBooking,
  validateCreateApiKey,
  validateCreateLab,
} = require('../middleware/validate');

// ════════════════════════════════════════════════════════════
// External API v1  (API key auth, no session)
// ════════════════════════════════════════════════════════════
const extRouter = express.Router();
extRouter.use(externalApiLimiter);

extRouter.get( '/tests',
  apiKeyAuth('bookings:read'),
  externalApiCtrl.externalGetTests);

extRouter.post('/bookings',
  apiKeyAuth('bookings:write'),
  validateExternalBooking,
  externalApiCtrl.externalCreateBooking);

extRouter.get( '/bookings/:bookingNumber',
  apiKeyAuth('bookings:read'),
  externalApiCtrl.externalGetBooking);

extRouter.post('/bookings/:bookingNumber/reports',
  apiKeyAuth('reports:write'),
  uploadLimiter,
  upload.single('report'),
  validateMagicBytes,
  externalApiCtrl.externalUploadReport);

router.use('/v1', extRouter);

// ════════════════════════════════════════════════════════════
// Auth
// ════════════════════════════════════════════════════════════
router.post('/auth/register', authLimiter,  validateRegister, authController.register);
router.post('/auth/login',    authLimiter,  validateLogin,    authController.login);
router.post('/auth/refresh',                                  authController.refresh);
router.post('/auth/logout',                                   authController.logout);
router.get( '/auth/me',       protect,                        authController.getMe);
router.put( '/auth/profile',  protect,                        authController.updateProfile);

// ════════════════════════════════════════════════════════════
// Public: Tests
// ════════════════════════════════════════════════════════════
router.get('/tests',            testController.getTests);
router.get('/tests/categories', testController.getCategories);
router.get('/tests/:id',        testController.getTest);

// ════════════════════════════════════════════════════════════
// Patient: Bookings
// ════════════════════════════════════════════════════════════
router.post('/bookings/create', validateCreateBooking, bookingController.createBooking);
router.get( '/bookings/my',     protect,               bookingController.getMyBookings);
router.get( '/bookings/:id',    protect,               bookingController.getBooking);

// Reports (patient + client)
router.get('/bookings/:bookingId/reports', protect, reportController.getReports);
router.get('/reports/:reportId/download',  protect, reportController.downloadReport);

// Payments
router.post('/payments/create-order',       paymentController.createOrder);
router.post('/payments/verify',             paymentController.verifyPayment);
router.get( '/payments/booking/:bookingId', protect, paymentController.getPaymentByBooking);

// Phlebo self-service
router.get('/phlebo/assignments',          protect, adminOrPhlebo, phleboController.getMyAssignments);
router.put('/phlebo/bookings/:id/collect', protect, adminOrPhlebo, phleboController.markCollected);

// Client portal
router.get( '/client/profile',      protect, clientUserOnly, clientPortalCtrl.getClientProfile);
router.get( '/client/tests',        protect, clientUserOnly, clientPortalCtrl.getClientTests);
router.get( '/client/bookings',     protect, clientUserOnly, clientPortalCtrl.getClientBookings);
router.get( '/client/bookings/:id', protect, clientUserOnly, clientPortalCtrl.getClientBooking);
router.post('/client/bookings',     protect, clientUserOnly, validateCreateBooking, clientPortalCtrl.createClientBooking);

// ════════════════════════════════════════════════════════════
// Admin routes — JWT + admin role required
// ════════════════════════════════════════════════════════════
router.use('/admin', protect, adminOnly);

// Dashboard
router.get('/admin/dashboard', bookingController.getDashboardStats);

// Bookings — with audit logging on mutations
router.get( '/admin/bookings',     bookingController.getAllBookings);
router.put( '/admin/bookings/:id', validateUpdateBooking, auditLog('update_booking','bookings'), bookingController.updateBooking);
router.post('/admin/bookings',     validateCreateBooking, auditLog('create_booking','bookings'), clientPortalCtrl.adminCreateBooking);
router.post('/admin/bookings/:id/assign-phlebo', auditLog('assign_phlebo','bookings'), phleboController.assignPhlebo);
router.post('/admin/bookings/:bookingId/push-to-lab', auditLog('push_to_lab','bookings'), labPushController.pushToLab);
router.get( '/admin/bookings/:bookingId/push-log',   labPushController.getPushLog);

// Reports (with magic-byte validation)
router.post(  '/admin/bookings/:bookingId/reports',
  uploadLimiter,
  upload.array('reports', 10),
  validateMagicBytes,
  auditLog('upload_report','booking_reports'),
  reportController.uploadReports);
router.delete('/admin/reports/:reportId', auditLog('delete_report','booking_reports'), reportController.deleteReport);

// Tests
router.post(  '/admin/tests',      validateCreateTest, auditLog('create_test','tests'),  testController.createTest);
router.put(   '/admin/tests/:id',  validateCreateTest, auditLog('update_test','tests'),  testController.updateTest);
router.delete('/admin/tests/:id',                      auditLog('delete_test','tests'),  testController.deleteTest);
router.post(  '/admin/categories',                                                        testController.createCategory);

// Clients
router.get(   '/admin/clients',                     clientController.getClients);
router.get(   '/admin/clients/:id',                 clientController.getClient);
router.post(  '/admin/clients',     validateCreateClient, auditLog('create_client','clients'), clientController.createClient);
router.put(   '/admin/clients/:id', validateCreateClient, auditLog('update_client','clients'), clientController.updateClient);
router.delete('/admin/clients/:id',                       auditLog('delete_client','clients'), clientController.deleteClient);
router.get(   '/admin/clients/:clientId/users',     clientPortalCtrl.getClientUsers);
router.post(  '/admin/clients/:clientId/users',     auditLog('create_client_user','client_users'), clientPortalCtrl.createClientUser);
router.delete('/admin/client-users/:id',            auditLog('delete_client_user','client_users'), clientPortalCtrl.deleteClientUser);

// Rate Lists
router.get(   '/admin/rate-lists',     rateListController.getRateLists);
router.get(   '/admin/rate-lists/:id', rateListController.getRateList);
router.post(  '/admin/rate-lists',     validateCreateRateList, auditLog('create_rate_list','rate_lists'), rateListController.createRateList);
router.put(   '/admin/rate-lists/:id', validateCreateRateList, auditLog('update_rate_list','rate_lists'), rateListController.updateRateList);
router.delete('/admin/rate-lists/:id',                         auditLog('delete_rate_list','rate_lists'), rateListController.deleteRateList);

// Phlebotomists
router.get(   '/admin/phlebos/available', phleboController.getAvailablePhlebos);
router.get(   '/admin/phlebos',           phleboController.getPhlebos);
router.get(   '/admin/phlebos/:id',       phleboController.getPhlebo);
router.post(  '/admin/phlebos',     validateCreatePhlebo, auditLog('create_phlebo','phlebotomists'), phleboController.createPhlebo);
router.put(   '/admin/phlebos/:id', validateCreatePhlebo, auditLog('update_phlebo','phlebotomists'), phleboController.updatePhlebo);
router.delete('/admin/phlebos/:id',                       auditLog('delete_phlebo','phlebotomists'), phleboController.deletePhlebo);

// Third-party labs
router.get(   '/admin/labs',             labPushController.getLabs);
router.get(   '/admin/labs/:id',         labPushController.getLab);
router.post(  '/admin/labs',     validateCreateLab, auditLog('create_lab','third_party_labs'), labPushController.createLab);
router.put(   '/admin/labs/:id', validateCreateLab, auditLog('update_lab','third_party_labs'), labPushController.updateLab);
router.delete('/admin/labs/:id',                    auditLog('delete_lab','third_party_labs'), labPushController.deleteLab);
router.get(   '/admin/lab-push-history',            labPushController.getPushHistory);

// API Key management
router.get(   '/admin/api-clients',           apiKeyController.getApiClients);
router.post(  '/admin/api-clients',           validateCreateApiKey, auditLog('create_api_key','api_clients'), apiKeyController.createApiClient);
router.put(   '/admin/api-clients/:id',       auditLog('update_api_key','api_clients'),   apiKeyController.updateApiClient);
router.post(  '/admin/api-clients/:id/rotate',auditLog('rotate_api_key','api_clients'),  apiKeyController.rotateApiKey);
router.delete('/admin/api-clients/:id',       auditLog('revoke_api_key','api_clients'),  apiKeyController.revokeApiClient);
router.get(   '/admin/api-clients/:id/audit', apiKeyController.getAuditLog);
router.get(   '/admin/api-audit-log',         apiKeyController.getAllAuditLogs);

module.exports = router;
