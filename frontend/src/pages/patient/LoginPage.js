import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginWithBooking } from '../../utils/api';
import {
  TestTube, Mail, Lock, AlertTriangle, Clock,
  Phone, Hash, ChevronRight, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './AuthPages.css';

/* ── Session expiry banners ─────────────────────────────── */
const SESSION_MESSAGES = {
  inactivity: {
    icon: Clock, color: '#E67E22', bg: '#FEF9E7', border: '#F9E79F',
    title: 'Session Timed Out',
    text:  'You were logged out due to inactivity. Please sign in to continue.',
  },
  expired: {
    icon: AlertTriangle, color: '#E74C3C', bg: '#FDEDEC', border: '#F5B7B1',
    title: 'Session Expired',
    text:  'Your session has expired. Please sign in again.',
  },
};

export default function LoginPage() {
  const { login }         = useAuth();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();
  const reason            = searchParams.get('reason');
  const sessionMsg        = SESSION_MESSAGES[reason];

  // 'email' | 'booking'
  const [tab,     setTab]     = useState('email');
  const [loading, setLoading] = useState(false);

  // Email/password form
  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  // Phone + booking_number form
  const [bookingForm, setBookingForm] = useState({ phone: '', booking_number: '' });

  /* ── Email / password login ─────────────────────────── */
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(emailForm.email, emailForm.password);
      toast.success(`Welcome back, ${user.name}!`);
      if (user.role === 'admin')       navigate('/admin');
      else if (user.role === 'phlebo') navigate('/phlebo');
      else                             navigate('/my-bookings');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  /* ── Phone + Booking ID login ───────────────────────── */
  const handleBookingLogin = async (e) => {
    e.preventDefault();
    if (!bookingForm.phone.trim())          return toast.error('Enter your phone number');
    if (!bookingForm.booking_number.trim()) return toast.error('Enter your booking number');

    setLoading(true);
    try {
      const res = await loginWithBooking({
        phone:          bookingForm.phone.trim(),
        booking_number: bookingForm.booking_number.trim().toUpperCase(),
      });

      const { token, user, booking, login_type } = res.data;

      // Store token (AuthContext login not used here — guest token is different)
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Force a page reload so AuthContext picks up the new token
      // (AuthContext.login() is for email/password only)
      if (login_type === 'full') {
        // Full account login — trigger normal auth flow
        toast.success(`Welcome back, ${user.name}!`);
        navigate('/my-bookings');
        window.location.href = '/my-bookings'; // hard refresh to re-init AuthContext
      } else {
        // Guest — go directly to the booking detail
        toast.success(`Found your booking — ${booking.booking_number}`);
        window.location.href = `/bookings/${booking.id}`;
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not find a booking with those details';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const bh = e => setBookingForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const eh = e => setEmailForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon"><TestTube size={24}/></div>
          <div className="auth-brand-name">LabCollect</div>
        </div>

        {/* Session expiry notice */}
        {sessionMsg && (
          <div className="session-notice" style={{ background: sessionMsg.bg, borderColor: sessionMsg.border }}>
            <sessionMsg.icon size={16} color={sessionMsg.color} style={{ flexShrink:0 }}/>
            <div>
              <div className="session-notice-title" style={{ color: sessionMsg.color }}>{sessionMsg.title}</div>
              <div className="session-notice-text">{sessionMsg.text}</div>
            </div>
          </div>
        )}

        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-sub">Sign in to view your bookings and reports</p>

        {/* Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${tab === 'email' ? 'active' : ''}`}
            onClick={() => setTab('email')}
          >
            <Mail size={14}/> Email & Password
          </button>
          <button
            className={`login-tab ${tab === 'booking' ? 'active' : ''}`}
            onClick={() => setTab('booking')}
          >
            <Hash size={14}/> Phone & Booking ID
          </button>
        </div>

        {/* ── Email / Password form ─────────────────────── */}
        {tab === 'email' && (
          <form onSubmit={handleEmailLogin} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-icon">
                <Mail size={15}/>
                <input
                  className="form-control"
                  type="email"
                  name="email"
                  value={emailForm.email}
                  onChange={eh}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-icon">
                <Lock size={15}/>
                <input
                  className="form-control"
                  type="password"
                  name="password"
                  value={emailForm.password}
                  onChange={eh}
                  placeholder="Your password"
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary btn-lg auth-btn" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── Phone + Booking ID form ───────────────────── */}
        {tab === 'booking' && (
          <form onSubmit={handleBookingLogin} className="auth-form">
            <div className="booking-login-info">
              <FileText size={14}/>
              <span>
                Enter the phone number used when booking, and your booking number
                (e.g. <strong>BK2412xxxx</strong>).
                No account or password needed.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-icon">
                <Phone size={15}/>
                <input
                  className="form-control"
                  type="tel"
                  name="phone"
                  value={bookingForm.phone}
                  onChange={bh}
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Booking Number</label>
              <div className="input-icon">
                <Hash size={15}/>
                <input
                  className="form-control"
                  type="text"
                  name="booking_number"
                  value={bookingForm.booking_number}
                  onChange={bh}
                  placeholder="BK2412XXXX"
                  style={{ textTransform: 'uppercase' }}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary btn-lg auth-btn" type="submit" disabled={loading}>
              {loading ? 'Looking up…' : (
                <><span>View My Booking</span><ChevronRight size={16}/></>
              )}
            </button>
          </form>
        )}

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
        <div className="auth-demo">
          <strong>Admin demo:</strong> admin@labcollection.com / Admin@123
        </div>
      </div>
    </div>
  );
}