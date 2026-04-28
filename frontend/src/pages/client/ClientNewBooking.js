import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClientTests, createClientBooking } from '../../utils/api';
import { Search, Plus, Minus, FlaskConical, ChevronRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import './ClientNewBooking.css';

export default function ClientNewBooking() {
  const navigate = useNavigate();
  const [tests,     setTests]     = useState([]);
  const [selTests,  setSelTests]  = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [submitting,setSubmitting]= useState(false);
  const [step,      setStep]      = useState(1); // 1=select tests, 2=patient details
  const [form, setForm] = useState({
    patient_name:'', patient_age:'', patient_gender:'', patient_phone:'',
    patient_address:'', collection_type:'home', collection_date:'',
    collection_time:'', collection_address:'', notes:'',
  });

  useEffect(() => {
    getClientTests().then(r => { setTests(r.data.tests); setLoading(false); });
  }, []);

  const h = e => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleTest = (t) => {
    setSelTests(prev =>
      prev.find(s => s.id === t.id)
        ? prev.filter(s => s.id !== t.id)
        : [...prev, t]
    );
  };

  const handleSubmit = async () => {
    if (!form.patient_name || !form.patient_phone) return toast.error('Patient name and phone required');
    setSubmitting(true);
    try {
      const res = await createClientBooking({
        ...form,
        test_ids: selTests.map(t => t.id),
      });
      toast.success(`Booking ${res.data.bookingNumber} created!`);
      navigate(`/client/bookings/${res.data.bookingId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    } finally { setSubmitting(false); }
  };

  const filtered = tests.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, t) => {
    const cat = t.category_name || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const total = selTests.reduce((s, t) => s + parseFloat(t.client_price || t.base_price || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">New Booking</div>
          <div className="page-subtitle">
            {step === 1 ? 'Step 1: Select tests for the patient' : 'Step 2: Enter patient & collection details'}
          </div>
        </div>
        {step === 2 && (
          <button className="btn btn-outline" onClick={() => setStep(1)}>← Back to Tests</button>
        )}
      </div>

      {/* Progress bar */}
      <div className="cnb-progress">
        <div className={`cnb-step ${step >= 1 ? 'active' : ''}`}>
          <div className="cnb-step-dot">{step > 1 ? <CheckCircle size={14}/> : '1'}</div>
          <span>Select Tests</span>
        </div>
        <div className="cnb-progress-line"/>
        <div className={`cnb-step ${step >= 2 ? 'active' : ''}`}>
          <div className="cnb-step-dot">2</div>
          <span>Patient Details</span>
        </div>
      </div>

      {step === 1 ? (
        /* ── Step 1: Test Selection ── */
        <div className="cnb-layout">
          <div className="cnb-test-panel">
            <div className="search-bar" style={{ marginBottom:16 }}>
              <Search size={15}/>
              <input className="form-control" placeholder="Search tests by name or code…"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>

            {loading ? (
              <div className="loading-container"><div className="spinner"/></div>
            ) : (
              Object.entries(grouped).map(([cat, catTests]) => (
                <div key={cat} className="cnb-group">
                  <div className="cnb-group-title">{cat}</div>
                  {catTests.map(t => {
                    const selected    = selTests.some(s => s.id === t.id);
                    const clientPrice = parseFloat(t.client_price || t.base_price || 0);
                    const basePrice   = parseFloat(t.base_price || 0);
                    const hasDiscount = t.client_price && parseFloat(t.client_price) < basePrice;
                    const savings     = hasDiscount ? basePrice - clientPrice : 0;
                    return (
                      <div key={t.id} className={`cnb-test-row ${selected ? 'selected' : ''}`}>
                        <div className="cnb-tr-left">
                          <span className="cnb-tr-code">{t.code}</span>
                          <div>
                            <div className="cnb-tr-name">{t.name}</div>
                            <div className="cnb-tr-meta">
                              {t.sample_type && <span>🧪 {t.sample_type}</span>}
                              {t.report_time && <span>⏱ {t.report_time}</span>}
                              {t.fasting_required && <span className="fasting-badge">Fasting</span>}
                            </div>
                          </div>
                        </div>
                        <div className="cnb-tr-right">
                          <div className="cnb-tr-price-block">
                            {hasDiscount && (
                              <div className="cnb-tr-base-price">₹{basePrice.toFixed(0)}</div>
                            )}
                            <div className={`cnb-tr-price ${hasDiscount ? 'discounted' : ''}`}>
                              ₹{clientPrice.toFixed(0)}
                            </div>
                            {hasDiscount && (
                              <div className="cnb-tr-savings">Save ₹{savings.toFixed(0)}</div>
                            )}
                          </div>
                          <button
                            className={`btn btn-sm ${selected ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => toggleTest(t)}
                          >
                            {selected ? <Minus size={13}/> : <Plus size={13}/>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Cart sidebar */}
          <div className="cnb-cart">
            <div className="cnb-cart-title">Selected Tests</div>
            {selTests.length === 0 ? (
              <div className="cnb-cart-empty">
                <FlaskConical size={32}/>
                <p>No tests selected yet</p>
              </div>
            ) : (
              <>
                <div className="cnb-cart-items">
                  {selTests.map(t => (
                    <div key={t.id} className="cnb-cart-item">
                      <div className="cnb-ci-info">
                        <div className="cnb-ci-name">{t.name}</div>
                        <div className="cnb-ci-code">{t.code}</div>
                      </div>
                      <div className="cnb-ci-right">
                        <span className="cnb-ci-price">₹{parseFloat(t.client_price || t.base_price || 0).toFixed(0)}</span>
                        <button className="cnb-ci-remove" onClick={() => toggleTest(t)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cnb-cart-total">
                  <span>Total ({selTests.length} tests)</span>
                  <span>₹{total.toFixed(0)}</span>
                </div>
              </>
            )}
            <button
              className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', marginTop:14 }}
              disabled={selTests.length === 0}
              onClick={() => setStep(2)}
            >
              Continue <ChevronRight size={15}/>
            </button>
          </div>
        </div>
      ) : (
        /* ── Step 2: Patient Details ── */
        <div className="cnb-form-layout">
          <div className="card">
            <div style={{ fontWeight:700, color:'var(--primary)', marginBottom:20, fontSize:15 }}>Patient Information</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Patient Name *</label>
                <input className="form-control" name="patient_name" value={form.patient_name} onChange={h} placeholder="Full name"/>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input className="form-control" name="patient_phone" value={form.patient_phone} onChange={h} placeholder="Mobile number"/>
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-control" type="number" name="patient_age" value={form.patient_age} onChange={h} placeholder="Age" min="1" max="120"/>
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-control" name="patient_gender" value={form.patient_gender} onChange={h}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Patient Address</label>
              <textarea className="form-control" name="patient_address" value={form.patient_address} onChange={h} rows={2} placeholder="Patient's address"/>
            </div>

            <div style={{ fontWeight:700, color:'var(--primary)', margin:'20px 0 16px', paddingTop:16, borderTop:'1px solid var(--border)', fontSize:15 }}>Collection Details</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Collection Type</label>
                <select className="form-control" name="collection_type" value={form.collection_type} onChange={h}>
                  <option value="home">Home Collection</option>
                  <option value="walkin">Walk-in</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Collection Date</label>
                <input className="form-control" type="date" name="collection_date" value={form.collection_date} onChange={h} min={new Date().toISOString().split('T')[0]}/>
              </div>
              <div className="form-group">
                <label className="form-label">Collection Time</label>
                <select className="form-control" name="collection_time" value={form.collection_time} onChange={h}>
                  <option value="">Select time slot</option>
                  {['7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            {form.collection_type === 'home' && (
              <div className="form-group">
                <label className="form-label">Home Collection Address</label>
                <textarea className="form-control" name="collection_address" value={form.collection_address} onChange={h} rows={2} placeholder="Full address for home visit"/>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes / Instructions</label>
              <textarea className="form-control" name="notes" value={form.notes} onChange={h} rows={2} placeholder="Any special instructions for the phlebotomist…"/>
            </div>

            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}
              style={{ width:'100%', justifyContent:'center', marginTop:8 }}>
              {submitting ? 'Creating Booking…' : `Confirm Booking — ₹${total.toFixed(0)}`}
            </button>
          </div>

          {/* Summary sidebar */}
          <div className="cnb-summary">
            <div className="card">
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:'var(--primary)' }}>Order Summary</div>
              {selTests.map(t => (
                <div key={t.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
                  <span>{t.name}</span>
                  <span style={{ fontWeight:700 }}>₹{parseFloat(t.client_price||t.base_price||0).toFixed(0)}</span>
                </div>
              ))}
              <div style={{ borderTop:'2px solid var(--border)', paddingTop:12, marginTop:8, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:16 }}>
                <span>Total</span>
                <span>₹{total.toFixed(0)}</span>
              </div>
              <div style={{ marginTop:14, padding:'10px 12px', background:'var(--surface2)', borderRadius:8, fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
                💡 Prices shown are your client-specific rates. Payment will be settled per your credit terms.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}