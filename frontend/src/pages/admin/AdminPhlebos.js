import React, { useState, useEffect } from 'react';
import { getPhlebos, createPhlebo, updatePhlebo, deletePhlebo } from '../../utils/api';
import { Plus, Edit2, Trash2, X, Save, User, Phone, Calendar, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminPhlebos.css';

const emptyForm = {
  name: '', email: '', phone: '', password: '',
  employee_code: '', alternate_phone: '', address: '', city: 'Ludhiana',
  experience_years: '', qualification: '', joined_date: '', notes: '',
  is_available: true, is_active: true,
};

function PhleBoModal({ phlebo, onClose, onSave }) {
  const isEdit = !!phlebo?.id;
  const [form, setForm] = useState(isEdit ? {
    ...phlebo,
    password: '',
    joined_date: phlebo.joined_date?.split('T')[0] || '',
  } : emptyForm);
  const [loading, setLoading] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.employee_code)
      return toast.error('Name, phone and employee code are required');
    if (!isEdit && !form.email) return toast.error('Email is required');
    setLoading(true);
    try {
      if (isEdit) {
        await updatePhlebo(phlebo.id, form);
        toast.success('Phlebotomist updated!');
      } else {
        await createPhlebo(form);
        toast.success('Phlebotomist created! Default password: Phlebo@123');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Phlebotomist' : 'Add Phlebotomist'}</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="form-section-label"><User size={13}/> Personal Details</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" name="name" value={form.name} onChange={h} placeholder="Full name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Employee Code *</label>
              <input className="form-control" name="employee_code" value={form.employee_code} onChange={h} placeholder="e.g. PHB001"/>
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-control" type="email" name="email" value={form.email} onChange={h} placeholder="Login email"/>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Mobile Phone *</label>
              <input className="form-control" name="phone" value={form.phone} onChange={h} placeholder="Primary contact"/>
            </div>
            <div className="form-group">
              <label className="form-label">Alternate Phone</label>
              <input className="form-control" name="alternate_phone" value={form.alternate_phone} onChange={h} placeholder="Optional"/>
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-control" name="city" value={form.city} onChange={h} placeholder="City"/>
            </div>
            <div className="form-group">
              <label className="form-label">Experience (years)</label>
              <input className="form-control" type="number" name="experience_years" value={form.experience_years} onChange={h} min="0" placeholder="Years"/>
            </div>
            <div className="form-group">
              <label className="form-label">Qualification</label>
              <input className="form-control" name="qualification" value={form.qualification} onChange={h} placeholder="e.g. DMLT, B.Sc MLT"/>
            </div>
            <div className="form-group">
              <label className="form-label">Joining Date</label>
              <input className="form-control" type="date" name="joined_date" value={form.joined_date} onChange={h}/>
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-control" type="password" name="password" value={form.password} onChange={h} placeholder="Leave blank for Phlebo@123"/>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-control" name="address" value={form.address} onChange={h} rows={2} placeholder="Full residential address"/>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" name="notes" value={form.notes} onChange={h} rows={2} placeholder="Any special notes..."/>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" name="is_available" checked={form.is_available} onChange={h}/>
              Available for Assignments
            </label>
            {isEdit && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={h}/>
                Active
              </label>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={14}/> {loading ? 'Saving…' : 'Save Phlebotomist'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPhlebos() {
  const [phlebos, setPhlebos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const fetchData = () => {
    setLoading(true);
    getPhlebos().then(r => { setPhlebos(r.data.phlebos); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (p) => {
    if (!window.confirm(`Deactivate "${p.name}"?`)) return;
    try { await deletePhlebo(p.id); toast.success('Deactivated'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Phlebotomists</div>
          <div className="page-subtitle">Manage home-collection staff and assignments</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16}/> Add Phlebotomist
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Staff',    val: phlebos.length,                                      color: '#3498DB' },
          { label: 'Available Now',  val: phlebos.filter(p => p.is_available).length,          color: '#2ECC71' },
          { label: "Today's Jobs",   val: phlebos.reduce((s, p) => s + (p.today_assignments || 0), 0), color: '#E67E22' },
          { label: 'Pending Tasks',  val: phlebos.reduce((s, p) => s + (p.pending_assignments || 0), 0), color: '#9B59B6' },
        ].map((c, i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': c.color }}>
            <div className="stat-icon" style={{ background: c.color + '20' }}>
              <User size={20} color={c.color}/>
            </div>
            <div className="stat-value" style={{ color: c.color }}>{c.val}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>City</th>
                  <th>Qualification</th>
                  <th>Experience</th>
                  <th>Today</th>
                  <th>Pending</th>
                  <th>Availability</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {phlebos.map(p => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: 11, background: 'var(--surface2)', padding: '3px 7px', borderRadius: 5, color: 'var(--primary)', fontWeight: 700 }}>{p.employee_code}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{p.phone}</div>
                      {p.alternate_phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.alternate_phone}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{p.city || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.qualification || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.experience_years ? `${p.experience_years} yr${p.experience_years !== 1 ? 's' : ''}` : '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{p.today_assignments || 0}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: p.pending_assignments > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{p.pending_assignments || 0}</td>
                    <td>
                      {p.is_available
                        ? <span className="badge badge-success"><CheckCircle size={10}/> Available</span>
                        : <span className="badge badge-muted"><XCircle size={10}/> Unavailable</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(p)}><Edit2 size={12}/></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!phlebos.length && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                    No phlebotomists added yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <PhleBoModal
          phlebo={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}