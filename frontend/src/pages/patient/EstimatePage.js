import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getTests, getCategories, getPublicClients, getEstimateRates } from '../../utils/api';
import {
  Search, X, Plus, FileText, Printer, FlaskConical,
  Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  ShoppingCart, Building2, Tag, TrendingDown,
} from 'lucide-react';
import './EstimatePage.css';

const LAB_NAME    = 'LabCollect Diagnostics';
const LAB_ADDRESS = 'Ludhiana, Punjab, India';
const LAB_PHONE   = '+91 98765 43210';

/* ── Debounce hook ────────────────────────────────────────── */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─────────────────────────────────────────────────────────────
   EstimateRow — one row in the right panel
   Shows base price struck through when client discount applies
   ─────────────────────────────────────────────────────────── */
function EstimateRow({ test, priceMap, onRemove }) {
  const pdata = priceMap?.[test.id];
  const effectivePrice = pdata?.effective_price ?? parseFloat(test.base_price);
  const basePrice      = parseFloat(test.base_price);
  const hasDiscount    = pdata?.has_discount && pdata.effective_price < basePrice;
  const savings        = hasDiscount ? basePrice - pdata.effective_price : 0;

  return (
    <div className="est-row">
      <div className="est-row-info">
        <div className="est-row-name">{test.name}</div>
        <div className="est-row-meta">
          <span className="est-code">{test.code}</span>
          {test.sample_type && <span>· {test.sample_type}</span>}
          {test.report_time && <span>· {test.report_time}</span>}
          {test.fasting_required && <span className="est-fasting">Fasting</span>}
        </div>
      </div>
      <div className="est-row-price-block">
        {hasDiscount && (
          <div className="est-row-base-price">₹{basePrice.toFixed(0)}</div>
        )}
        <div className={`est-row-price ${hasDiscount ? 'discounted' : ''}`}>
          ₹{effectivePrice.toFixed(0)}
        </div>
        {hasDiscount && savings > 0 && (
          <div className="est-row-savings">−₹{savings.toFixed(0)}</div>
        )}
      </div>
      <button className="est-remove" onClick={() => onRemove(test.id)}><X size={13}/></button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Prescription Upload Zone
   ─────────────────────────────────────────────────────────── */
function PrescriptionUpload({ file, onChange }) {
  const inputRef   = useRef();
  const [preview, setPreview] = useState(null);
  const [drag,    setDrag]    = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    const ok = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!ok.includes(f.type)) { alert('Upload JPG, PNG, WEBP, or PDF only'); return; }
    if (f.size > 5 * 1024 * 1024) { alert('Max file size is 5 MB'); return; }
    onChange(f);
    if (f.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = e => setPreview(e.target.result);
      r.readAsDataURL(f);
    } else { setPreview(null); }
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange(null); setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className={`prescription-zone ${drag ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
      onClick={() => !file && inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
    >
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" hidden
        onChange={e => handleFile(e.target.files[0])}/>
      {file ? (
        <div className="pz-file">
          {preview
            ? <img src={preview} alt="rx" className="pz-preview"/>
            : <div className="pz-pdf-icon"><FileText size={34} color="var(--ep-navy)"/></div>
          }
          <div className="pz-file-info">
            <div className="pz-filename">{file.name}</div>
            <div className="pz-filesize">{(file.size/1024).toFixed(0)} KB · Click to change</div>
          </div>
          <button className="pz-clear" onClick={clear}><X size={14}/></button>
        </div>
      ) : (
        <div className="pz-empty">
          <div className="pz-upload-icon">📋</div>
          <div className="pz-label">Upload Prescription</div>
          <div className="pz-hint">Drag & drop or click · JPG, PNG, PDF · Max 5 MB</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Print estimate
   ─────────────────────────────────────────────────────────── */
function printEstimate({ selected, priceMap, prescNote, clientName, rateListName, total, totalSavings }) {
  const now  = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

  const rows = selected.map((t, i) => {
    const pd = priceMap?.[t.id];
    const base = parseFloat(t.base_price);
    const eff  = pd?.effective_price ?? base;
    const disc = pd?.has_discount && eff < base;
    return `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #eee;">${i+1}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #eee;">
        <strong>${t.name}</strong><br/>
        <small style="color:#888;">${t.code}${t.sample_type ? ' · '+t.sample_type : ''}</small>
      </td>
      <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#888;">${t.report_time || '—'}</td>
      ${disc ? `<td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;text-decoration:line-through;color:#aaa;">₹${base.toFixed(0)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#276749;">₹${eff.toFixed(0)}</td>`
             : `<td colspan="2" style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">₹${base.toFixed(0)}</td>`}
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Estimate — ${LAB_NAME}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;padding:36px;color:#1a2b3c;font-size:13px;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0A3D62;padding-bottom:18px;margin-bottom:22px;}
  .lab{font-size:20px;font-weight:700;color:#0A3D62;} .lab-sub{color:#5D7B96;margin-top:4px;}
  .est-num{font-size:18px;font-weight:700;color:#00B4D8;font-family:monospace;}
  table{width:100%;border-collapse:collapse;margin-bottom:18px;}
  thead tr{background:#0A3D62;color:#fff;}
  thead th{padding:9px 12px;text-align:left;font-size:11px;letter-spacing:.5px;}
  thead th:last-child{text-align:right;} thead th:nth-last-child(2){text-align:right;}
  .tot td{padding:13px 12px;border-top:2px solid #0A3D62;font-weight:700;font-size:15px;}
  .tot td:last-child{text-align:right;color:#0A3D62;font-size:17px;}
  .sav{background:#F0FFF4;border-left:3px solid #00C48C;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:14px;font-size:13px;color:#276749;}
  .note{background:#F0F4F8;border-left:3px solid #00B4D8;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:14px;font-size:12px;}
  .foot{text-align:center;margin-top:36px;font-size:11px;color:#999;}
  @media print{body{padding:18px;}}
</style></head><body>
  <div class="hdr">
    <div>
      <div class="lab">${LAB_NAME}</div>
      <div class="lab-sub">${LAB_ADDRESS} · ${LAB_PHONE}</div>
      ${clientName ? `<div style="margin-top:6px;font-size:12px;color:#5D7B96;">Client: <strong>${clientName}</strong>${rateListName ? ` · Rate: ${rateListName}` : ''}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#888;">ESTIMATE</div>
      <div class="est-num">#EST-${now.getTime().toString().slice(-6)}</div>
      <div style="color:#888;margin-top:4px;">${dateStr}</div>
    </div>
  </div>
  ${prescNote ? `<div class="note"><strong>Prescription note:</strong> ${prescNote}</div>` : ''}
  <table>
    <thead><tr>
      <th style="width:36px;">#</th><th>Test / Service</th><th>Report Time</th>
      <th style="text-align:right;">Base Price</th><th style="text-align:right;">Your Price</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="tot"><td colspan="4">Total (${selected.length} test${selected.length!==1?'s':''})</td><td>₹${total.toFixed(0)}</td></tr>
    </tbody>
  </table>
  ${totalSavings > 0 ? `<div class="sav">🎉 You save <strong>₹${totalSavings.toFixed(0)}</strong> with the ${rateListName || 'client'} rate list!</div>` : ''}
  <div class="note">Indicative estimate only. Final amount may vary. Valid 7 days from date of issue.</div>
  <div class="foot">${LAB_NAME} · ${LAB_PHONE}</div>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open('','_blank');
  w.document.write(html); w.document.close();
}

/* ══════════════════════════════════════════════════════════
   MAIN — EstimatePage
══════════════════════════════════════════════════════════ */
export default function EstimatePage() {
  const [categories,    setCategories]    = useState([]);
  const [allTests,      setAllTests]      = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selected,      setSelected]      = useState([]);
  const [query,         setQuery]         = useState('');
  const [searching,     setSearching]     = useState(false);
  const [prescription,  setPrescription]  = useState(null);
  const [prescNote,     setPrescNote]     = useState('');
  const [activeCat,     setActiveCat]     = useState('');
  const [expandCats,    setExpandCats]    = useState({});

  // Client / rate list
  const [clients,       setClients]       = useState([]);
  const [selClientId,   setSelClientId]   = useState('');
  const [rateListName,  setRateListName]  = useState('');
  const [priceMap,      setPriceMap]      = useState(null);  // { [test_id]: { effective_price, has_discount, ... } }
  const [loadingRates,  setLoadingRates]  = useState(false);

  const debouncedQuery = useDebounce(query, 280);

  // Initial data load
  useEffect(() => {
    Promise.all([
      getCategories(),
      getTests({ limit: 200, type: 'test' }),
      getPublicClients(),
    ]).then(([cats, tests, cls]) => {
      setCategories(cats.data.categories || []);
      setAllTests(tests.data.tests || []);
      setClients(cls.data.clients || []);
    });
  }, []);

  // Load rate list when client changes
  useEffect(() => {
    if (!selClientId) {
      setPriceMap(null);
      setRateListName('');
      return;
    }
    setLoadingRates(true);
    getEstimateRates(selClientId)
      .then(r => {
        setPriceMap(r.data.prices || {});
        setRateListName(r.data.rate_list_name || '');
      })
      .catch(() => { setPriceMap(null); setRateListName(''); })
      .finally(() => setLoadingRates(false));
  }, [selClientId]);

  // Search
  useEffect(() => {
    if (!debouncedQuery.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    getTests({ search: debouncedQuery, limit: 30 })
      .then(r => setSearchResults(r.data.tests || []))
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  const addTest    = (t) => {
    if (!selected.find(s => s.id === t.id)) setSelected(prev => [...prev, t]);
    setQuery(''); setSearchResults([]);
  };
  const removeTest = (id) => setSelected(prev => prev.filter(t => t.id !== id));

  // Compute totals using priceMap when available
  const getEffectivePrice = (t) =>
    priceMap?.[t.id]?.effective_price ?? parseFloat(t.base_price);

  const total = selected.reduce((s, t) => s + getEffectivePrice(t), 0);
  const totalBase = selected.reduce((s, t) => s + parseFloat(t.base_price), 0);
  const totalSavings = Math.max(0, totalBase - total);

  const fasting = selected.some(t => t.fasting_required);

  const selectedClient = clients.find(c => String(c.id) === String(selClientId));

  // Browse grouped by category
  const grouped = categories
    .map(cat => ({
      ...cat,
      tests: allTests.filter(t => t.category_id === cat.id && !selected.find(s => s.id === t.id)),
    }))
    .filter(cat => cat.tests.length > 0)
    .filter(cat => !activeCat || String(cat.id) === activeCat);

  const toggleCat = (id) => setExpandCats(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="estimate-page">
      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="est-hero">
        <div className="est-hero-inner">
          <div className="est-hero-badge">Cost Estimator</div>
          <h1 className="est-hero-title">
            Know your test costs<br/>
            <span className="est-hero-accent">before you book</span>
          </h1>
          <p className="est-hero-sub">
            Search tests prescribed by your doctor, upload your prescription, select your
            organisation for special rates, and get an instant estimate — no login required.
          </p>
        </div>
      </div>

      <div className="est-layout">
        {/* ══ LEFT ═══════════════════════════════════════════ */}
        <div className="est-left">

          {/* ── Client / Rate List selector ────────────────── */}
          {/* <div className="est-card">
            <div className="est-card-title"><Building2 size={16}/> Select Your Organisation</div>
            <div style={{ position:'relative' }}>
              <select
                className="form-control est-client-select"
                value={selClientId}
                onChange={e => setSelClientId(e.target.value)}
              >
                <option value="">Walk-in / Individual (Standard Prices)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {loadingRates && (
                <div className="est-rate-loading">
                  <div className="spinner" style={{ width:14, height:14, borderWidth:2 }}/>
                  Loading rates…
                </div>
              )}
            </div>

            {selClientId && !loadingRates && (
              rateListName ? (
                <div className="est-rate-badge active">
                  <Tag size={13}/>
                  <span>Rate List: <strong>{rateListName}</strong></span>
                  {totalSavings > 0 && selected.length > 0 && (
                    <span className="est-rate-savings-pill">
                      <TrendingDown size={11}/> Save ₹{totalSavings.toFixed(0)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="est-rate-badge none">
                  <AlertCircle size={13}/>
                  <span>No rate list assigned to this organisation — standard prices apply</span>
                </div>
              )
            )}
          </div> */}

          {/* ── Prescription upload ─────────────────────────── */}
          <div className="est-card">
            <div className="est-card-title">
              <FileText size={16}/>
              Upload Prescription <span className="est-optional">(optional)</span>
            </div>
            <PrescriptionUpload file={prescription} onChange={setPrescription}/>
            {prescription && (
              <div className="form-group" style={{ marginTop:10 }}>
                <label className="form-label">Note from prescription</label>
                <textarea className="form-control" rows={2} value={prescNote}
                  placeholder="e.g. Dr. Sharma prescribed CBC, TSH, Vitamin D"
                  onChange={e => setPrescNote(e.target.value)}/>
              </div>
            )}
          </div>

          {/* ── Test search ─────────────────────────────────── */}
          <div className="est-card">
            <div className="est-card-title"><Search size={16}/> Search Tests</div>
            <div className="est-search-wrap">
              <div className="est-search-bar">
                <Search size={15}/>
                <input className="form-control" placeholder="Type test name or code…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {query && <button className="est-clear-q" onClick={() => { setQuery(''); setSearchResults([]); }}><X size={13}/></button>}
              </div>

              {query && (
                <div className="est-search-results">
                  {searching && <div className="est-search-loader">Searching…</div>}
                  {!searching && searchResults.length === 0 && (
                    <div className="est-search-empty">No tests found for "{query}"</div>
                  )}
                  {searchResults.map(t => {
                    const already = !!selected.find(s => s.id === t.id);
                    const effPrice = priceMap?.[t.id]?.effective_price ?? parseFloat(t.base_price);
                    const hasDisc  = priceMap?.[t.id]?.has_discount;
                    const basePrice = parseFloat(t.base_price);
                    return (
                      <button key={t.id}
                        className={`est-search-item ${already ? 'already' : ''}`}
                        onClick={() => !already && addTest(t)}
                        disabled={already}
                      >
                        <div className="esi-info">
                          <div className="esi-name">{t.name}</div>
                          <div className="esi-meta">{t.code} · {t.category_name || '—'}{t.sample_type ? ` · ${t.sample_type}` : ''}</div>
                        </div>
                        <div className="esi-right">
                          <div className="esi-price-block">
                            {hasDisc && <div className="esi-base-struck">₹{basePrice.toFixed(0)}</div>}
                            <div className={`esi-price ${hasDisc ? 'discounted' : ''}`}>₹{effPrice.toFixed(0)}</div>
                          </div>
                          {already
                            ? <span className="esi-added"><CheckCircle size={12}/> Added</span>
                            : <span className="esi-add"><Plus size={12}/> Add</span>
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Browse by category ──────────────────────────── */}
          <div className="est-card">
            <div className="est-card-title" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span><FlaskConical size={16}/> Browse by Category</span>
              <select className="form-control"
                style={{ width:'auto', fontSize:12, padding:'4px 8px', height:'auto' }}
                value={activeCat} onChange={e => setActiveCat(e.target.value)}>
                <option value="">All</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {grouped.map(cat => (
              <div key={cat.id} className="est-cat-group">
                <button className="est-cat-header" onClick={() => toggleCat(cat.id)}>
                  <span>{cat.name}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="est-cat-count">{cat.tests.length}</span>
                    {expandCats[cat.id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </span>
                </button>
                {expandCats[cat.id] && (
                  <div className="est-cat-tests">
                    {cat.tests.map(t => {
                      const effPrice = priceMap?.[t.id]?.effective_price ?? parseFloat(t.base_price);
                      const hasDisc  = priceMap?.[t.id]?.has_discount;
                      const basePrice = parseFloat(t.base_price);
                      return (
                        <button key={t.id} className="est-browse-item" onClick={() => addTest(t)}>
                          <div className="ebi-info">
                            <div className="ebi-name">{t.name}</div>
                            <div className="ebi-meta">
                              {t.code}{t.sample_type ? ` · ${t.sample_type}` : ''}
                              {t.fasting_required && <span className="ebi-fasting"> · Fasting</span>}
                            </div>
                          </div>
                          <div className="ebi-right">
                            <div className="ebi-price-block">
                              {hasDisc && <div className="ebi-base-struck">₹{basePrice.toFixed(0)}</div>}
                              <div className={`ebi-price ${hasDisc ? 'discounted' : ''}`}>₹{effPrice.toFixed(0)}</div>
                            </div>
                            <span className="ebi-add-icon"><Plus size={12}/></span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT — estimate summary ════════════════════════ */}
        <div className="est-right">
          <div className="est-summary-card">
            <div className="est-summary-header">
              <div className="est-summary-title">Your Estimate</div>
              {selected.length > 0 && (
                <button className="est-clear-all" onClick={() => setSelected([])}>Clear all</button>
              )}
            </div>

            {selected.length === 0 ? (
              <div className="est-empty-state">
                <div className="est-empty-icon"><ShoppingCart size={32}/></div>
                <div className="est-empty-text">Add tests to see your estimate</div>
                <div className="est-empty-hint">Search above or browse by category</div>
              </div>
            ) : (
              <>
                <div className="est-items">
                  {selected.map(t => (
                    <EstimateRow key={t.id} test={t} priceMap={priceMap} onRemove={removeTest}/>
                  ))}
                </div>

                {fasting && (
                  <div className="est-alert fasting">
                    <AlertCircle size={14}/>
                    One or more tests require 8–10 hours fasting before sample collection.
                  </div>
                )}

                <div className="est-total-block">
                  {totalSavings > 0 && (
                    <div className="est-savings-banner">
                      <TrendingDown size={14}/>
                      You save <strong>₹{totalSavings.toFixed(0)}</strong> with {selectedClient?.name || 'your organisation'}'s rate list!
                    </div>
                  )}
                  {totalSavings > 0 && (
                    <div className="est-total-row">
                      <span>Standard Total</span>
                      <span style={{ textDecoration:'line-through', color:'var(--ep-muted)' }}>₹{totalBase.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="est-total-row">
                    <span>Home Collection</span>
                    <span className="est-free">FREE</span>
                  </div>
                  <div className="est-divider"/>
                  <div className="est-total-row grand">
                    <span>Estimated Total</span>
                    <span>₹{total.toFixed(0)}</span>
                  </div>
                  <div className="est-disclaimer">*Indicative estimate. Final amount may vary.</div>
                </div>

                {selected.some(t => t.report_time) && (
                  <div className="est-report-times">
                    <div className="est-rt-title"><Clock size={13}/> Report Times</div>
                    {selected.filter(t => t.report_time).map(t => (
                      <div key={t.id} className="est-rt-row">
                        <span>{t.name}</span>
                        <span>{t.report_time}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="est-actions">
                  <button className="est-action-btn print"
                    onClick={() => printEstimate({
                      selected, priceMap, prescNote,
                      clientName:   selectedClient?.name,
                      rateListName,
                      total, totalSavings,
                    })}>
                    <Printer size={15}/> Print / Save PDF
                  </button>
                  <Link to="/book"
                    onClick={() => { 
                      const selectedIds = selected.map(t => t.id);
                      localStorage.setItem('preselectedTests', JSON.stringify(selectedIds))
                    } }
                    state={{ preselectedTests: selected.map(t => t.id) }}
                    className="est-action-btn book">
                    <ShoppingCart size={15}/> Book These Tests
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
