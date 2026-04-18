import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TestTube } from 'lucide-react';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', gender: '', date_of_birth: '' });
  const [loading, setLoading] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Welcome, ${user.name}!`);
      navigate('/tests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <div className="auth-brand-icon"><TestTube size={24}/></div>
          <div className="auth-brand-name">LabCollect</div>
        </div>
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-sub">Register to book tests and track your reports</p>

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" name="name" value={form.name} onChange={h} required placeholder="Your full name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input className="form-control" name="phone" value={form.phone} onChange={h} required placeholder="Mobile number"/>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-control" type="email" name="email" value={form.email} onChange={h} required placeholder="Email"/>
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-control" type="password" name="password" value={form.password} onChange={h} required placeholder="Min 6 characters" minLength={6}/>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input className="form-control" type="date" name="date_of_birth" value={form.date_of_birth} onChange={h}/>
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-control" name="gender" value={form.gender} onChange={h}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-lg auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
