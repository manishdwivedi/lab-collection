import React, { useState, useEffect, useCallback } from 'react';
import {
  getTests, getCategories, createTest, updateTest,
  deleteTest, getComposition
} from '../../utils/api';
import {
  Plus, Edit2, Trash2, X, Save, Search, TestTube,
  Layers, Package, ChevronDown, ChevronUp, GripVertical,
  CheckCircle, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminTests.css';

/* ── Type config ──────────────────────────────────────────── */
const TYPE_CONFIG = {
  test:    { label: 'Test',    icon: TestTube, color: '#3498DB', bg: '#EBF5FB', desc: 'A single diagnostic test' },
  profile: { label: 'Profile', icon: Layers,   color: '#9B59B6', bg: '#F5EEF8', desc: 'A named group of tests' },
  package: { label: 'Package', icon: Package,  color: '#E67E22', bg: '#FEF9E7', desc: 'Tests, profiles, or other packages bundled together' },
};

/* ── Type badge ───────────────────────────────────────────── */
function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.test;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, padding: '2px 8px',
      borderRadius: 100,
    }}>
      <cfg.icon size={10}/>
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Child Picker — for profiles and packages
   Shows searchable list of available children.
   Profiles can pick: tests only
   Packages can pick: tests + profiles + packages
   ─────────────────────────────────────────────────────────── */
function ChildPicker({ parentType, pickableTests,allTests, selected, onChange }) {
  // const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState();
  const search = async (q) => {
    const res = await getTests({ search: q, page,limit: 20 });
    setResults(res.data.tests);
    setPage(res.data.page);
  };

  const allowed = results.filter(t => {
    if (t.type === 'test') return true;
    if (parentType === 'package') return t.type === 'profile' || t.type === 'package';
    return false; // profiles can only contain tests
  });

  const filtered = allowed.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (id) => selected.includes(id);

  const toggle = (id) => {
    onChange(isSelected(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const selectedItems = allTests.filter(t => selected.includes(t.id));
  const total = selectedItems.reduce((s, t) => s + parseFloat(t.base_price || 0), 0);
  // console.log(selectedItems);
  return (
    <div className="child-picker">
      <div className="cp-layout">
        {/* Available */}
        <div className="cp-available">
          <div className="cp-section-label">
            Available {parentType === 'profile' ? 'Tests' : 'Tests / Profiles / Packages'}
          </div>
          <div className="search-bar" style={{ marginBottom: 8 }}>
            <Search size={13}/>
            <input className="form-control" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or code…"/>
          </div>
          <div className="cp-list">
            {filtered.length === 0
              ? <div className="cp-empty">No items match</div>
              : filtered.map(t => (
                <label key={t.id} className={`cp-item ${isSelected(t.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={isSelected(t.id)} onChange={() => toggle(t.id)} hidden/>
                  <div className={`cp-check ${isSelected(t.id) ? 'checked' : ''}`}>
                    {isSelected(t.id) && <CheckCircle size={12}/>}
                  </div>
                  <div className="cp-item-info">
                    <div className="cp-item-name">{t.name}</div>
                    <div className="cp-item-meta">
                      <TypeBadge type={t.type}/>
                      <span>{t.code}</span>
                      <span>₹{parseFloat(t.base_price).toFixed(0)}</span>
                    </div>
                  </div>
                </label>
              ))
            }
          </div>
        </div>

        {/* Selected */}
        <div className="cp-selected">
          <div className="cp-section-label">
            Included ({selected.length})
          </div>
          <div className="cp-list">
            {selected.length === 0
              ? <div className="cp-empty">None selected yet</div>
              : selectedItems.map((t, i) => (
                <div key={t.id} className="cp-selected-item">
                  <div className="cp-si-order">{i + 1}</div>
                  <div className="cp-si-info">
                    <div className="cp-si-name">{t.name}</div>
                    <div className="cp-si-meta"><TypeBadge type={t.type}/> {t.code}</div>
                  </div>
                  <div className="cp-si-price">₹{parseFloat(t.base_price).toFixed(0)}</div>
                  <button className="cp-remove" onClick={() => toggle(t.id)}>×</button>
                </div>
              ))
            }
          </div>
          {selected.length > 0 && (
            <div className="cp-total">
              <span>Sum of children</span>
              <span>₹{total.toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Test / Profile / Package Create-Edit Modal
   ─────────────────────────────────────────────────────────── */
const emptyForm = {
  type: 'test', category_id: '', name: '', code: '',
  description: '', sample_type: '', report_time: '',
  fasting_required: false, base_price: '', is_active: true,
};

function TestModal({ item, categories, allTests, forcedType, onClose, onSave }) {
  const isEdit = !!item?.id;
  const [form, setForm]       = useState(item || { ...emptyForm, type: forcedType || 'test' });
  const [children, setChildren] = useState([]);
  // const [subChild,setSubChild] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(false);

  const h = e => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  // Load existing composition when editing
  useEffect(() => {
    if (isEdit && item.type !== 'test') {
      setLoadingChildren(true);
      getComposition(item.id)
        .then(r => setChildren(r.data.children.map(c => c.id
        )))
        .finally(() => setLoadingChildren(false));
    }
  }, [item?.id]);

  const handleSave = async () => {
    if (!form.name?.trim()) return toast.error('Name is required');
    if (!form.code?.trim()) return toast.error('Code is required');
    if (!form.base_price && form.base_price !== 0) return toast.error('Price is required');
    if (form.type !== 'test' && children.length === 0)
      return toast.error(`A ${form.type} must contain at least one item`);

    setLoading(true);
    try {
      const payload = { ...form, children: form.type !== 'test' ? children : undefined };
      if (isEdit) {
        await updateTest(item.id, payload);
        toast.success(`${TYPE_CONFIG[form.type].label} updated!`);
      } else {
        await createTest(payload);
        toast.success(`${TYPE_CONFIG[form.type].label} created!`);
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const cfg = TYPE_CONFIG[form.type] || TYPE_CONFIG.test;

  // Determine which tests can be children (exclude self

  const pickableTests = allTests.filter(t => {
    // console.log(t.id)
    if (t.id === item?.id) return false;
    if (children.includes(t.id)) return false;

    // prevent selecting parent inside its own descendants (if loaded)
    const childIds = t?.childrens || [];
    
    if (typeof childIds === 'string') {
        if (childIds?.split(",").includes(String(item.id))) return false;
    }

    return true;
  });
  // console.log(allTests);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal test-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <cfg.icon size={18} color={cfg.color}/>
            </div>
            <div>
              <div className="modal-title">
                {isEdit ? `Edit ${cfg.label}` : `Add New ${cfg.label}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cfg.desc}</div>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>

        <div className="modal-body">
          {/* Type selector — only show when creating */}
          {!isEdit && !forcedType && (
            <div className="form-group">
              <label className="form-label">Type *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {Object.entries(TYPE_CONFIG).map(([t, c]) => (
                  <label key={t} style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', border: `2px solid ${form.type === t ? c.color : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', background: form.type === t ? c.bg : 'white',
                    transition: 'all .15s',
                  }}>
                    <input type="radio" name="type" value={t} checked={form.type === t} onChange={h} hidden/>
                    <c.icon size={16} color={c.color}/>
                    <span style={{ fontWeight: 600, fontSize: 13, color: c.color }}>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Core fields */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-control" name="name" value={form.name} onChange={h}
                placeholder={`e.g. ${form.type === 'test' ? 'Complete Blood Count' : form.type === 'profile' ? 'Thyroid Profile' : 'Annual Health Checkup'}`}/>
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-control" name="code" value={form.code} onChange={h}
                placeholder="e.g. CBC001" style={{ textTransform: 'uppercase' }}/>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" name="category_id" value={form.category_id} onChange={h}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Price (₹) *</label>
              <input className="form-control" name="base_price" type="number" value={form.base_price}
                onChange={h} placeholder="0.00" min="0" step="0.01"/>
            </div>
            {form.type === 'test' && (
              <>
                <div className="form-group">
                  <label className="form-label">Sample Type</label>
                  <input className="form-control" name="sample_type" value={form.sample_type} onChange={h}
                    placeholder="e.g. Blood (EDTA)"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Report Time</label>
                  <input className="form-control" name="report_time" value={form.report_time} onChange={h}
                    placeholder="e.g. 6-8 hours"/>
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" name="description" value={form.description} onChange={h}
              rows={2} placeholder="Brief description…"/>
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" name="fasting_required" checked={form.fasting_required} onChange={h}/>
              Fasting Required
            </label>
            {isEdit && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={h}/>
                Active
              </label>
            )}
          </div>

          {/* Composition picker for profile / package */}
          {form.type !== 'test' && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <cfg.icon size={15} color={cfg.color}/>
                <span style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>
                  {cfg.label} Contents
                </span>
                <div className="alert alert-info" style={{ padding: '4px 10px', fontSize: 12, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Info size={12}/>
                  {form.type === 'profile'
                    ? 'Profiles can contain tests only'
                    : 'Packages can contain tests, profiles, or other packages'}
                </div>
              </div>
              {loadingChildren
                ? <div className="loading-container" style={{ padding: 32 }}><div className="spinner"/></div>
                : <ChildPicker
                    parentType={form.type}
                    pickableTests={pickableTests}
                    allTests={allTests}
                    selected={children}
                    onChange={setChildren}
                  />
              }
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={14}/> {loading ? 'Saving…' : `Save ${cfg.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Composition expander row
   ─────────────────────────────────────────────────────────── */
function CompositionRow({ item }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    if (!loaded) {
      const r = await getComposition(item.id);
      setChildren(r.data.children);
      setLoaded(true);
    }
    setOpen(o => !o);
  };

  return (
    <>
      <tr>
        <td>
          <code style={{ fontSize: 11, background: 'var(--surface2)', padding: '3px 7px', borderRadius: 5, color: 'var(--accent)', fontWeight: 700 }}>
            {item.code}
          </code>
        </td>
        <td>
          <div style={{ fontWeight: 600 }}>{item.name}</div>
        </td>
        <td style={{ fontSize: 12 }}>{item.category_name || '—'}</td>
        <td><TypeBadge type={item.type}/></td>
        <td>{item.sample_type}</td>
        <td style={{ fontSize: 12 }}>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
            onClick={load}
          >
            {open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            {loaded ? `${children.length} item${children.length !== 1 ? 's' : ''}` : 'Show items'}
          </button>
        </td>
        <td style={{ fontWeight: 700, fontFamily: 'Space Mono,monospace' }}>
          ₹{parseFloat(item.base_price).toFixed(0)}
        </td>
        <td>
          {item.fasting_required
            ? <span className="badge badge-warning" style={{ fontSize: 10 }}>Yes</span>
            : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No</span>}
        </td>
        <td>
          {item.is_active
            ? <span className="badge badge-success">Active</span>
            : <span className="badge badge-muted">Inactive</span>}
        </td>
        <td>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-outline btn-sm" onClick={item._onEdit}><Edit2 size={12}/></button>
            <button className="btn btn-danger btn-sm"  onClick={item._onDelete}><Trash2 size={12}/></button>
          </div>
        </td>
      </tr>
      {open && children.map(c => (
        <tr key={c.id} className="composition-child-row">
          <td/>
          <td colSpan={4}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 20, fontSize: 13 }}>
              <div style={{ width: 1, height: 20, background: 'var(--border)', marginRight: 8 }}/>
              <TypeBadge type={c.type}/>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <code style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4 }}>{c.code}</code>
            </div>
          </td>
          <td style={{ fontWeight: 700, fontFamily: 'Space Mono,monospace', fontSize: 13 }}>
            ₹{parseFloat(c.base_price).toFixed(0)}
          </td>
          <td colSpan={3}/>
        </tr>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main AdminTests component
   ─────────────────────────────────────────────────────────── */
export default function AdminTests() {
  const [allTests,    setAllTests]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('test');   // 'test' | 'profile' | 'package'
  const [modal,       setModal]       = useState(null);     // null | 'create' | itemObj
  const [search,      setSearch]      = useState('');
  const [selCat,      setSelCat]      = useState('');
  const [page,      setPage]      = useState();
  const [totalPages,      setTotalPages]      = useState();

  const promiseCall = (tab,page) => {
    // console.log(page);
    Promise.all([getTests({ search, category_id: selCat , page, type:tab}), getCategories()])
      .then(([t, c]) => { setAllTests(t.data.tests); setCategories(c.data.categories); setPage(t.data.pagination.page); setTotalPages(t.data.pagination.pages);})
      .finally(() => setLoading(false));
  }
  const fetchData = useCallback(() => {
    setLoading(true);
    promiseCall(activeTab,page);
  }, [search, selCat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate "${name}"?`)) return;
    try { await deleteTest(id); toast.success('Deactivated'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const handleTabChange = async (tab) => {
    // console.log(tab);
    setActiveTab(tab);
    //  console.log(activeTab);
    promiseCall(tab,page);
  }
  
  const handlePageChange = async (pageCount) => {
    // console.log(pageCount);
    setPage(pageCount);
    //  console.log(activeTab);
    promiseCall(activeTab,pageCount);
  }

  const visibleTests = allTests.filter(t => t.type === activeTab);

  const tabs = Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({
    key,
    ...cfg,
    count: allTests.filter(t => t.type === key).length,
  }));

  const ActiveIcon = TYPE_CONFIG[activeTab].icon;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tests & Services</div>
          <div className="page-subtitle">Manage tests, profiles, and packages</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16}/> Add {TYPE_CONFIG[activeTab].label}
        </button>
      </div>

      {/* Tabs */}
      <div className="test-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`test-tab ${activeTab === tab.key ? 'active' : ''}`}
            style={activeTab === tab.key ? { borderBottomColor: tab.color, color: tab.color } : {}}
            onClick={() => handleTabChange(tab.key)}
          >
            <tab.icon size={15}/>
            <span>{tab.label}s</span>
            <span className="test-tab-count" style={activeTab === tab.key ? { background: tab.bg, color: tab.color } : {}}>
             {/* {tab.count} */}
            </span>
          </button>
        ))}
      </div>

      {/* Description card */}
      <div className="type-desc-card" style={{ borderLeftColor: TYPE_CONFIG[activeTab].color }}>
        <ActiveIcon size={15} color={TYPE_CONFIG[activeTab].color} />
        <span>{TYPE_CONFIG[activeTab].desc}</span>
        {activeTab === 'profile' && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· Contains tests only</span>}
        {activeTab === 'package' && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· Can contain tests, profiles, or other packages</span>}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 2, minWidth: 200 }}>
            <Search size={15}/>
            <input className="form-control" placeholder={`Search ${activeTab}s…`}
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select className="form-control" style={{ flex: 1, minWidth: 160 }} value={selCat} onChange={e => setSelCat(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={fetchData}>Search</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading-container"><div className="spinner"/></div>
        ) : (
          <div className="table-container">
            <table className="tests-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Sample Type</th>
                  {activeTab !== 'test' ? <th>Contents</th>:''}
                  <th>Price</th>
                  <th>Fasting</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTests.map(t => (
                  activeTab === 'test' ? (
                    <tr key={t.id}>
                      <td><code style={{ fontSize: 11, background: 'var(--surface2)', padding: '3px 7px', borderRadius: 5, color: 'var(--accent)', fontWeight: 700 }}>{t.code}</code></td>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td style={{ fontSize: 12 }}>{t.category_name || '—'}</td>
                      <td><TypeBadge type={t.type}/></td>
                      <td style={{ fontSize: 12 }}>{t.sample_type || '—'}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'Space Mono,monospace' }}>₹{parseFloat(t.base_price).toFixed(0)}</td>
                      <td>{t.fasting_required ? <span className="badge badge-warning" style={{ fontSize: 10 }}>Yes</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No</span>}</td>
                      <td>{t.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setModal(t)}><Edit2 size={12}/></button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.name)}><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <CompositionRow
                      key={t.id}
                      item={{ ...t, _onEdit: () => setModal(t), _onDelete: () => handleDelete(t.id, t.name) }}
                    />
                  )
                ))}
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => handlePageChange(i + 1)}
                        style={{
                          fontWeight: page === i + 1 ? 'bolder' : 'lighter',
                          margin : '10px',
                          minWidth : '28px',
                          height : '28px',
                          fontSize : page === i + 1 ? '14px' : '10px',
                          borderRadius : '6px'
                        }}
                      >
                        {i + 1}
                      </button>
                ))}
                </td></tr>
                {visibleTests.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <ActiveIcon size={36} style={{ opacity: .25 }} />
                        <span>No {activeTab}s found</span>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                          <Plus size={13}/> Add {TYPE_CONFIG[activeTab].label}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit buttons overlay on composition rows */}
      {activeTab !== 'test' && visibleTests.map(t => (
        <div key={`actions-${t.id}`} style={{ display: 'none' }}>
          <button onClick={() => setModal(t)}/>
          <button onClick={() => handleDelete(t.id, t.name)}/>
        </div>
      ))}

      {modal && (
        <TestModal
          item={modal === 'create' ? null : modal}
          categories={categories}
          allTests={allTests}
          forcedType={modal === 'create' ? activeTab : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}