import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { createBooking } from '../../utils/api';
import { Trash2, ShoppingCart, User, MapPin, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import './BookingPage.css';

export default function BookingPage() {
  const { cartItems, removeFromCart, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    patient_name: user?.name || '',
    patient_age: '',
    patient_gender: '',
    patient_phone: user?.phone || '',
    patient_address: '',
    collection_type: 'home',
    collection_date: '',
    collection_time: '',
    collection_address: '',
    notes: '',
  });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cartItems.length) return toast.error('Please add at least one test');
    if (!form.patient_name || !form.patient_phone) return toast.error('Please fill required fields');
    setLoading(true);
    try {
      const res = await createBooking({
        ...form,
        test_ids: cartItems.map(t => t.id),
        user_id: user?.id,
      });
      clearCart();
      navigate(`/payment/${res.data.bookingId}`, { state: { bookingNumber: res.data.bookingNumber, totalAmount: res.data.totalAmount } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  if (!cartItems.length) {
    return (
      <div className="booking-empty">
        <div className="empty-state">
          <ShoppingCart size={64}/>
          <h3>Your cart is empty</h3>
          <p>Add some tests to proceed with booking</p>
          <Link to="/tests" className="btn btn-primary" style={{ marginTop: 16 }}>Browse Tests</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <div className="booking-header">
        <div className="booking-header-inner">
          <h1>Complete Your Booking</h1>
          <p>Fill in patient details and select collection preference</p>
        </div>
      </div>

      <div className="booking-container">
        <form className="booking-form-area" onSubmit={handleSubmit}>
          {/* Patient Details */}
          <div className="booking-card">
            <div className="booking-card-title"><User size={18}/> Patient Details</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Patient Name *</label>
                <input className="form-control" name="patient_name" value={form.patient_name} onChange={handleChange} required placeholder="Full name"/>
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-control" name="patient_phone" value={form.patient_phone} onChange={handleChange} required placeholder="+91 XXXXX XXXXX"/>
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-control" name="patient_age" type="number" value={form.patient_age} onChange={handleChange} placeholder="Age in years" min="1" max="120"/>
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-control" name="patient_gender" value={form.patient_gender} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Patient Address</label>
              <textarea className="form-control" name="patient_address" value={form.patient_address} onChange={handleChange} rows={2} placeholder="Patient's full address"/>
            </div>
          </div>

          {/* Collection Type */}
          <div className="booking-card">
            <div className="booking-card-title"><MapPin size={18}/> Collection Type</div>
            <div className="collection-types">
              {[
                // { value: 'walkin', label: 'Walk-In', desc: 'Visit our collection center' },
                { value: 'home', label: 'Home Collection', desc: 'Technician visits your home' },
              ].map(opt => (
                <label key={opt.value} className={`collection-option ${form.collection_type === opt.value ? 'selected' : ''}`}>
                  <input type="radio" name="collection_type" value={opt.value} checked={form.collection_type === opt.value} onChange={handleChange} hidden/>
                  <div className="co-check"/>
                  <div>
                    <div className="co-label">{opt.label}</div>
                    <div className="co-desc">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="booking-card">
            <div className="booking-card-title"><Calendar size={18}/> Schedule</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Preferred Date</label>
                <input className="form-control" type="date" name="collection_date" value={form.collection_date} onChange={handleChange} min={new Date().toISOString().split('T')[0]}/>
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Time</label>
                <select className="form-control" name="collection_time" value={form.collection_time} onChange={handleChange}>
                  <option value="">Select time slot</option>
                  {['7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            {form.collection_type === 'home' && (
              <div className="form-group">
                <label className="form-label">Collection Address *</label>
                <textarea className="form-control" name="collection_address" value={form.collection_address} onChange={handleChange} rows={2} placeholder="Full address for home collection"/>
              </div>
            )}
          </div>

          {!user && (
            <div className="alert alert-info">
              <strong>Tip:</strong> <Link to="/login">Login</Link> or <Link to="/register">Register</Link> to track your bookings and get reports online.
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating Booking...' : 'Proceed to Payment →'}
          </button>
        </form>

        {/* Order Summary */}
        <div className="booking-summary">
          <div className="summary-card">
            <div className="summary-title">Order Summary</div>
            <div className="summary-items">
              {cartItems.map(test => (
                <div key={test.id} className="summary-item">
                  <div className="si-info">
                    <div className="si-name">{test.name}</div>
                    <div className="si-code">{test.code}</div>
                  </div>
                  <div className="si-right">
                    <div className="si-price">₹{parseFloat(test.base_price).toFixed(0)}</div>
                    <button className="si-remove" onClick={() => removeFromCart(test.id)}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="summary-total">
              <div className="summary-row"><span>Subtotal</span><span>₹{totalAmount.toFixed(0)}</span></div>
              <div className="summary-row"><span>Tax (0%)</span><span>₹0</span></div>
              <div className="summary-row total-row"><span>Total</span><span>₹{totalAmount.toFixed(0)}</span></div>
            </div>
            <Link to="/tests" className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
              + Add More Tests
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
