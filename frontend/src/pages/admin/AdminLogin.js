import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TestTubes, Lock, Mail, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminLogin.css';

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role !== 'admin') {
        toast.error('Admin access required');
        return;
      }
      toast.success('Welcome, Administrator!');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-left">
        <div className="admin-login-brand">
          <div className="alb-icon"><TestTubes size={32}/></div>
          <div className="alb-name">LabCollect</div>
        </div>
        <h2 className="alb-title">Diagnostics Management System</h2>
        <p className="alb-desc">Manage bookings, tests, clients, and rate lists from a single powerful dashboard.</p>
        <div className="alb-features">
          {['Complete booking management','Test & service catalog','Client rate list management','Home collection tracking'].map(f => (
            <div key={f} className="alb-feature">
              <div className="alb-dot"/>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-login-right">
        <div className="admin-login-card">
          <div className="alc-icon"><Shield size={28}/></div>
          <h2 className="alc-title">Admin Login</h2>
          <p className="alc-sub">Authorized personnel only</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}/>
                <input
                  className="form-control"
                  type="email"
                  style={{ paddingLeft: 38 }}
                  placeholder="admin@labcollection.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}/>
                <input
                  className="form-control"
                  type="password"
                  style={{ paddingLeft: 38 }}
                  placeholder="Your admin password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Signing In...' : 'Sign In to Admin Panel'}
            </button>
          </form>

          {/* <div className="alc-demo">
            <div className="alc-demo-title">Demo Credentials</div>
            <div>Email: <code>admin@labcollection.com</code></div>
            <div>Password: <code>Admin@123</code></div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
