const express         = require('express');
const router          = express.Router();

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
const { upload }            = require('../middleware/upload');
const { protect, adminOnly, adminOrPhlebo, clientUserOnly } = require('../middleware/auth');
const { apiKeyAuth }        = require('../middleware/apiKeyAuth');

// ════════════════════════════════════════════════════════════
// External API v1  (API key auth, no session)
// ════════════════════════════════════════════════════════════
const extRouter = express.Router();

extRouter.get( '/tests',
  apiKeyAuth('bookings:read'), externalApiCtrl.externalGetTests);

extRouter.post('/bookings',
  apiKeyAuth('bookings:write'), externalApiCtrl.externalCreateBooking);

extRouter.get( '/bookings/:bookingNumber',
  apiKeyAuth('bookings:read'), externalApiCtrl.externalGetBooking);

extRouter.post('/bookings/:bookingNumber/reports',
  apiKeyAuth('reports:write'),
  upload.single('report'),   // optional file upload
  externalApiCtrl.externalUploadReport);

router.use('/v1', extRouter);

// ════════════════════════════════════════════════════════════
// Auth (session-based)
// ════════════════════════════════════════════════════════════
router.post('/auth/register', authController.register);
router.post('/auth/login',    authController.login);
router.post('/auth/refresh',  authController.refresh);   // silent token refresh via httpOnly cookie
router.post('/auth/logout',   authController.logout);    // clears refresh cookie
router.get( '/auth/me',       protect, authController.getMe);
router.put( '/auth/profile',  protect, authController.updateProfile);

// Public tests
router.get('/tests',            testController.getTests);
router.get('/tests/categories', testController.getCategories);
router.get('/tests/:id',        testController.getTest);

// Patient bookings
router.post('/bookings/create', bookingController.createBooking);
router.get( '/bookings/my',     protect, bookingController.getMyBookings);
router.get( '/bookings/:id',    protect, bookingController.getBooking);

// Reports (patient + client)
router.get('/bookings/:bookingId/reports', protect, reportController.getReports);
router.get('/reports/:reportId/download',  protect, reportController.downloadReport);

// Payments
router.post('/payments/create-order',       paymentController.createOrder);
router.post('/payments/verify',             paymentController.verifyPayment);
router.get( '/payments/booking/:bookingId', protect, paymentController.getPaymentByBooking);

// Phlebo self-service
router.get('/phlebo/assignments',         protect, adminOrPhlebo, phleboController.getMyAssignments);
router.put('/phlebo/bookings/:id/collect',protect, adminOrPhlebo, phleboController.markCollected);

// Client portal
router.get( '/client/profile',      protect, clientUserOnly, clientPortalCtrl.getClientProfile);
router.get( '/client/tests',        protect, clientUserOnly, clientPortalCtrl.getClientTests);
router.get( '/client/bookings',     protect, clientUserOnly, clientPortalCtrl.getClientBookings);
router.get( '/client/bookings/:id', protect, clientUserOnly, clientPortalCtrl.getClientBooking);
router.post('/client/bookings',     protect, clientUserOnly, clientPortalCtrl.createClientBooking);

// ════════════════════════════════════════════════════════════
// Admin routes (JWT required + admin role)
// ════════════════════════════════════════════════════════════
router.use('/admin', protect, adminOnly);

// Dashboard
router.get('/admin/dashboard', bookingController.getDashboardStats);

// Bookings
router.get( '/admin/bookings',     bookingController.getAllBookings);
router.put( '/admin/bookings/:id', bookingController.updateBooking);
router.post('/admin/bookings',     clientPortalCtrl.adminCreateBooking);
router.post('/admin/bookings/:id/assign-phlebo', phleboController.assignPhlebo);

// Booking → push to lab
router.post('/admin/bookings/:bookingId/push-to-lab', labPushController.pushToLab);
router.get( '/admin/bookings/:bookingId/push-log',    labPushController.getPushLog);

// Reports
router.post(  '/admin/bookings/:bookingId/reports', upload.array('reports', 10), reportController.uploadReports);
router.delete('/admin/reports/:reportId',            reportController.deleteReport);

// Tests
router.post(  '/admin/tests',      testController.createTest);
router.put(   '/admin/tests/:id',  testController.updateTest);
router.delete('/admin/tests/:id',  testController.deleteTest);
router.post(  '/admin/categories', testController.createCategory);

// Clients
router.get(   '/admin/clients',                     clientController.getClients);
router.get(   '/admin/clients/:id',                 clientController.getClient);
router.post(  '/admin/clients',                     clientController.createClient);
router.put(   '/admin/clients/:id',                 clientController.updateClient);
router.delete('/admin/clients/:id',                 clientController.deleteClient);
router.get(   '/admin/clients/:clientId/users',     clientPortalCtrl.getClientUsers);
router.post(  '/admin/clients/:clientId/users',     clientPortalCtrl.createClientUser);
router.delete('/admin/client-users/:id',            clientPortalCtrl.deleteClientUser);

// Rate Lists
router.get(   '/admin/rate-lists',     rateListController.getRateLists);
router.get(   '/admin/rate-lists/:id', rateListController.getRateList);
router.post(  '/admin/rate-lists',     rateListController.createRateList);
router.put(   '/admin/rate-lists/:id', rateListController.updateRateList);
router.delete('/admin/rate-lists/:id', rateListController.deleteRateList);

// Phlebotomists
router.get(   '/admin/phlebos/available', phleboController.getAvailablePhlebos);
router.get(   '/admin/phlebos',           phleboController.getPhlebos);
router.get(   '/admin/phlebos/:id',       phleboController.getPhlebo);
router.post(  '/admin/phlebos',           phleboController.createPhlebo);
router.put(   '/admin/phlebos/:id',       phleboController.updatePhlebo);
router.delete('/admin/phlebos/:id',       phleboController.deletePhlebo);

// Third-party labs
router.get(   '/admin/labs',                    labPushController.getLabs);
router.get(   '/admin/labs/:id',                labPushController.getLab);
router.post(  '/admin/labs',                    labPushController.createLab);
router.put(   '/admin/labs/:id',                labPushController.updateLab);
router.delete('/admin/labs/:id',                labPushController.deleteLab);
router.get(   '/admin/lab-push-history',        labPushController.getPushHistory);

// API Key management
router.get(   '/admin/api-clients',             apiKeyController.getApiClients);
router.post(  '/admin/api-clients',             apiKeyController.createApiClient);
router.put(   '/admin/api-clients/:id',         apiKeyController.updateApiClient);
router.post(  '/admin/api-clients/:id/rotate',  apiKeyController.rotateApiKey);
router.delete('/admin/api-clients/:id',         apiKeyController.revokeApiClient);
router.get(   '/admin/api-clients/:id/audit',   apiKeyController.getAuditLog);
router.get(   '/admin/api-audit-log',           apiKeyController.getAllAuditLogs);

module.exports = router;
