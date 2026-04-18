import React, { useState, useEffect } from 'react';
import { getTests, getCategories, createTest, updateTest, deleteTest } from '../../utils/api';
import { Plus, Edit2, Trash2, X, Save, Search, TestTube } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { category_id: '', name: '', code: '', description: '', sample_type: '', report_time: '', fasting_required: false, base_price: '', is_active: true };

function TestModal({ test, categories, onClose, onSave }) {
  const [form, setForm] = useState(test || emptyForm);
  const [loading, setLoading] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSave = async () => {
    if (!form.name || !form.code || !form.base_price) return toast.error('Fill all required fields');
    setLoading(true);
    try {
      if (test?.id) {
        await updateTest(test.id, form);
        toast.success('Test updated!');
      } else {
        await createTest(form);
        toast.success('Test created!');
      }
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{test?.id ? 'Edit Test' : 'Add New Test'}</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Test Name *</label>
              <input className="form-control" name="name" value={form.name} onChange={h} placeholder="e.g. Complete Blood Count"/>
            </div>
            <div className="form-group">
              <label className="form-label">Test Code *</label>
              <input className="form-control" name="code" value={form.code} onChange={h} placeholder="e.g. CBC001"/>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" name="category_id" value={form.category_id} onChange={h}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Base Price (₹) *</label>
              <input className="form-control" name="base_price" type="number" value={form.base_price} onChange={h} placeholder="0.00" min="0" step="0.01"/>
            </div>
            <div className="form-group">
              <label className="form-label">Sample Type</label>
              <input className="form-control" name="sample_type" value={form.sample_type} onChange={h} placeholder="e.g. Blood (EDTA)"/>
            </div>
            <div className="form-group">
              <label className="form-label">Report Time</label>
              <input className="form-control" name="report_time" value={form.report_time} onChange={h} placeholder="e.g. 6-8 hours"/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" name="description" value={form.description} onChange={h} rows={2} placeholder="Brief description of the test"/>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" name="fasting_required" checked={form.fasting_required} onChange={h}/>
              Fasting Required
            </label>
            {test?.id && (
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
            <Save size={14}/> {loading ? 'Saving...' : 'Save Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminTests() {
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | testObj
  const [search, setSearch] = useState('');
  const [selCategory, setSelCategory] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getTests({ search, category_id: selCategory }),
      getCategories()
    ]).then(([t, c]) => {
      setTests(t.data.tests);
      setCategories(c.data.categories);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate test "${name}"?`)) return;
    try {
      await deleteTest(id);
      toast.success('Test deactivated');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tests & Services</div>
          <div className="page-subtitle">Manage your diagnostic test catalog</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16}/> Add Test
        </button>
      </div>

      <div className="card filter-bar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 2, minWidth: 200 }}>
            <Search size={16}/>
            <input className="form-control" placeholder="Search tests..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select className="form-control" style={{ flex: 1, minWidth: 160 }} value={selCategory} onChange={e => setSelCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={fetchData}>Search</button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Test Name</th>
                  <th>Category</th>
                  <th>Sample</th>
                  <th>Report Time</th>
                  <th>Base Price</th>
                  <th>Fasting</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map(t => (
                  <tr key={t.id}>
                    <td><code style={{ fontSize: 11, background: 'var(--surface2)', padding: '3px 7px', borderRadius: 5, color: 'var(--accent)', fontWeight: 700 }}>{t.code}</code></td>
                    <td style={{ fontWeight: 600, maxWidth: 200 }}>{t.name}</td>
                    <td style={{ fontSize: 12 }}>{t.category_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{t.sample_type || '—'}</td>
                    <td style={{ fontSize: 12 }}>{t.report_time || '—'}</td>
                    <td style={{ fontWeight: 700, fontFamily: 'Space Mono, monospace' }}>₹{parseFloat(t.base_price).toFixed(0)}</td>
                    <td>{t.fasting_required ? <span className="badge badge-warning">Yes</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No</span>}</td>
                    <td>{t.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(t)}>
                          <Edit2 size={12}/>
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.name)}>
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!tests.length && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    <TestTube size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }}/> No tests found
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <TestModal
          test={modal === 'create' ? null : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}
