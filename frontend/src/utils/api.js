import axios from 'axios';

const API = axios.create({ baseURL: '/api', withCredentials: true });

// Attach access token to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: try a silent refresh once, then retry the original request
let isRefreshing = false;
let pendingQueue = [];  // requests waiting while refresh is in flight

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

API.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;

    // Only attempt refresh on 401, and not on the refresh/login/logout routes themselves
    const isAuthRoute = original.url?.includes('/auth/');
    if (err.response?.status === 401 && !original._retried && !isAuthRoute) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return API(original);
        });
      }

      original._retried = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken = refreshRes.data.token;
        localStorage.setItem('token', newToken);
        if (refreshRes.data.user) {
          localStorage.setItem('user', JSON.stringify(refreshRes.data.user));
        }
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return API(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        // Refresh failed → clear session and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login?reason=expired';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

// Auth
export const login = data => API.post('/auth/login', data);
export const register = data => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');
export const updateProfile = data => API.put('/auth/profile', data);

// Tests
export const getTests = (params) => API.get('/tests', { params });
export const getCategories = () => API.get('/tests/categories');
export const getTest = id => API.get(`/tests/${id}`);

// Admin - Tests
export const createTest      = data    => API.post('/admin/tests', data);
export const updateTest      = (id, d) => API.put(`/admin/tests/${id}`, d);
export const deleteTest      = id      => API.delete(`/admin/tests/${id}`);
export const getComposition  = id      => API.get(`/admin/tests/${id}/composition`);
// export const getSubCompositions  = id      => API.get(`/admin/tests/${id}/subcompositions`);
export const createCategory  = data    => API.post('/admin/categories', data);
// export const createCategory = data => API.post('/admin/categories', data);

// Bookings
export const createBooking = data => API.post('/bookings/create', data);
export const getMyBookings = () => API.get('/bookings/my');
export const getBooking = id => API.get(`/bookings/${id}`);

// Admin - Bookings
export const getAllBookings = (params) => API.get('/admin/bookings', { params });
export const updateBooking = (id, data) => API.put(`/admin/bookings/${id}`, data);
export const getDashboardStats = () => API.get('/admin/dashboard');

// Payments
export const createPaymentOrder = data => API.post('/payments/create-order', data);
export const verifyPayment = data => API.post('/payments/verify', data);

// Admin - Clients
export const getClients = () => API.get('/admin/clients');
export const getClient = id => API.get(`/admin/clients/${id}`);
export const createClient = data => API.post('/admin/clients', data);
export const updateClient = (id, data) => API.put(`/admin/clients/${id}`, data);
export const deleteClient = id => API.delete(`/admin/clients/${id}`);

// Admin - Rate Lists
export const getRateLists = () => API.get('/admin/rate-lists');
export const getRateList = id => API.get(`/admin/rate-lists/${id}`);
export const createRateList = data => API.post('/admin/rate-lists', data);
export const updateRateList = (id, data) => API.put(`/admin/rate-lists/${id}`, data);
export const deleteRateList = id => API.delete(`/admin/rate-lists/${id}`);

// Reports (patient - view & download)
export const getBookingReports = (bookingId) => API.get(`/bookings/${bookingId}/reports`);
export const downloadReportUrl  = (reportId) => `/api/reports/${reportId}/download`;

// Admin - Reports
export const uploadReports   = (bookingId, formData) =>
  API.post(`/admin/bookings/${bookingId}/reports`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const deleteReport = (reportId) => API.delete(`/admin/reports/${reportId}`);

export default API;

// ── Phlebotomists (Admin) ──────────────────────────────────
export const getPhlebos          = ()       => API.get('/admin/phlebos');
export const getAvailablePhlebos = (date)   => API.get('/admin/phlebos/available', { params: { date } });
export const getPhlebo           = (id)     => API.get(`/admin/phlebos/${id}`);
export const createPhlebo        = (data)   => API.post('/admin/phlebos', data);
export const updatePhlebo        = (id, d)  => API.put(`/admin/phlebos/${id}`, d);
export const deletePhlebo        = (id)     => API.delete(`/admin/phlebos/${id}`);
export const assignPhlebo        = (bookingId, phleId) =>
  API.post(`/admin/bookings/${bookingId}/assign-phlebo`, { phlebo_id: phleId });

// ── Admin create booking ──────────────────────────────────
export const adminCreateBooking  = (data)   => API.post('/admin/bookings', data);

// ── Client Portal ─────────────────────────────────────────
export const getClientProfile    = ()       => API.get('/client/profile');
export const getClientTests      = ()       => API.get('/client/tests');
export const getClientBookings   = (params) => API.get('/client/bookings', { params });
export const getClientBooking    = (id)     => API.get(`/client/bookings/${id}`);
export const createClientBooking = (data)   => API.post('/client/bookings', data);

// ── Client portal users (Admin) ───────────────────────────
export const getClientUsers      = (clientId)      => API.get(`/admin/clients/${clientId}/users`);
export const createClientUser    = (clientId, data) => API.post(`/admin/clients/${clientId}/users`, data);
export const deleteClientUser    = (id)            => API.delete(`/admin/client-users/${id}`);

// ── Third-Party Labs (Admin) ───────────────────────────────
export const getLabs         = ()        => API.get('/admin/labs');
export const getLab          = (id)      => API.get(`/admin/labs/${id}`);
export const createLab       = (data)    => API.post('/admin/labs', data);
export const updateLab       = (id, d)   => API.put(`/admin/labs/${id}`, d);
export const deleteLab       = (id)      => API.delete(`/admin/labs/${id}`);
export const getPushHistory  = (params)  => API.get('/admin/lab-push-history', { params });

// ── Push to Lab ────────────────────────────────────────────
export const pushToLab       = (bookingId, data) => API.post(`/admin/bookings/${bookingId}/push-to-lab`, data);
export const getPushLog      = (bookingId)        => API.get(`/admin/bookings/${bookingId}/push-log`);

// ── API Key Management (Admin) ─────────────────────────────
export const getApiClients   = ()        => API.get('/admin/api-clients');
export const createApiClient = (data)    => API.post('/admin/api-clients', data);
export const updateApiClient = (id, d)   => API.put(`/admin/api-clients/${id}`, d);
export const rotateApiKey    = (id)      => API.post(`/admin/api-clients/${id}/rotate`);
export const revokeApiClient = (id)      => API.delete(`/admin/api-clients/${id}`);
export const getApiAuditLog  = (id)      => API.get(`/admin/api-clients/${id}/audit`);
export const getAllAuditLogs  = (params)  => API.get('/admin/api-audit-log', { params });

// ── Phlebo self-service ────────────────────────────────────
export const getMyAssignments   = (params) => API.get('/phlebo/assignments', { params });
export const markSampleCollected = (bookingId) => API.put(`/phlebo/bookings/${bookingId}/collect`);