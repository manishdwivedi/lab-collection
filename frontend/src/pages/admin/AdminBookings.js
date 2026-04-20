import React, { useState, useEffect } from 'react';
import {
  getAllBookings, updateBooking, getAvailablePhlebos, assignPhlebo,
  adminCreateBooking, getClients, getTests
} from '../../utils/api';
import { Search, Filter, Edit2, X, Save, Upload, FileText, UserCheck, Plus, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import ReportUploadModal from '../../components/admin/ReportUploadModal';
import PushToLabModal  from '../../components/admin/PushToLabModal';
import './AdminBookings.css';

const statusOptions = ['pending','confirmed','sample_collected','processing','completed','cancelled'];
const payOptions    = ['pending','paid','failed','refunded'];
const statusColor   = {
  pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success',
  cancelled: 'badge-danger', sample_collected: 'badge-info', processing: 'badge-info'
};
const payColor = { pending:'badge-warning', paid:'badge-success', failed:'badge-danger', refunded:'badge-muted' };

/* ─── Edit Booking Modal ────────────────────────────────── */
function EditBookingModal({ booking, onClose, onSave }) {
  const [form, setForm] = useState({
    booking_status:  booking.booking_status,
    payment_status:  booking.payment_status,
    collection_date: booking.collection_date?.split('T')[0] || '',
    collection_time: booking.collection_time || '',
    notes:           booking.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setLoading(true);
    try { await updateBooking(booking.id, form); toast.success('Booking updated!'); onSave(); }
    catch { toast.error('Update failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Edit Booking</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>#{booking.booking_number} — {booking.patient_name}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Booking Status</label>
              <select className="form-control" name="booking_status" value={form.booking_status} onChange={h}>
                {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select className="form-control" name="payment_status" value={form.payment_status} onChange={h}>
                {payOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Collection Date</label>
              <input className="form-control" type="date" name="collection_date" value={form.collection_date} onChange={h}/>
            </div>
            <div className="form-group">
              <label className="form-label">Collection Time</label>
              <select className="form-control" name="collection_time" value={form.collection_time} onChange={h}>
                <option value="">Select time</option>
                {['7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" name="notes" value={form.notes} onChange={h} rows={3} placeholder="Internal notes…"/>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={14}/> {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Assign Phlebo Modal ───────────────────────────────── */
function AssignPhleBoModal({ booking, onClose, onSave }) {
  const [phlebos,   setPhlebos]   = useState([]);
  const [selected,  setSelected]  = useState(booking.phlebo_id || '');
  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(true);

  useEffect(() => {
    getAvailablePhlebos(booking.collection_date?.split('T')[0] || '')
      .then(r => setPhlebos(r.data.phlebos))
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await assignPhlebo(booking.id, selected || null);
      toast.success(selected ? 'Phlebotomist assigned!' : 'Assignment removed');
      onSave();
    } catch { toast.error('Assignment failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Assign Phlebotomist</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              #{booking.booking_number} — {booking.patient_name}
              {booking.collection_date && ` · ${new Date(booking.collection_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          {fetching ? (
            <div className="loading-container" style={{ padding: 40 }}><div className="spinner"/></div>
          ) : (
            <div className="phlebo-select-list">
              <label className={`phlebo-option ${!selected ? 'selected' : ''}`}>
                <input type="radio" name="phlebo" value="" checked={!selected} onChange={() => setSelected('')} hidden/>
                <div className="po-radio"/>
                <div className="po-info">
                  <div className="po-name">— No assignment (remove)</div>
                </div>
              </label>
              {phlebos.map(p => (
                <label key={p.id} className={`phlebo-option ${String(selected) === String(p.id) ? 'selected' : ''}`}>
                  <input type="radio" name="phlebo" value={p.id} checked={String(selected) === String(p.id)} onChange={() => setSelected(p.id)} hidden/>
                  <div className="po-radio"/>
                  <div className="po-info">
                    <div className="po-name">{p.name}</div>
                    <div className="po-meta">{p.employee_code} · {p.phone} · {p.assigned_count} assignment{p.assigned_count !== 1 ? 's' : ''} this date</div>
                  </div>
                  <div className={`po-load ${p.assigned_count >= 5 ? 'high' : p.assigned_count >= 3 ? 'medium' : 'low'}`}>
                    {p.assigned_count >= 5 ? 'Busy' : p.assigned_count >= 3 ? 'Moderate' : 'Free'}
                  </div>
                </label>
              ))}
              {!phlebos.length && (
                <div style={{ color:'var(--text-muted)', textAlign:'center', padding:24 }}>
                  No phlebotomists available. Add staff first.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || fetching}>
            <UserCheck size={14}/> {loading ? 'Assigning…' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Admin Create Booking Modal ────────────────────────── */
function CreateBookingModal({ onClose, onSave }) {
  const [clients,  setClients]  = useState([]);
  const [tests,    setTests]    = useState([]);
  const [selTests, setSelTests] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [form, setForm] = useState({
    client_id: '', patient_name: '', patient_age: '', patient_gender: '',
    patient_phone: '', patient_address: '',
    collection_type: 'home', collection_date: '', collection_time: '',
    collection_address: '', notes: '',
  });
  const h = e => setForm({ ...form, [e.target.name]: e.target.value });

  useEffect(() => {
    getClients().then(r => setClients(r.data.clients));
    getTests().then(r => setTests(r.data.tests));
  }, []);

  const toggleTest = (t) => {
    setSelTests(prev =>
      prev.find(s => s.id === t.id)
        ? prev.filter(s => s.id !== t.id)
        : [...prev, t]
    );
  };

  const handleCreate = async () => {
    if (!form.patient_name || !form.patient_phone) return toast.error('Patient name and phone required');
    if (!selTests.length) return toast.error('Select at least one test');
    setLoading(true);
    try {
      const res = await adminCreateBooking({
        ...form,
        test_ids: selTests.map(t => t.id),
        payment_status: 'pending',
      });
      toast.success(`Booking #${res.data.bookingNumber} created!`);
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    } finally { setLoading(false); }
  };

  const total = selTests.reduce((s, t) => s + parseFloat(t.base_price || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cb-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Create New Booking</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body cb-body">
          <div className="cb-left">
            <div className="cb-section-label">Patient & Collection</div>
            <div className="form-group">
              <label className="form-label">Client (optional)</label>
              <select className="form-control" name="client_id" value={form.client_id} onChange={h}>
                <option value="">Direct (No client)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Patient Name *</label>
                <input className="form-control" name="patient_name" value={form.patient_name} onChange={h} placeholder="Full name"/>
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-control" name="patient_phone" value={form.patient_phone} onChange={h} placeholder="Mobile"/>
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
              <div className="form-group">
                <label className="form-label">Collection Type</label>
                <select className="form-control" name="collection_type" value={form.collection_type} onChange={h}>
                  <option value="home">Home</option>
                  <option value="walkin">Walk-in</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Collection Date</label>
                <input className="form-control" type="date" name="collection_date" value={form.collection_date} onChange={h}/>
              </div>
              <div className="form-group">
                <label className="form-label">Collection Time</label>
                <select className="form-control" name="collection_time" value={form.collection_time} onChange={h}>
                  <option value="">Select time</option>
                  {['7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Patient Address</label>
              <textarea className="form-control" name="patient_address" value={form.patient_address} onChange={h} rows={2} placeholder="Address"/>
            </div>
            {form.collection_type === 'home' && (
              <div className="form-group">
                <label className="form-label">Collection Address</label>
                <textarea className="form-control" name="collection_address" value={form.collection_address} onChange={h} rows={2} placeholder="Home address for collection"/>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" name="notes" value={form.notes} onChange={h} rows={2} placeholder="Any instructions…"/>
            </div>
          </div>

          <div className="cb-right">
            <div className="cb-section-label">Select Tests</div>
            <div className="cb-test-list">
              {tests.map(t => {
                const checked = selTests.some(s => s.id === t.id);
                return (
                  <label key={t.id} className={`cb-test-item ${checked ? 'checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTest(t)} hidden/>
                    <div className="cbt-check">{checked && '✓'}</div>
                    <div className="cbt-info">
                      <div className="cbt-name">{t.name}</div>
                      <div className="cbt-meta">{t.code} · {t.category_name}</div>
                    </div>
                    <div className="cbt-price">₹{parseFloat(t.base_price).toFixed(0)}</div>
                  </label>
                );
              })}
            </div>
            <div className="cb-total">
              <span>Total ({selTests.length} test{selTests.length !== 1 ? 's' : ''})</span>
              <span>₹{total.toFixed(0)}</span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            <Plus size={14}/> {loading ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export default function AdminBookings() {
  const [bookings,       setBookings]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [editBooking,    setEditBooking]     = useState(null);
  const [reportBooking,  setReportBooking]   = useState(null);
  const [phleBoBooking,  setPhleBoBooking]   = useState(null);
  const [showCreate,     setShowCreate]      = useState(false);
  const [pushLabBooking, setPushLabBooking]   = useState(null);
  const [filters, setFilters] = useState({ search:'', status:'', payment_status:'', date_from:'', date_to:'' });

  const fetchBookings = () => {
    setLoading(true);
    getAllBookings(filters).then(r => { setBookings(r.data.bookings); setLoading(false); });
    // console.log(bookings);
  };

  useEffect(() => { fetchBookings(); }, []);
  const handleFilter = e => setFilters({ ...filters, [e.target.name]: e.target.value });

  return (
    <div className="admin-bookings">
      <div className="page-header">
        <div>
          <div className="page-title">Bookings</div>
          <div className="page-subtitle">Manage all patient bookings</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16}/> Create Booking
        </button>
      </div>

      {/* Filters */}
      <div className="card filter-bar">
        <div className="filter-row">
          <div className="search-bar" style={{ flex:2 }}>
            <Search size={16}/>
            <input className="form-control" name="search" placeholder="Search booking # or patient…" value={filters.search} onChange={handleFilter}/>
          </div>
          <select className="form-control" name="status" value={filters.status} onChange={handleFilter} style={{ flex:1 }}>
            <option value="">All Statuses</option>
            {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <select className="form-control" name="payment_status" value={filters.payment_status} onChange={handleFilter} style={{ flex:1 }}>
            <option value="">All Payments</option>
            {payOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="form-control" type="date" name="date_from" value={filters.date_from} onChange={handleFilter} style={{ flex:1 }}/>
          <input className="form-control" type="date" name="date_to"   value={filters.date_to}   onChange={handleFilter} style={{ flex:1 }}/>
          <button className="btn btn-primary" onClick={fetchBookings}><Filter size={14}/> Filter</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Booking #</th><th>Patient</th><th>Tests</th><th>Client</th>
                  <th>Amount</th><th>Collection</th><th>Phlebo</th>
                  <th>Status</th><th>Payment</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td><span style={{ fontFamily:'Space Mono,monospace', fontSize:12, fontWeight:700, color:'var(--primary)' }}>{b.booking_number}</span></td>
                    <td>
                      <div style={{ fontWeight:600, fontSize:13 }}>{b.patient_name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{b.patient_phone}</div>
                    </td>
                    <td style={{ maxWidth:160 }}>
                      <div style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.tests}</div>
                    </td>
                    <td style={{ fontSize:12 }}>{b.client_name || <span style={{ color:'var(--text-muted)' }}>Direct</span>}</td>
                    <td style={{ fontWeight:700, fontFamily:'Space Mono,monospace', fontSize:13 }}>₹{parseFloat(b.final_amount).toFixed(0)}</td>
                    <td style={{ fontSize:12 }}>
                      <div style={{ textTransform:'capitalize' }}>{b.collection_type}</div>
                      {b.collection_date && <div style={{ color:'var(--text-muted)' }}>{new Date(b.collection_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>}
                    </td>
                    <td>
                      {b.phlebo_name
                        ? <span className="badge badge-info" style={{ fontSize:11 }}>{b.phlebo_name}</span>
                        : b.collection_type === 'home'
                          ? <span style={{ fontSize:11, color:'var(--warning)' }}>Unassigned</span>
                          : <span style={{ fontSize:11, color:'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <span className={`badge ${statusColor[b.booking_status] || 'badge-muted'}`}>{b.booking_status?.replace(/_/g,' ')}</span>
                        {b.report_status === 'ready' && <span className="badge badge-success" style={{ fontSize:10 }}>📄 Reports</span>}
                      </div>
                    </td>
                    <td><span className={`badge ${payColor[b.payment_status] || 'badge-muted'}`}>{b.payment_status}</span></td>
                    <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {new Date(b.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditBooking(b)} title="Edit"><Edit2 size={12}/></button>
                        {b.collection_type === 'home' && (
                          <button className="btn btn-sm phlebo-btn" onClick={() => setPhleBoBooking(b)} title="Assign Phlebotomist">
                            <UserCheck size={12}/>
                          </button>
                        )}
                        <button className="btn btn-sm report-upload-btn" onClick={() => setReportBooking(b)} title="Reports">
                          <Upload size={12}/>
                          {b.report_status === 'ready' && <FileText size={11} style={{ color:'#2ECC71' }}/>}
                        </button>
                        <button
                          className={`btn btn-sm push-lab-btn ${b.push_status === 'pushed' ? 'pushed' : b.push_status === 'failed' ? 'failed' : ''}`}
                          onClick={() => setPushLabBooking(b)}
                          title="Push to Third-Party Lab"
                        >
                          <Send size={11}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!bookings.length && (
                  <tr><td colSpan={11} style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>No bookings found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editBooking   && <EditBookingModal    booking={editBooking}   onClose={() => setEditBooking(null)}   onSave={() => { setEditBooking(null);   fetchBookings(); }}/>}
      {reportBooking && <ReportUploadModal   booking={reportBooking} onClose={() => setReportBooking(null)} onUploaded={fetchBookings}/>}
      {phleBoBooking && <AssignPhleBoModal   booking={phleBoBooking} onClose={() => setPhleBoBooking(null)} onSave={() => { setPhleBoBooking(null); fetchBookings(); }}/>}
      {showCreate    && <CreateBookingModal                           onClose={() => setShowCreate(false)}   onSave={() => { setShowCreate(false);   fetchBookings(); }}/>}
      {pushLabBooking && <PushToLabModal     booking={pushLabBooking} onClose={() => setPushLabBooking(null)} onPushed={fetchBookings}/>}
    </div>
  );
}