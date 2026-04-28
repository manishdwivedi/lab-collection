import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { claimBooking } from '../../utils/api';
import {
  CheckCircle, List, Home, User, LogIn,
  ArrowRight, FileText, Clock, Phone,
} from 'lucide-react';
import './PaymentSuccessPage.css';

export default function PaymentSuccessPage() {
  const { state }    = useLocation();
  const navigate     = useNavigate();
  const { user, login, register } = useAuth();

  const bookingNumber = state?.bookingNumber;
  const totalAmount   = state?.totalAmount;
  const bookingId     = state?.bookingId;

  const [mode,    setMode]    = useState('choice'); // 'choice' | 'login' | 'register' | 'done'
  const [form,    setForm]    = useState({ name:'', email:'', phone:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // If user is already logged in when they land here, auto-claim and go straight to success
  useEffect(() => {
    if (user && bookingId) {
      claimBooking(bookingId).catch(() => {});
      setMode('done');
    }
  }, [user, bookingId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      // claim the booking after successful login
      if (bookingId) await claimBooking(bookingId).catch(() => {});
      setMode('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password });
      // claim the guest booking after account creation
      if (bookingId) await claimBooking(bookingId).catch(() => {});
      setMode('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Try a different email.');
    } finally { setLoading(false); }
  };

  const h = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // ── Booking confirmed card (always shown at top) ─────────
  const ConfirmedCard = () => (
    <div className="ps-confirmed-card">
      <div className="ps-tick">
        <CheckCircle size={44} color="#2ECC71"/>
      </div>
      <h1 className="ps-title">Payment Successful!</h1>
      <p className="ps-subtitle">Your booking is confirmed and our team will contact you shortly.</p>
      <div className="ps-booking-info">
        <div className="ps-info-row">
          <span className="ps-info-label">Booking Number</span>
          <span className="ps-booking-num">{bookingNumber}</span>
        </div>
        <div className="ps-info-row">
          <span className="ps-info-label">Amount Paid</span>
          <span className="ps-amount">₹{parseFloat(totalAmount || 0).toFixed(0)}</span>
        </div>
      </div>
    </div>
  );

  // ── Already logged in / just authenticated — show full success ──
  if (mode === 'done' || (user && mode !== 'login' && mode !== 'register')) {
    return (
      <div className="ps-page">
        <ConfirmedCard/>

        <div className="ps-success-panel">
          <div className="ps-success-msg">
            <CheckCircle size={18} color="#2ECC71"/>
            <span>Booking linked to your account — <strong>{user?.name || user?.email}</strong></span>
          </div>

          <div className="ps-next-steps">
            <div className="ps-step"><Clock size={15}/> Track status updates in My Bookings</div>
            <div className="ps-step"><FileText size={15}/> Reports will be available once processed</div>
            <div className="ps-step"><Phone size={15}/> Our team will call to confirm collection time</div>
          </div>

          <div className="ps-actions">
            <button className="btn btn-primary ps-cta" onClick={() => navigate('/my-bookings')}>
              <List size={16}/> View My Bookings <ArrowRight size={15}/>
            </button>
            <Link to="/" className="btn btn-outline"><Home size={15}/> Go Home</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Guest: show choice prompt ────────────────────────────
  return (
    <div className="ps-page">
      <ConfirmedCard/>

      {mode === 'choice' && (
        <div className="ps-auth-panel">
          <div className="ps-auth-header">
            <User size={20} color="var(--primary)"/>
            <div>
              <div className="ps-auth-title">Save this booking to your account</div>
              <div className="ps-auth-sub">Login or register to track status, download reports, and view booking history</div>
            </div>
          </div>

          <div className="ps-auth-benefits">
            {[
              { icon: List,     text: 'View full booking history' },
              { icon: FileText, text: 'Download reports when ready' },
              { icon: Clock,    text: 'Track real-time status updates' },
            ].map((b, i) => (
              <div key={i} className="ps-benefit">
                <b.icon size={14} color="var(--accent)"/> {b.text}
              </div>
            ))}
          </div>

          <div className="ps-auth-btns">
            <button className="btn btn-primary" onClick={() => setMode('login')}>
              <LogIn size={15}/> Login to My Account
            </button>
            <button className="btn btn-outline" onClick={() => setMode('register')}>
              <User size={15}/> Create New Account
            </button>
          </div>

          <Link to="/" className="ps-skip">Skip for now — just go home</Link>
        </div>
      )}

      {mode === 'login' && (
        <div className="ps-auth-panel">
          <div className="ps-auth-header">
            <LogIn size={18} color="var(--primary)"/>
            <div>
              <div className="ps-auth-title">Login to your account</div>
              <div className="ps-auth-sub">This booking will be automatically linked after login</div>
            </div>
          </div>
          <form onSubmit={handleLogin} className="ps-form">
            {error && <div className="ps-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" name="email" type="email"
                value={form.email} onChange={h} placeholder="you@example.com" required/>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" name="password" type="password"
                value={form.password} onChange={h} placeholder="Your password" required/>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width:'100%' }}>
              {loading ? 'Logging in…' : 'Login & Link Booking'}
            </button>
            <div className="ps-switch">
              Don't have an account?{' '}
              <button type="button" className="ps-link" onClick={() => { setMode('register'); setError(''); }}>
                Register instead
              </button>
            </div>
            <button type="button" className="ps-skip" onClick={() => setMode('choice')}>← Back</button>
          </form>
        </div>
      )}

      {mode === 'register' && (
        <div className="ps-auth-panel">
          <div className="ps-auth-header">
            <User size={18} color="var(--primary)"/>
            <div>
              <div className="ps-auth-title">Create your account</div>
              <div className="ps-auth-sub">Takes 30 seconds — booking linked automatically</div>
            </div>
          </div>
          <form onSubmit={handleRegister} className="ps-form">
            {error && <div className="ps-error">{error}</div>}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" name="name" value={form.name} onChange={h}
                  placeholder="Your name" required/>
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-control" name="phone" value={form.phone} onChange={h}
                  placeholder="+91 XXXXX XXXXX" required/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-control" name="email" type="email" value={form.email} onChange={h}
                placeholder="you@example.com" required/>
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-control" name="password" type="password" value={form.password} onChange={h}
                placeholder="At least 6 characters" required minLength={6}/>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width:'100%' }}>
              {loading ? 'Creating account…' : 'Create Account & Save Booking'}
            </button>
            <div className="ps-switch">
              Already have an account?{' '}
              <button type="button" className="ps-link" onClick={() => { setMode('login'); setError(''); }}>
                Login instead
              </button>
            </div>
            <button type="button" className="ps-skip" onClick={() => setMode('choice')}>← Back</button>
          </form>
        </div>
      )}
    </div>
  );
}