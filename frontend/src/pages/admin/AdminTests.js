import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTests, getCategories, createTest, updateTest,
  deleteTest, getComposition, searchTests, previewMeta,
} from '../../utils/api';
import API from '../../utils/api';
import {
  Plus, Edit2, Trash2, X, Save, Search, TestTube,
  Layers, Package, ChevronDown, ChevronUp,
  CheckCircle, Info, FlaskConical, Clock, AlertCircle,
  Download, Upload, FileSpreadsheet, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminTests.css';

/* ── Type config ────────────────────────────────────────────── */
const TYPE_CONFIG = {
  test:    { label: 'Test',    icon: TestTube, color: '#3498DB', bg: '#EBF5FB', desc: 'A single diagnostic test' },
  profile: { label: 'Profile', icon: Layers,   color: '#9B59B6', bg: '#F5EEF8', desc: 'A named group of tests' },
  package: { label: 'Package', icon: Package,  color: '#E67E22', bg: '#FEF9E7', desc: 'Tests, profiles, or other packages bundled together' },
};

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.test;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      background:cfg.bg, color:cfg.color,
      fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:100,
    }}>
      <cfg.icon size={10}/>{cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   DerivedMetaBar — shows auto-derived sample/time/fasting
   ─────────────────────────────────────────────────────────── */
function DerivedMetaBar({ meta, loading }) {
  if (loading) return (
    <div className="derived-meta-bar loading">
      <div className="spinner" style={{ width:14, height:14, borderWidth:2 }}/>
      Analysing children…
    </div>
  );
  if (!meta || (!meta.sample_type && !meta.report_time)) return null;
  return (
    <div className="derived-meta-bar">
      <span className="dml">Auto-derived from children</span>
      {meta.sample_type && (
        <span className="dmv"><FlaskConical size={12}/> {meta.sample_type}</span>
      )}
      {meta.report_time && (
        <span className="dmv"><Clock size={12}/> {meta.report_time}</span>
      )}
      {meta.fasting_required ? (
        <span className="dmv fasting"><AlertCircle size={12}/> Fasting required</span>
      ) : (
        <span className="dmv nofasting">No fasting</span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ChildPicker — server-side search, debounced
   Profiles: pick tests only
   Packages: pick tests + profiles + packages
   ─────────────────────────────────────────────────────────── */
function ChildPicker({ parentType, excludeId, selectedItems, onAdd, onRemove }) {
  const [query,    setQuery]   = useState('');
  const [results,  setResults] = useState([]);
  const [searching,setSearching] = useState(false);
  const debounce = useRef(null);

  // Allowed types for the available panel
  const allowedTypes = parentType === 'profile' ? 'test' : 'test,profile,package';

  const doSearch = useCallback(async (q) => {
    setSearching(true);
    try {
      const res = await searchTests({
        q,
        types: allowedTypes,
        exclude_id: excludeId || undefined,
      });
      setResults(res.data.tests || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [allowedTypes, excludeId]);

  // Trigger search on mount (empty query = top 30)
  useEffect(() => { doSearch(''); }, [doSearch]);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch(val), 280);
  };

  const selectedIds = selectedItems.map(t => t.id);
  const isSelected  = (id) => selectedIds.includes(id);

  // Results filtered to exclude already-selected items
  const available = results.filter(t => !isSelected(t.id));

  const total = selectedItems.reduce((s, t) => s + parseFloat(t.base_price || 0), 0);

  return (
    <div className="child-picker">
      <div className="cp-layout">
        {/* ── Left: available ── */}
        <div className="cp-available">
          <div className="cp-section-label">
            Available {parentType === 'profile' ? 'Tests' : 'Tests / Profiles / Packages'}
            <span style={{ fontWeight:400, color:'var(--text-muted)', marginLeft:6 }}>
              (type to search)
            </span>
          </div>
          <div className="search-bar" style={{ marginBottom:8 }}>
            <Search size={13}/>
            <input
              className="form-control"
              value={query}
              onChange={handleInput}
              placeholder="Search by name or code…"
            />
          </div>
          <div className="cp-list">
            {searching ? (
              <div className="cp-empty"><div className="spinner" style={{ width:18,height:18,borderWidth:2 }}/></div>
            ) : available.length === 0 ? (
              <div className="cp-empty">{query ? 'No results' : 'Start typing to search'}</div>
            ) : available.map(t => (
              <button key={t.id} className="cp-item" onClick={() => onAdd(t)}>
                <div className="cp-check"><Plus size={11}/></div>
                <div className="cp-item-info">
                  <div className="cp-item-name">{t.name}</div>
                  <div className="cp-item-meta">
                    <TypeBadge type={t.type}/>
                    <span>{t.code}</span>
                    <span>₹{parseFloat(t.base_price).toFixed(0)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: selected ── */}
        <div className="cp-selected">
          <div className="cp-section-label">Included ({selectedItems.length})</div>
          <div className="cp-list">
            {selectedItems.length === 0 ? (
              <div className="cp-empty">None selected yet</div>
            ) : selectedItems.map((t, i) => (
              <div key={t.id} className="cp-selected-item">
                <div className="cp-si-order">{i + 1}</div>
                <div className="cp-si-info">
                  <div className="cp-si-name">{t.name}</div>
                  <div className="cp-si-meta"><TypeBadge type={t.type}/> <span style={{fontSize:11}}>{t.code}</span></div>
                </div>
                <div className="cp-si-price">₹{parseFloat(t.base_price).toFixed(0)}</div>
                <button className="cp-remove" onClick={() => onRemove(t.id)}>×</button>
              </div>
            ))}
          </div>
          {selectedItems.length > 0 && (
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
   TestModal — Create / Edit
   ─────────────────────────────────────────────────────────── */
const emptyForm = {
  type:'test', category_id:'', name:'', code:'',
  description:'', sample_type:'', report_time:'',
  fasting_required:false, base_price:'', is_active:true,
};

function TestModal({ item, categories, forcedType, onClose, onSave }) {
  const isEdit = !!item?.id;
  const [form,    setForm]    = useState(item || { ...emptyForm, type: forcedType || 'test' });
  // selectedItems: full test objects (not just IDs) so ChildPicker can show them
  const [selectedItems, setSelectedItems] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [saving, setSaving] = useState(false);
  const [derivedMeta, setDerivedMeta] = useState(null);
  const [derivingMeta,setDerivingMeta]= useState(false);
  const debouncePreview = useRef(null);

  const h = e => setForm(f => ({
    ...f,
    [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }));

  // Load existing composition when editing
  useEffect(() => {
    if (isEdit && item.type !== 'test') {
      setLoadingChildren(true);
      getComposition(item.id)
        .then(r => setSelectedItems(r.data.children || []))
        .finally(() => setLoadingChildren(false));
    }
  }, [item?.id]);

  // Live preview: whenever selectedItems changes, fetch derived meta
  useEffect(() => {
    if (form.type === 'test' || selectedItems.length === 0) {
      setDerivedMeta(null);
      return;
    }
    setDerivingMeta(true);
    clearTimeout(debouncePreview.current);
    debouncePreview.current = setTimeout(async () => {
      try {
        const res = await previewMeta({ child_ids: selectedItems.map(t => t.id) });
        setDerivedMeta(res.data.meta);
      } catch { setDerivedMeta(null); }
      finally  { setDerivingMeta(false); }
    }, 400);
  }, [selectedItems, form.type]);

  const handleAdd    = (t) => setSelectedItems(prev => prev.find(x => x.id === t.id) ? prev : [...prev, t]);
  const handleRemove = (id) => setSelectedItems(prev => prev.filter(t => t.id !== id));

  const handleSave = async () => {
    if (!form.name?.trim()) return toast.error('Name is required');
    if (!form.code?.trim()) return toast.error('Code is required');
    if (form.base_price === '' || form.base_price == null) return toast.error('Price is required');
    if (form.type !== 'test' && selectedItems.length === 0)
      return toast.error(`A ${form.type} must contain at least one item`);

    setSaving(true);
    try {
      const payload = {
        ...form,
        children: form.type !== 'test' ? selectedItems.map(t => t.id) : undefined,
      };
      if (isEdit) {
        const res = await updateTest(item.id, payload);
        toast.success(`${TYPE_CONFIG[form.type].label} updated!`);
        // Show what was derived
        if (res.data.derived) showDerivedToast(res.data.derived);
      } else {
        const res = await createTest(payload);
        toast.success(`${TYPE_CONFIG[form.type].label} created!`);
        if (res.data.derived) showDerivedToast(res.data.derived);
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const showDerivedToast = (d) => {
    if (d.sample_type) toast(`Sample: ${d.sample_type}`, { icon: '🧪' });
  };

  const cfg = TYPE_CONFIG[form.type] || TYPE_CONFIG.test;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal test-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:cfg.bg,
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
              <cfg.icon size={18} color={cfg.color}/>
            </div>
            <div>
              <div className="modal-title">{isEdit ? `Edit ${cfg.label}` : `Add New ${cfg.label}`}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>{cfg.desc}</div>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>

        <div className="modal-body">
          {/* Type selector — only when creating without forced type */}
          {!isEdit && !forcedType && (
            <div className="form-group">
              <label className="form-label">Type *</label>
              <div style={{ display:'flex', gap:10 }}>
                {Object.entries(TYPE_CONFIG).map(([t, c]) => (
                  <label key={t} style={{
                    flex:1, display:'flex', alignItems:'center', gap:8,
                    padding:'10px 14px',
                    border:`2px solid ${form.type === t ? c.color : 'var(--border)'}`,
                    borderRadius:10, cursor:'pointer',
                    background: form.type === t ? c.bg : 'white',
                    transition:'all .15s',
                  }}>
                    <input type="radio" name="type" value={t} checked={form.type === t} onChange={h} hidden/>
                    <c.icon size={16} color={c.color}/>
                    <span style={{ fontWeight:600, fontSize:13, color:c.color }}>{c.label}</span>
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
                placeholder={form.type === 'test' ? 'Complete Blood Count' : form.type === 'profile' ? 'Thyroid Profile' : 'Annual Health Checkup'}/>
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-control" name="code" value={form.code} onChange={h}
                placeholder="e.g. CBC001" style={{ textTransform:'uppercase' }}/>
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
              <input className="form-control" name="base_price" type="number"
                value={form.base_price} onChange={h} placeholder="0.00" min="0" step="0.01"/>
            </div>

            {/* Sample fields: editable for tests, auto-derived for profiles/packages */}
            {form.type === 'test' ? (
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
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">
                    Sample Type
                    <span className="auto-derive-hint">(auto-derived · editable)</span>
                  </label>
                  <input className="form-control" name="sample_type" value={form.sample_type} onChange={h}
                    placeholder={derivedMeta?.sample_type || 'Auto-derived from children'}/>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Report Time
                    <span className="auto-derive-hint">(auto-derived · editable)</span>
                  </label>
                  <input className="form-control" name="report_time" value={form.report_time} onChange={h}
                    placeholder={derivedMeta?.report_time || 'Auto-derived from children'}/>
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" name="description" value={form.description} onChange={h}
              rows={2} placeholder="Brief description…"/>
          </div>

          <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:4 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
              <input type="checkbox" name="fasting_required" checked={form.fasting_required} onChange={h}/>
              Fasting Required
            </label>
            {isEdit && (
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={h}/>
                Active
              </label>
            )}
          </div>

          {/* Composition section */}
          {form.type !== 'test' && (
            <div style={{ marginTop:20, borderTop:'1px solid var(--border)', paddingTop:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <cfg.icon size={15} color={cfg.color}/>
                <span style={{ fontWeight:700, fontSize:14, color:cfg.color }}>
                  {cfg.label} Contents
                </span>
                <div className="alert alert-info" style={{ padding:'4px 10px', fontSize:12, margin:0, display:'inline-flex', alignItems:'center', gap:5 }}>
                  <Info size={12}/>
                  {form.type === 'profile' ? 'Profiles can contain tests only' : 'Packages can contain tests, profiles, or other packages'}
                </div>
              </div>

              {/* Live derived meta preview */}
              <DerivedMetaBar meta={derivedMeta} loading={derivingMeta}/>

              {loadingChildren
                ? <div className="loading-container" style={{ padding:32 }}><div className="spinner"/></div>
                : <ChildPicker
                    parentType={form.type}
                    excludeId={item?.id}
                    selectedItems={selectedItems}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                  />
              }
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14}/> {saving ? 'Saving…' : `Save ${cfg.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CompositionRow — expandable row for profiles/packages
   Only fetches children on first expand (lazy)
   ─────────────────────────────────────────────────────────── */
function CompositionRow({ item }) {
  const [open,   setOpen]   = useState(false);
  const [kids,   setKids]   = useState([]);
  const [loaded, setLoaded] = useState(false);

  const toggle = async () => {
    if (!loaded) {
      try {
        const r = await getComposition(item.id);
        setKids(r.data.children || []);
      } catch { /* silent */ }
      setLoaded(true);
    }
    setOpen(o => !o);
  };

  return (
    <>
      <tr>
        <td><code style={{ fontSize:11, background:'var(--surface2)', padding:'3px 7px', borderRadius:5, color:'var(--accent)', fontWeight:700 }}>{item.code}</code></td>
        <td style={{ fontWeight:600 }}>{item.name}</td>
        <td style={{ fontSize:12 }}>{item.category_name || '—'}</td>
        <td><TypeBadge type={item.type}/></td>
        <td style={{ fontSize:12, color:'var(--text-muted)' }}>
          {item.sample_type || <span style={{ fontStyle:'italic' }}>auto</span>}
        </td>
        <td>
          <button className="btn-expand" onClick={toggle}>
            {open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            {loaded ? `${kids.length} item${kids.length !== 1 ? 's' : ''}` : 'Show contents'}
          </button>
        </td>
        <td style={{ fontWeight:700, fontFamily:'Space Mono,monospace' }}>₹{parseFloat(item.base_price).toFixed(0)}</td>
        <td>
          {item.fasting_required
            ? <span className="badge badge-warning" style={{ fontSize:10 }}>Yes</span>
            : <span style={{ color:'var(--text-muted)', fontSize:12 }}>No</span>}
        </td>
        <td>{item.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
        <td>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-outline btn-sm" onClick={item._onEdit}><Edit2 size={12}/></button>
            <button className="btn btn-danger btn-sm"  onClick={item._onDelete}><Trash2 size={12}/></button>
          </div>
        </td>
      </tr>
      {open && kids.map(c => (
        <tr key={c.id} style={{ background:'var(--surface2)' }}>
          <td/>
          <td colSpan={5}>
            <div style={{ display:'flex', alignItems:'center', gap:8, paddingLeft:20, fontSize:13 }}>
              <div style={{ width:1, height:20, background:'var(--border)', marginRight:8 }}/>
              <TypeBadge type={c.type}/>
              <span style={{ fontWeight:600 }}>{c.name}</span>
              <code style={{ fontSize:10, color:'var(--text-muted)', background:'var(--surface)', padding:'1px 5px', borderRadius:4 }}>{c.code}</code>
            </div>
          </td>
          <td style={{ fontWeight:700, fontFamily:'Space Mono,monospace', fontSize:13 }}>
            ₹{parseFloat(c.base_price).toFixed(0)}
          </td>
          <td colSpan={3}/>
        </tr>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ImportModal — upload xlsx and show result summary
   ─────────────────────────────────────────────────────────── */
function ImportModal({ onClose, onDone }) {
  const [file,     setFile]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f || !f.name.endsWith('.xlsx')) {
      toast.error('Please select a valid .xlsx file');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return toast.error('Select a file first');
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await API.post('/admin/tests/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.created + res.data.updated > 0) {
        toast.success(`Import complete — ${res.data.created} created, ${res.data.updated} updated`);
        onDone();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <FileSpreadsheet size={18} color="var(--accent)"/>
            Import Tests from Excel
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>

        <div className="modal-body">
          {/* Drop zone */}
          <div
            className={`xlsx-dropzone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <input ref={inputRef} type="file" accept=".xlsx" hidden
              onChange={e => handleFile(e.target.files[0])}/>
            {file ? (
              <>
                <CheckCircle size={32} color="#2ECC71"/>
                <div className="dz-filename">{file.name}</div>
                <div className="dz-size">{(file.size / 1024).toFixed(1)} KB · Click to change</div>
              </>
            ) : (
              <>
                <FileSpreadsheet size={32} color="var(--text-muted)"/>
                <div className="dz-label">Drop your .xlsx file here or click to browse</div>
                <div className="dz-hint">Max 10 MB · Only .xlsx format accepted</div>
              </>
            )}
          </div>

          {/* Tips */}
          <div className="import-tips">
            <AlertTriangle size={13} color="#E67E22"/>
            <div>
              <strong>Import order matters:</strong> Tests must exist before Profiles and Packages that include them.
              Use the <strong>Download Template</strong> button to get the correct format.
            </div>
          </div>

          {/* Result summary */}
          {result && (
            <div className="import-result">
              <div className="ir-title">Import Summary</div>
              <div className="ir-stats">
                <div className="ir-stat green"><span>{result.created}</span>Created</div>
                <div className="ir-stat blue"> <span>{result.updated}</span>Updated</div>
                <div className="ir-stat grey"> <span>{result.skipped}</span>Skipped</div>
              </div>
              {result.errors?.length > 0 && (
                <div className="ir-errors">
                  <div className="ir-errors-title">Errors ({result.errors.length})</div>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <div key={i} className="ir-error-row">
                      <code>{e.sheet} row {e.row}</code>
                      {e.code && <span>{e.code}</span>}
                      <span style={{ color:'var(--danger)' }}>{e.error}</span>
                    </div>
                  ))}
                  {result.errors.length > 5 && (
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
                      …and {result.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={loading || !file}>
            <Upload size={14}/> {loading ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main AdminTests
   ─────────────────────────────────────────────────────────── */
export default function AdminTests() {
  const [tests,       setTests]      = useState([]);
  const [categories,  setCategories] = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [pagination,  setPagination] = useState({ page:1, pages:1, total:0 });
  const [activeTab,   setActiveTab]  = useState('test');
  const [modal,       setModal]      = useState(null);
  const [search,      setSearch]     = useState('');
  const [selCat,      setSelCat]     = useState('');
  const [page,        setPage]       = useState(1);
  const [showImport,  setShowImport]  = useState(false);

  const LIMIT = 50;

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const link  = document.createElement('a');
    link.href   = `/api/admin/tests/export`;
    // Add auth header by opening with fetch and blob
    fetch('/api/admin/tests/export', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        link.href = URL.createObjectURL(blob);
        link.download = `labcollect-tests-${new Date().toISOString().slice(0,10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(() => toast.error('Export failed'));
  };

  const fetchData = useCallback((overridePage) => {
    const p = overridePage ?? page;
    setLoading(true);
    Promise.all([
      getTests({ type: activeTab, search, category_id: selCat, page: p, limit: LIMIT }),
      getCategories(),
    ]).then(([t, c]) => {
      setTests(t.data.tests || []);
      setPagination(t.data.pagination || { page:1, pages:1, total:0 });
      setCategories(c.data.categories || []);
    }).finally(() => setLoading(false));
  }, [activeTab, search, selCat, page]);

  // Re-fetch when tab changes, reset to page 1
  useEffect(() => { setPage(1); fetchData(1); }, [activeTab]);

  const handleSearch = () => { setPage(1); fetchData(1); };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate "${name}"?`)) return;
    try { await deleteTest(id); toast.success('Deactivated'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const tabs = Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({ key, ...cfg }));
  const ActiveIcon = TYPE_CONFIG[activeTab].icon;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tests & Services</div>
          <div className="page-subtitle">Manage tests, profiles, and packages</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline" onClick={handleExport} title="Download Excel">
            <Download size={15}/> Export Excel
          </button>
          <button className="btn btn-outline" onClick={() => setShowImport(true)} title="Upload Excel">
            <Upload size={15}/> Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => setModal('create')}>
            <Plus size={16}/> Add {TYPE_CONFIG[activeTab].label}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="test-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`test-tab ${activeTab === tab.key ? 'active' : ''}`}
            style={activeTab === tab.key ? { borderBottomColor:tab.color, color:tab.color } : {}}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={15}/>
            <span>{tab.label}s</span>
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="type-desc-card" style={{ borderLeftColor: TYPE_CONFIG[activeTab].color }}>
        <ActiveIcon size={15} color={TYPE_CONFIG[activeTab].color}/>
        <span>{TYPE_CONFIG[activeTab].desc}</span>
        {activeTab === 'profile' && <span style={{ color:'var(--text-muted)', fontSize:12 }}>· Contains tests only</span>}
        {activeTab === 'package' && <span style={{ color:'var(--text-muted)', fontSize:12 }}>· Can contain tests, profiles, or other packages</span>}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding:'14px 18px', marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <div className="search-bar" style={{ flex:2, minWidth:200 }}>
            <Search size={15}/>
            <input className="form-control" placeholder={`Search ${activeTab}s…`}
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}/>
          </div>
          <select className="form-control" style={{ flex:1, minWidth:160 }} value={selCat}
            onChange={e => { setSelCat(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleSearch}>Search</button>
          {(search || selCat) && (
            <button className="btn btn-outline" onClick={() => { setSearch(''); setSelCat(''); setPage(1); fetchData(1); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading-container"><div className="spinner"/></div>
        ) : (
          <>
            <div className="table-container">
              <table className="tests-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Sample Type</th>
                    {activeTab !== 'test' && <th>Contents</th>}
                    <th>Price</th>
                    <th>Fasting</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(t => activeTab === 'test' ? (
                    <tr key={t.id}>
                      <td><code style={{ fontSize:11, background:'var(--surface2)', padding:'3px 7px', borderRadius:5, color:'var(--accent)', fontWeight:700 }}>{t.code}</code></td>
                      <td style={{ fontWeight:600 }}>{t.name}</td>
                      <td style={{ fontSize:12 }}>{t.category_name || '—'}</td>
                      <td><TypeBadge type={t.type}/></td>
                      <td style={{ fontSize:12 }}>{t.sample_type || '—'}</td>
                      <td style={{ fontWeight:700, fontFamily:'Space Mono,monospace' }}>₹{parseFloat(t.base_price).toFixed(0)}</td>
                      <td>{t.fasting_required ? <span className="badge badge-warning" style={{ fontSize:10 }}>Yes</span> : <span style={{ color:'var(--text-muted)', fontSize:12 }}>No</span>}</td>
                      <td>{t.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
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
                  ))}
                  {tests.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === 'test' ? 9 : 10} style={{ textAlign:'center', color:'var(--text-muted)', padding:48 }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                          <ActiveIcon size={36} style={{ opacity:.25 }}/>
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

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination-bar">
                <span className="pag-info">
                  Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, pagination.total)} of {pagination.total}
                </span>
                <div className="pag-btns">
                  <button className="btn btn-outline btn-sm" disabled={page <= 1}
                    onClick={() => { setPage(p => p - 1); fetchData(page - 1); }}>← Prev</button>
                  <span className="pag-page">{page} / {pagination.pages}</span>
                  <button className="btn btn-outline btn-sm" disabled={page >= pagination.pages}
                    onClick={() => { setPage(p => p + 1); fetchData(page + 1); }}>Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <TestModal
          item={modal === 'create' ? null : modal}
          categories={categories}
          forcedType={modal === 'create' ? activeTab : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchData(); }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { fetchData(); }}
        />
      )}
    </div>
  );
}