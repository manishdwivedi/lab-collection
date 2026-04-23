import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getRateList, updateRateList, getTests } from '../../utils/api';
import { ArrowLeft, Save, Plus, Trash2, Search, IndianRupee, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminRateListDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rateList, setRateList] = useState(null);
  const [allTests, setAllTests] = useState([]);
  const [items, setItems] = useState([]); // { test_id, test_name, test_code, base_price, price, category_name }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);

  useEffect(() => {
    Promise.all([getRateList(id), getTests({category_id:'' , search:addSearch})]).then(([rl, t]) => {
      // console.log(t.data.tests)
      const rlData = rl.data.rateList;
      setRateList(rlData);
      setAllTests(t.data.tests);
      // Map existing items
      setItems(rlData.items.map(item => ({
        test_id: item.test_id,
        test_name: item.test_name,
        test_code: item.test_code,
        base_price: item.base_price,
        category_name: item.category_name,
        price: item.price,
      })));
      setLoading(false);
    }).catch(() => { toast.error('Failed to load rate list'); navigate('/admin/rate-lists'); });
  }, [id,addSearch]);

  const handlePriceChange = (testId, val) => {
    setItems(prev => prev.map(i => i.test_id === testId ? { ...i, price: val } : i));
  };

  const handleRemoveItem = (testId) => {
    setItems(prev => prev.filter(i => i.test_id !== testId));
  };

  const handleAddTest = (test) => {
    if (items.find(i => i.test_id === test.id)) {
      toast('Already in rate list', { icon: 'ℹ️' });
      return;
    }
    setItems(prev => [...prev, {
      test_id: test.id,
      test_name: test.name,
      test_code: test.code,
      base_price: test.base_price,
      category_name: test.category_name,
      price: test.base_price,
    }]);
    // setAddSearch('');
  };

  const handleSave = async () => {
    const invalid = items.find(i => !i.price || parseFloat(i.price) < 0);
    if (invalid) return toast.error(`Invalid price for ${invalid.test_name}`);
    setSaving(true);
    try {
      await updateRateList(id, {
        name: rateList.name,
        description: rateList.description,
        discount_type: rateList.discount_type,
        is_active: rateList.is_active,
        items: items.map(i => ({ test_id: i.test_id, price: parseFloat(i.price) })),
      });
      toast.success('Rate list saved successfully!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const filteredItems = items.filter(i =>
    i.test_name.toLowerCase().includes(search.toLowerCase()) ||
    i.test_code.toLowerCase().includes(search.toLowerCase())
  );
  // console.log(allTests)
  const availableTests = allTests.filter(t =>
    !items.find(i => i.test_id === t.id) &&
    (t.name.toLowerCase().includes(addSearch.toLowerCase()) || t.code.toLowerCase().includes(addSearch.toLowerCase()))
  );

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;

  const totalSavings = items.reduce((sum, i) => sum + (parseFloat(i.base_price) - parseFloat(i.price || 0)), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/admin/rate-lists" className="btn btn-outline btn-sm" style={{ marginBottom: 12 }}>
            <ArrowLeft size={14}/> Back to Rate Lists
          </Link>
          <div className="page-title">{rateList.name}</div>
          <div className="page-subtitle">
            {rateList.description} • {rateList.discount_type === 'percentage' ? 'Percentage based' : 'Fixed price'} • {items.length} tests configured
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setShowAddPanel(!showAddPanel)}>
            <Plus size={14}/> Add Tests
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14}/> {saving ? 'Saving...' : 'Save Rate List'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon"><IndianRupee size={20} color="var(--accent)"/></div>
          <div className="stat-value">{items.length}</div>
          <div className="stat-label">Tests Configured</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><IndianRupee size={20} color="#2ECC71"/></div>
          <div className="stat-value">₹{items.reduce((s, i) => s + parseFloat(i.price || 0), 0).toFixed(0)}</div>
          <div className="stat-label">Total Rate List Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><IndianRupee size={20} color="#E74C3C"/></div>
          <div className="stat-value">₹{Math.max(0, totalSavings).toFixed(0)}</div>
          <div className="stat-label">Total Client Savings vs Base</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showAddPanel ? '1fr 340px' : '1fr', gap: 20 }}>
        {/* Main Table */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Configured Test Prices</span>
            <div className="search-bar" style={{ width: 260 }}>
              <Search size={14}/>
              <input className="form-control" placeholder="Search tests..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginBottom: 16, display: 'flex', gap: 8, fontSize: 13 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }}/>
            Edit the price in the <strong>Rate List Price</strong> column. This overrides the base price for clients assigned this rate list.
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Test Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Base Price</th>
                  <th style={{ textAlign: 'right' }}>Rate List Price</th>
                  <th style={{ textAlign: 'right' }}>Saving</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const saving = parseFloat(item.base_price) - parseFloat(item.price || 0);
                  return (
                    <tr key={item.test_id}>
                      <td><code style={{ fontSize: 11, background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent)', fontWeight: 700 }}>{item.test_code}</code></td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{item.test_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.category_name || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: 13 }}>
                        ₹{parseFloat(item.base_price).toFixed(0)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>₹</span>
                          <input
                            type="number"
                            value={item.price}
                            onChange={e => handlePriceChange(item.test_id, e.target.value)}
                            style={{
                              width: 90, padding: '6px 10px', border: '1.5px solid var(--border)',
                              borderRadius: 8, fontFamily: 'Space Mono, monospace', fontSize: 14,
                              fontWeight: 700, color: 'var(--primary)', textAlign: 'right', outline: 'none'
                            }}
                            min="0" step="0.01"
                            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                          />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', fontSize: 13 }}>
                        {saving > 0
                          ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>-₹{saving.toFixed(0)}</span>
                          : saving < 0
                          ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>+₹{Math.abs(saving).toFixed(0)}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveItem(item.test_id)}>
                          <Trash2 size={12}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredItems.length && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    No tests configured. Click "Add Tests" to begin.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Tests Panel */}
        {showAddPanel && (
          <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 88 }}>
            <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 16 }}>Add Tests to Rate List</div>
            <div className="search-bar" style={{ marginBottom: 12 }}>
              <Search size={14}/>
              <input className="form-control" placeholder="Search tests to add..." value={addSearch} onChange={e => setAddSearch(e.target.value)}/>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {availableTests.slice(0, 30).map(t => (
                <div
                  key={t.id}
                  onClick={() => handleAddTest(t)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = ''; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.code} • {t.category_name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Space Mono, monospace' }}>₹{parseFloat(t.base_price).toFixed(0)}</span>
                      <Plus size={14} color="var(--accent)"/>
                    </div>
                  </div>
                </div>
              ))}
              {availableTests.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>All tests added</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
