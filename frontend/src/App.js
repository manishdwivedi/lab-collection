import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

// Patient Pages
import HomePage           from './pages/patient/HomePage';
import TestsPage          from './pages/patient/TestsPage';
import BookingPage        from './pages/patient/BookingPage';
import PaymentPage        from './pages/patient/PaymentPage';
import PaymentSuccessPage from './pages/patient/PaymentSuccessPage';
import LoginPage          from './pages/patient/LoginPage';
import RegisterPage       from './pages/patient/RegisterPage';
import MyBookingsPage     from './pages/patient/MyBookingsPage';
import BookingDetailPage  from './pages/patient/BookingDetailPage';

// Admin Pages
import AdminLogin          from './pages/admin/AdminLogin';
import AdminDashboard      from './pages/admin/AdminDashboard';
import AdminBookings       from './pages/admin/AdminBookings';
import AdminTests          from './pages/admin/AdminTests';
import AdminClients        from './pages/admin/AdminClients';
import AdminRateLists      from './pages/admin/AdminRateLists';
import AdminRateListDetail from './pages/admin/AdminRateListDetail';
import AdminPhlebos        from './pages/admin/AdminPhlebo';
import AdminLabs           from './pages/admin/AdminLabs';
import AdminApiKeys        from './pages/admin/AdminApiKeys';
import AdminApiDocs        from './pages/admin/AdminApiDocs';

// Client Portal Pages
import ClientLogin         from './pages/client/ClientLogin';
import ClientDashboard     from './pages/client/ClientDashboard';
import ClientBookings      from './pages/client/ClientBooking';
import ClientNewBooking    from './pages/client/ClientNewBooking';
import ClientBookingDetail from './pages/client/ClientBookingDetail';

// Layouts
import PatientLayout from './components/shared/PatientLayout';
import AdminLayout   from './components/shared/AdminLayout';
import ClientLayout  from './components/client/ClientLayout';

/* ── Route Guards ─────────────────────────────────────────── */
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner"/></div>;
  return user ? children : <Navigate to="/login"/>;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner"/></div>;
  if (!user)               return <Navigate to="/admin/login"/>;
  if (user.role !== 'admin') return <Navigate to="/"/>;
  return children;
};

const ClientRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner"/></div>;
  if (!user)                       return <Navigate to="/client/login"/>;
  if (user.role !== 'client_user') return <Navigate to="/"/>;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 3000 }}/>
          <Routes>

            {/* ── Patient / Public ── */}
            <Route path="/" element={<PatientLayout/>}>
              <Route index element={<HomePage/>}/>
              <Route path="tests"   element={<TestsPage/>}/>
              <Route path="book"    element={<BookingPage/>}/>
              <Route path="payment/:bookingId" element={<PaymentPage/>}/>
              <Route path="payment-success"    element={<PaymentSuccessPage/>}/>
              <Route path="login"    element={<LoginPage/>}/>
              <Route path="register" element={<RegisterPage/>}/>
              <Route path="my-bookings"  element={<PrivateRoute><MyBookingsPage/></PrivateRoute>}/>
              <Route path="bookings/:id" element={<PrivateRoute><BookingDetailPage/></PrivateRoute>}/>
            </Route>

            {/* ── Admin ── */}
            <Route path="/admin/login" element={<AdminLogin/>}/>
            <Route path="/admin" element={<AdminRoute><AdminLayout/></AdminRoute>}>
              <Route index               element={<AdminDashboard/>}/>
              <Route path="bookings"     element={<AdminBookings/>}/>
              <Route path="phlebos"      element={<AdminPhlebos/>}/>
              <Route path="tests"        element={<AdminTests/>}/>
              <Route path="clients"      element={<AdminClients/>}/>
              <Route path="rate-lists"   element={<AdminRateLists/>}/>
              <Route path="rate-lists/:id" element={<AdminRateListDetail/>}/>
              <Route path="labs"         element={<AdminLabs/>}/>
              <Route path="api-keys"     element={<AdminApiKeys/>}/>
              <Route path="api-docs"     element={<AdminApiDocs/>}/>
            </Route>

            {/* ── Client Portal ── */}
            <Route path="/client/login" element={<ClientLogin/>}/>
            <Route path="/client" element={<ClientRoute><ClientLayout/></ClientRoute>}>
              <Route index               element={<ClientDashboard/>}/>
              <Route path="bookings"     element={<ClientBookings/>}/>
              <Route path="bookings/:id" element={<ClientBookingDetail/>}/>
              <Route path="new"          element={<ClientNewBooking/>}/>
            </Route>

          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;