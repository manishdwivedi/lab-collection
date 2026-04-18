import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRateLists, createRateList, deleteRateList } from '../../utils/api';
import { Plus, Edit2, Trash2, X, Save, ListOrdered, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

function CreateRateListModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', description: '', discount_type: 'percentage' });
  const [loading, setLoading] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.name) return toast.error('Rate list name is required');
    setLoading(true);
    try {
      const res = await createRateList(form);
      toast.success('Rate list created! Now add test prices.');
      onSave(res.data.id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Create New Rate List</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Rate List Name *</label>
            <input className="form-control" name="name" value={form.name} onChange={h} placeholder="e.g. Apollo Special Rate"/>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" name="description" value={form.description} onChange={h} rows={2} placeholder="Brief description..."/>
          </div>
          <div className="form-group">
            <label className="form-label">Discount Type</label>
            <select className="form-control" name="discount_type" value={form.discount_type} onChange={h}>
              <option value="percentage">Percentage Discount</option>
              <option value="fixed">Fixed Price Per Test</option>
            </select>
          </div>
          <div className="alert alert-info">
            After creating the rate list, you'll be taken to the detail page where you can add test-specific prices.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={14}/> {loading ? 'Creating...' : 'Create & Configure'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRateLists() {
  const [rateLists, setRateLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = () => {
    setLoading(true);
    getRateLists().then(r => { setRateLists(r.data.rateLists); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate rate list "${name}"?`)) return;
    try {
      await deleteRateList(id);
      toast.success('Rate list deactivated');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Rate Lists</div>
          <div className="page-subtitle">Create and manage pricing rate lists to assign to clients</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16}/> Create Rate List
        </button>
      </div>

      {/* Info Banner */}
      <div className="alert alert-info" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <ListOrdered size={16}/>
        <div>
          <strong>How Rate Lists Work:</strong> Rate lists define custom test prices for specific clients.
          Create a rate list, add test prices, then assign it to a client. When a booking is made via that client, the rate list prices are used automatically.
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Rate List Name</th>
                  <th>Description</th>
                  <th>Discount Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rateLists.map(rl => (
                  <tr key={rl.id}>
                    <td>
                      <Link to={`/admin/rate-lists/${rl.id}`} style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {rl.name} <ChevronRight size={13}/>
                      </Link>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 250 }}>{rl.description || '—'}</td>
                    <td>
                      <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                        {rl.discount_type === 'percentage' ? 'Percentage' : 'Fixed Price'}
                      </span>
                    </td>
                    <td>{rl.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(rl.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/admin/rate-lists/${rl.id}`} className="btn btn-outline btn-sm">
                          <Edit2 size={12}/> Configure
                        </Link>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rl.id, rl.name)}>
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rateLists.length && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                    <ListOrdered size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }}/> No rate lists created yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRateListModal
          onClose={() => setShowCreate(false)}
          onSave={(id) => { setShowCreate(false); window.location.href = `/admin/rate-lists/${id}`; }}
        />
      )}
    </div>
  );
}
