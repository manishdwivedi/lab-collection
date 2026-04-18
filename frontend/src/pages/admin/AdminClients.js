import React, { useState, useEffect } from 'react';
import { getClients, createClient, updateClient, deleteClient, getRateLists, getClientUsers, createClientUser, deleteClientUser } from '../../utils/api';
import { Plus, Edit2, Trash2, X, Save, Users, Building2, ListOrdered, Key, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { name: '', code: '', contact_person: '', email: '', phone: '', address: '', city: '', gst_number: '', credit_limit: 0, payment_terms: 30, is_active: true, rate_list_id: '', effective_from: new Date().toISOString().split('T')[0] };

function ClientModal({ client, rateLists, onClose, onSave }) {
  const [form, setForm] = useState(client
    ? { ...client, rate_list_id: client.rate_list_id || '', effective_from: client.effective_from?.split('T')[0] || new Date().toISOString().split('T')[0] }
    : emptyForm
  );
  const [loading, setLoading] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSave = async () => {
    if (!form.name || !form.code || !form.phone) return toast.error('Fill all required fields');
    setLoading(true);
    try {
      if (client?.id) { await updateClient(client.id, form); toast.success('Client updated!'); }
      else { await createClient(form); toast.success('Client created!'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{client?.id ? 'Edit Client' : 'Add New Client'}</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Building2 size={14}/> Basic Information
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input className="form-control" name="name" value={form.name} onChange={h} placeholder="e.g. Apollo Clinics Pvt Ltd"/>
            </div>
            <div className="form-group">
              <label className="form-label">Client Code *</label>
              <input className="form-control" name="code" value={form.code} onChange={h} placeholder="e.g. APOLLO01"/>
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input className="form-control" name="contact_person" value={form.contact_person} onChange={h} placeholder="Name of contact"/>
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-control" name="phone" value={form.phone} onChange={h} placeholder="Mobile number"/>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" name="email" value={form.email} onChange={h} placeholder="client@example.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-control" name="city" value={form.city} onChange={h} placeholder="City"/>
            </div>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input className="form-control" name="gst_number" value={form.gst_number} onChange={h} placeholder="GST number"/>
            </div>
            <div className="form-group">
              <label className="form-label">Credit Limit (₹)</label>
              <input className="form-control" type="number" name="credit_limit" value={form.credit_limit} onChange={h} min="0"/>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Terms (days)</label>
              <input className="form-control" type="number" name="payment_terms" value={form.payment_terms} onChange={h} min="0"/>
            </div>
            {client?.id && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 28 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" name="is_active" checked={form.is_active} onChange={h}/>
                  Active
                </label>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-control" name="address" value={form.address} onChange={h} rows={2} placeholder="Full address"/>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ListOrdered size={14}/> Rate List Assignment
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Assign Rate List</label>
                <select className="form-control" name="rate_list_id" value={form.rate_list_id} onChange={h}>
                  <option value="">No Rate List (Use Base Price)</option>
                  {rateLists.map(rl => <option key={rl.id} value={rl.id}>{rl.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Effective From</label>
                <input className="form-control" type="date" name="effective_from" value={form.effective_from} onChange={h}/>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={14}/> {loading ? 'Saving...' : 'Save Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminClients() {
  const [clients,    setClients]    = useState([]);
  const [rateLists,  setRateLists]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [portalClient, setPortalClient] = useState(null); // client obj for portal user mgmt

  const fetchData = () => {
    setLoading(true);
    Promise.all([getClients(), getRateLists()]).then(([c, r]) => {
      setClients(c.data.clients);
      setRateLists(r.data.rateLists);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate client "${name}"?`)) return;
    try {
      await deleteClient(id);
      toast.success('Client deactivated');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-subtitle">Manage corporate and hospital clients for home collection</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16}/> Add Client
        </button>
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Client Name</th>
                  <th>Contact</th>
                  <th>City</th>
                  <th>Credit Limit</th>
                  <th>Payment Terms</th>
                  <th>Rate List</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td><code style={{ fontSize: 11, background: 'var(--surface2)', padding: '3px 7px', borderRadius: 5, color: 'var(--primary)', fontWeight: 700 }}>{c.code}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.contact_person && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.contact_person}</div>}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{c.phone}</div>
                      {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{c.city || '—'}</td>
                    <td style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 13 }}>₹{parseFloat(c.credit_limit || 0).toFixed(0)}</td>
                    <td style={{ fontSize: 12 }}>{c.payment_terms || 30} days</td>
                    <td>
                      {c.rate_list_name
                        ? <span className="badge badge-info">{c.rate_list_name}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Base Price</span>
                      }
                    </td>
                    <td>{c.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(c)}><Edit2 size={12}/></button>
                        <button className="btn btn-sm" style={{ background:'#EBF5FB', border:'1.5px solid #AED6F1', color:'#1A5276' }} onClick={() => setPortalClient(c)} title="Manage Portal Users"><Key size={12}/></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id, c.name)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!clients.length && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    <Users size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }}/> No clients found
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ClientModal
          client={modal === 'create' ? null : modal}
          rateLists={rateLists}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchData(); }}
        />
      )}

      {portalClient && (
        <PortalUsersModal
          client={portalClient}
          onClose={() => setPortalClient(null)}
        />
      )}
    </div>
  );
}

/* ── Portal Users Modal ─────────────────────────────────── */
function PortalUsersModal({ client, onClose }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [newForm, setNewForm] = useState({ name:'', email:'', phone:'', password:'', is_primary:false });
  const h = e => setNewForm({ ...newForm, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const fetchUsers = () => {
    setLoading(true);
    getClientUsers(client.id).then(r => { setUsers(r.data.users); setLoading(false); });
  };
  useEffect(() => { fetchUsers(); }, [client.id]);

  const handleAdd = async () => {
    if (!newForm.name || !newForm.email || !newForm.phone) return toast.error('Name, email and phone required');
    setSaving(true);
    try {
      await createClientUser(client.id, newForm);
      toast.success('Portal user created! Default password: Client@123');
      setAdding(false);
      setNewForm({ name:'', email:'', phone:'', password:'', is_primary:false });
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (uid, name) => {
    if (!window.confirm(`Deactivate portal user "${name}"?`)) return;
    try { await deleteClientUser(uid); toast.success('Deactivated'); fetchUsers(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Portal Users</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>{client.name} — client portal logins</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom:16 }}>
            Portal users can log in at <strong>/client/login</strong> to view bookings and create new ones for this client.
          </div>

          {loading ? <div className="loading-container" style={{ padding:40 }}><div className="spinner"/></div> : (
            <>
              {users.length === 0 ? (
                <div style={{ color:'var(--text-muted)', textAlign:'center', padding:'20px 0', fontSize:14 }}>No portal users yet</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {users.map(u => (
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:'1.5px solid var(--border)', borderRadius:10, background:'white' }}>
                      <div style={{ width:36, height:36, borderRadius:8, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'var(--primary)', flexShrink:0 }}>
                        {u.name?.charAt(0)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{u.name} {u.is_primary ? <span className="badge badge-info" style={{ fontSize:10 }}>Primary</span> : ''}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{u.email} · {u.phone}</div>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id, u.name)}><Trash2 size={11}/></button>
                    </div>
                  ))}
                </div>
              )}

              {adding ? (
                <div style={{ border:'1.5px solid var(--border)', borderRadius:12, padding:16 }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:'var(--primary)' }}>Add New Portal User</div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Name *</label>
                      <input className="form-control" name="name" value={newForm.name} onChange={h} placeholder="Full name"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input className="form-control" type="email" name="email" value={newForm.email} onChange={h} placeholder="Login email"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone *</label>
                      <input className="form-control" name="phone" value={newForm.phone} onChange={h} placeholder="Mobile number"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <input className="form-control" type="password" name="password" value={newForm.password} onChange={h} placeholder="Blank = Client@123"/>
                    </div>
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, marginBottom:14 }}>
                    <input type="checkbox" name="is_primary" checked={newForm.is_primary} onChange={h}/>
                    Mark as primary contact
                  </label>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setAdding(false)}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>
                      <UserPlus size={13}/> {saving ? 'Adding…' : 'Add User'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-outline" style={{ width:'100%', justifyContent:'center' }} onClick={() => setAdding(true)}>
                  <UserPlus size={14}/> Add Portal User
                </button>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}