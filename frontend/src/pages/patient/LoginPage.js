import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TestTube, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      if (user.role === 'admin')       navigate('/admin');
      else if (user.role === 'phlebo') navigate('/phlebo');
      else if (user.role === 'client_user') navigate('/client');
      else                             navigate('/my-bookings');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon"><TestTube size={24}/></div>
          <div className="auth-brand-name">LabCollect</div>
        </div>
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-sub">Sign in to view your bookings and reports</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-icon">
              <Mail size={16}/>
              <input className="form-control" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon">
              <Lock size={16}/>
              <input className="form-control" type="password" placeholder="Your password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required/>
            </div>
          </div>
          <button className="btn btn-primary btn-lg auth-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
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