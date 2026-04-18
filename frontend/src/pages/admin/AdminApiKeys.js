import React, { useState, useEffect } from 'react';
import { getApiClients, createApiClient, updateApiClient, rotateApiKey, revokeApiClient, getClients } from '../../utils/api';
import { Plus, Edit2, RefreshCw, Trash2, X, Save, Key, Copy, Check, Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminApiKeys.css';

const ALL_PERMISSIONS = [
  { id: 'bookings:read',  label: 'Read Bookings',   desc: 'GET booking details and status' },
  { id: 'bookings:write', label: 'Create Bookings',  desc: 'POST new bookings via API' },
  { id: 'reports:write',  label: 'Upload Reports',   desc: 'POST reports for a booking' },
  { id: '*',              label: 'Full Access',       desc: 'All current and future permissions' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="btn btn-outline btn-sm" onClick={handleCopy} style={{ gap:4 }}>
      {copied ? <Check size={12} color="var(--success)"/> : <Copy size={12}/>}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function KeyRevealBox({ apiKey }) {
  const [show, setShow] = useState(false);
  return (
    <div className="key-reveal-box">
      <div className="key-reveal-alert">
        <Shield size={18} color="#E67E22"/>
        <strong>Copy this key now — it will never be shown again.</strong>
      </div>
      <div className="key-reveal-row">
        <code className="key-reveal-code">
          {show ? apiKey : '••••••••••••••••••••••••••••••••••••••'}
        </code>
        <button className="btn btn-outline btn-sm" onClick={() => setShow(!show)}>
          {show ? <EyeOff size={12}/> : <Eye size={12}/>}
        </button>
        <CopyButton text={apiKey}/>
      </div>
    </div>
  );
}

function CreateKeyModal({ clients, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', description: '', client_id: '', permissions: [], rate_limit: 100, expires_at: '',
  });
  const [loading,  setLoading]  = useState(false);
  const [newKey,   setNewKey]   = useState(null); // shown after creation
  const h = e => setForm({ ...form, [e.target.name]: e.target.value });

  const togglePerm = (p) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(p)
        ? prev.permissions.filter(x => x !== p)
        : [...prev.permissions, p],
    }));
  };

  const handleCreate = async () => {
    if (!form.name) return toast.error('Name is required');
    if (!form.permissions.length) return toast.error('Select at least one permission');
    setLoading(true);
    try {
      const res = await createApiClient(form);
      setNewKey(res.data.apiKey);
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
      setLoading(false);
    }
  };

  if (newKey) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth:520 }}>
          <div className="modal-header">
            <div className="modal-title">API Key Created!</div>
          </div>
          <div className="modal-body">
            <KeyRevealBox apiKey={newKey}/>
            <div className="alert alert-info" style={{ marginTop:16 }}>
              Store this key securely. Use it in the <code>X-API-Key</code> header of every API request.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Create API Key</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-control" name="name" value={form.name} onChange={h} placeholder="e.g. Apollo LIMS Integration"/>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" name="description" value={form.description} onChange={h} rows={2} placeholder="What this key is used for…"/>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Link to Client (optional)</label>
              <select className="form-control" name="client_id" value={form.client_id} onChange={h}>
                <option value="">No client link</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Rate Limit (req/min)</label>
              <input className="form-control" type="number" name="rate_limit" value={form.rate_limit} onChange={h} min="1"/>
            </div>
            <div className="form-group">
              <label className="form-label">Expires At (optional)</label>
              <input className="form-control" type="datetime-local" name="expires_at" value={form.expires_at} onChange={h}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Permissions *</label>
            <div className="perm-list">
              {ALL_PERMISSIONS.map(p => (
                <label key={p.id} className={`perm-item ${form.permissions.includes(p.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} hidden/>
                  <div className="perm-check">{form.permissions.includes(p.id) && '✓'}</div>
                  <div>
                    <div className="perm-label">{p.label}</div>
                    <div className="perm-desc">{p.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            <Key size={14}/> {loading ? 'Generating…' : 'Generate API Key'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminApiKeys() {
  const [apiClients, setApiClients] = useState([]);
  const [clients,    setClients]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [rotatedKey, setRotatedKey] = useState(null); // { key, clientName }

  const fetchData = () => {
    setLoading(true);
    Promise.all([getApiClients(), getClients()]).then(([a, c]) => {
      setApiClients(a.data.apiClients);
      setClients(c.data.clients);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const handleRotate = async (client) => {
    if (!window.confirm(`Rotate API key for "${client.name}"? The current key will stop working immediately.`)) return;
    try {
      const res = await rotateApiKey(client.id);
      setRotatedKey({ key: res.data.apiKey, clientName: client.name });
      fetchData();
    } catch { toast.error('Rotation failed'); }
  };

  const handleRevoke = async (client) => {
    if (!window.confirm(`Revoke API key for "${client.name}"? This cannot be undone.`)) return;
    try { await revokeApiClient(client.id); toast.success('API key revoked'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">API Keys</div>
          <div className="page-subtitle">Manage external system access to the LabCollect API</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16}/> Create API Key
        </button>
      </div>

      {/* Docs hint */}
      <div className="api-docs-card">
        <div className="adc-left">
          <Key size={20}/>
          <div>
            <div className="adc-title">External API Reference</div>
            <div className="adc-sub">All requests must include the <code>X-API-Key</code> header</div>
          </div>
        </div>
        <div className="adc-endpoints">
          {[
            { method:'GET',  path:'/api/v1/tests',                                   perm:'bookings:read'  },
            { method:'POST', path:'/api/v1/bookings',                                perm:'bookings:write' },
            { method:'GET',  path:'/api/v1/bookings/:booking_number',                perm:'bookings:read'  },
            { method:'POST', path:'/api/v1/bookings/:booking_number/reports',        perm:'reports:write'  },
          ].map(ep => (
            <div key={ep.path} className="adc-endpoint">
              <span className={`http-method ${ep.method.toLowerCase()}`}>{ep.method}</span>
              <code className="ep-path">{ep.path}</code>
              <span className="ep-perm">{ep.perm}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Key Prefix</th><th>Client</th>
                  <th>Permissions</th><th>Rate Limit</th><th>Last Used</th>
                  <th>Expires</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiClients.map(ac => {
                  const perms = typeof ac.permissions === 'string' ? JSON.parse(ac.permissions) : (ac.permissions || []);
                  return (
                    <tr key={ac.id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{ac.name}</div>
                        {ac.description && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{ac.description}</div>}
                      </td>
                      <td><code style={{ fontSize:12, background:'var(--surface2)', padding:'3px 8px', borderRadius:5 }}>{ac.api_key_prefix}…</code></td>
                      <td style={{ fontSize:12 }}>{ac.client_name || <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                      <td>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {perms.map(p => (
                            <span key={p} className="badge badge-info" style={{ fontSize:10 }}>{p}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize:12 }}>{ac.rate_limit}/min</td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {ac.last_used_at
                          ? new Date(ac.last_used_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
                          : 'Never'}
                      </td>
                      <td style={{ fontSize:12, color: ac.expires_at && new Date(ac.expires_at) < new Date() ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {ac.expires_at ? new Date(ac.expires_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'No expiry'}
                      </td>
                      <td>{ac.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Revoked</span>}</td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => handleRotate(ac)} title="Rotate Key"><RefreshCw size={12}/></button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(ac)} title="Revoke Key"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!apiClients.length && (
                  <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--text-muted)', padding:48 }}>
                    <Key size={32} style={{ opacity:.3, display:'block', margin:'0 auto 10px' }}/>
                    No API keys yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateKeyModal
          clients={clients}
          onClose={() => { setShowCreate(false); fetchData(); }}
          onSave={() => {}}
        />
      )}

      {rotatedKey && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <div className="modal-title">New Key for {rotatedKey.clientName}</div>
            </div>
            <div className="modal-body">
              <KeyRevealBox apiKey={rotatedKey.key}/>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setRotatedKey(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}