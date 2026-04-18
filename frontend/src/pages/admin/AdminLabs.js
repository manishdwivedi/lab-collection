import React, { useState, useEffect } from 'react';
import { getLabs, createLab, updateLab, deleteLab } from '../../utils/api';
import { Plus, Edit2, Trash2, X, Save, Globe, CheckCircle, XCircle, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminLabs.css';

const AUTH_TYPES = ['api_key', 'bearer', 'basic', 'oauth2'];

const emptyForm = {
  name: '', code: '', api_base_url: '', auth_type: 'api_key',
  auth_key_name: 'X-API-Key', auth_key_value: '',
  booking_endpoint: '/bookings', report_webhook_secret: '',
  test_code_mapping: '', extra_headers: '',
  timeout_seconds: 30, retry_attempts: 3, is_active: true, notes: '',
};

function LabModal({ lab, onClose, onSave }) {
  const isEdit = !!lab?.id;
  const [form, setForm] = useState(isEdit ? {
    ...lab,
    test_code_mapping: lab.test_code_mapping
      ? (typeof lab.test_code_mapping === 'string' ? lab.test_code_mapping : JSON.stringify(lab.test_code_mapping, null, 2))
      : '',
    extra_headers: lab.extra_headers
      ? (typeof lab.extra_headers === 'string' ? lab.extra_headers : JSON.stringify(lab.extra_headers, null, 2))
      : '',
  } : emptyForm);
  const [loading, setLoading] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSave = async () => {
    if (!form.name || !form.code || !form.api_base_url)
      return toast.error('Name, code, and API base URL are required');

    // Validate JSON fields
    let testMapping = form.test_code_mapping || null;
    let extraHeaders = form.extra_headers || null;
    try { if (testMapping)  JSON.parse(testMapping); }
    catch { return toast.error('Test Code Mapping must be valid JSON'); }
    try { if (extraHeaders) JSON.parse(extraHeaders); }
    catch { return toast.error('Extra Headers must be valid JSON'); }

    setLoading(true);
    try {
      const payload = {
        ...form,
        test_code_mapping: testMapping,
        extra_headers: extraHeaders,
      };
      if (isEdit) { await updateLab(lab.id, payload); toast.success('Lab updated!'); }
      else        { await createLab(payload);          toast.success('Lab created!'); }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Lab' : 'Add Third-Party Lab'}</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Lab Name *</label>
              <input className="form-control" name="name" value={form.name} onChange={h} placeholder="e.g. Thyrocare Technologies"/>
            </div>
            <div className="form-group">
              <label className="form-label">Lab Code *</label>
              <input className="form-control" name="code" value={form.code} onChange={h} placeholder="e.g. THYROCARE (uppercase)"/>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">API Base URL *</label>
              <input className="form-control" name="api_base_url" value={form.api_base_url} onChange={h} placeholder="https://api.thyrocare.com/v1"/>
            </div>
            <div className="form-group">
              <label className="form-label">Booking Endpoint</label>
              <input className="form-control" name="booking_endpoint" value={form.booking_endpoint} onChange={h} placeholder="/bookings or /order/create"/>
            </div>
            <div className="form-group">
              <label className="form-label">Authentication Type</label>
              <select className="form-control" name="auth_type" value={form.auth_type} onChange={h}>
                {AUTH_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Auth Header/Param Name</label>
              <input className="form-control" name="auth_key_name" value={form.auth_key_name} onChange={h} placeholder="X-API-Key or Authorization"/>
            </div>
            <div className="form-group">
              <label className="form-label">Auth Key / Token</label>
              <input className="form-control" type="password" name="auth_key_value" value={form.auth_key_value} onChange={h} placeholder="Your API key or token"/>
            </div>
            <div className="form-group">
              <label className="form-label">Timeout (seconds)</label>
              <input className="form-control" type="number" name="timeout_seconds" value={form.timeout_seconds} onChange={h} min="5" max="120"/>
            </div>
            <div className="form-group">
              <label className="form-label">Retry Attempts</label>
              <input className="form-control" type="number" name="retry_attempts" value={form.retry_attempts} onChange={h} min="0" max="5"/>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Test Code Mapping <span style={{ fontWeight:400, color:'var(--text-muted)' }}>(JSON: our code → their code)</span>
            </label>
            <textarea className="form-control code-input" name="test_code_mapping" value={form.test_code_mapping} onChange={h} rows={4}
              placeholder={'{\n  "CBC001": "THYRO_CBC",\n  "TSH001": "T3T4TSH"\n}'}/>
          </div>
          <div className="form-group">
            <label className="form-label">Extra Headers <span style={{ fontWeight:400, color:'var(--text-muted)' }}>(JSON, optional)</span></label>
            <textarea className="form-control code-input" name="extra_headers" value={form.extra_headers} onChange={h} rows={3}
              placeholder={'{\n  "X-Partner-Id": "LC123"\n}'}/>
          </div>
          <div className="form-group">
            <label className="form-label">Webhook Secret (for incoming result callbacks)</label>
            <input className="form-control" name="report_webhook_secret" value={form.report_webhook_secret} onChange={h} placeholder="HMAC secret for webhook verification"/>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" name="notes" value={form.notes} onChange={h} rows={2} placeholder="Any notes about this lab integration…"/>
          </div>
          {isEdit && (
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={h}/>
              Active
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={14}/> {loading ? 'Saving…' : 'Save Lab'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLabs() {
  const [labs,    setLabs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);

  const fetchData = () => {
    setLoading(true);
    getLabs().then(r => { setLabs(r.data.labs); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (lab) => {
    if (!window.confirm(`Deactivate lab "${lab.name}"?`)) return;
    try { await deleteLab(lab.id); toast.success('Deactivated'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Third-Party Labs</div>
          <div className="page-subtitle">Configure external labs to push bookings to</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16}/> Add Lab
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom:20 }}>
        <Globe size={15}/>
        Configure external diagnostic labs here. Once added, you can push bookings directly from the Bookings page. Each lab has its own authentication, endpoint, and test code mappings.
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Lab Name</th><th>Base URL</th><th>Auth Type</th>
                  <th>Endpoint</th><th>Timeout</th><th>Total Pushes</th><th>Today Failures</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {labs.map(lab => (
                  <tr key={lab.id}>
                    <td><code style={{ fontSize:11, background:'var(--surface2)', padding:'3px 7px', borderRadius:5, color:'var(--primary)', fontWeight:700 }}>{lab.code}</code></td>
                    <td style={{ fontWeight:600 }}>{lab.name}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lab.api_base_url}</td>
                    <td><span className="badge badge-info" style={{ textTransform:'uppercase' }}>{lab.auth_type}</span></td>
                    <td style={{ fontSize:12 }}>{lab.booking_endpoint}</td>
                    <td style={{ fontSize:12 }}>{lab.timeout_seconds}s</td>
                    <td style={{ fontWeight:700, fontFamily:'Space Mono,monospace', color:'var(--accent)' }}>{lab.total_pushes || 0}</td>
                    <td>
                      {(lab.today_failures || 0) > 0
                        ? <span style={{ fontWeight:700, color:'var(--danger)' }}>{lab.today_failures}</span>
                        : <span style={{ color:'var(--text-muted)', fontSize:12 }}>0</span>
                      }
                    </td>
                    <td>
                      {lab.is_active
                        ? <span className="badge badge-success"><CheckCircle size={10}/> Active</span>
                        : <span className="badge badge-muted"><XCircle size={10}/> Inactive</span>
                      }
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(lab)}><Edit2 size={12}/></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lab)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!labs.length && (
                  <tr><td colSpan={10} style={{ textAlign:'center', color:'var(--text-muted)', padding:48 }}>
                    <FlaskConical size={32} style={{ opacity:.3, display:'block', margin:'0 auto 10px' }}/>
                    No labs configured yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <LabModal
          lab={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}