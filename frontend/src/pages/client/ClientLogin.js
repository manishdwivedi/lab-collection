import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Building2, Mail, Lock, TestTubes } from 'lucide-react';
import toast from 'react-hot-toast';
import './ClientLogin.css';

export default function ClientLogin() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]   = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role !== 'client_user') {
        toast.error('This login is for client portal only');
        return;
      }
      toast.success(`Welcome, ${user.name}!`);
      navigate('/client');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="client-login-page">
      {/* Left panel */}
      <div className="cl-left">
        <div className="cl-logo">
          <div className="cl-logo-icon"><TestTubes size={28}/></div>
          <span>LabCollect</span>
        </div>
        <h1 className="cl-hero-title">Client Portal</h1>
        <p className="cl-hero-sub">
          Access your organisation's bookings, track sample collection status,
          and download lab reports — all in one place.
        </p>
        <div className="cl-features">
          {[
            'View all bookings for your organisation',
            'Create new lab bookings instantly',
            'Track phlebotomist assignment & ETA',
            'Download reports when ready',
          ].map(f => (
            <div key={f} className="cl-feat">
              <div className="cl-feat-dot"/>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="cl-right">
        <div className="cl-card">
          <div className="cl-card-icon"><Building2 size={26}/></div>
          <h2 className="cl-card-title">Client Sign In</h2>
          <p className="cl-card-sub">Access your organisation's dashboard</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position:'relative' }}>
                <Mail size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input className="form-control" type="email" style={{ paddingLeft:36 }}
                  placeholder="portal@company.com" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})} required/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input className="form-control" type="password" style={{ paddingLeft:36 }}
                  placeholder="Your password" value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})} required/>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
              style={{ width:'100%', justifyContent:'center', marginTop:4 }}>
              {loading ? 'Signing in…' : 'Sign In to Portal'}
            </button>
          </form>

          <div className="cl-demo">
            <div style={{ fontWeight:700, marginBottom:4 }}>Demo Client Login</div>
            <div>Email: <code>portal@apolloclinics.com</code></div>
            <div>Password: <code>Admin@123</code></div>
          </div>

          <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'var(--text-muted)' }}>
            Are you a patient? <Link to="/login" style={{ color:'var(--accent)', fontWeight:600 }}>Patient Login →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}