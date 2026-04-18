import React, { useState, useEffect } from 'react';
import { getLabs, pushToLab, getPushLog } from '../../utils/api';
import { X, Send, FlaskConical, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import './PushToLabModal.css';

const statusIcon = {
  success: <CheckCircle size={14} color="#2ECC71"/>,
  failed:  <XCircle    size={14} color="#E74C3C"/>,
  pending: <Clock      size={14} color="#F39C12"/>,
  partial: <AlertTriangle size={14} color="#E67E22"/>,
};
const statusColor = {
  success:'badge-success', failed:'badge-danger', pending:'badge-warning', partial:'badge-warning'
};

export default function PushToLabModal({ booking, onClose, onPushed }) {
  const [labs,      setLabs]      = useState([]);
  const [pushLog,   setPushLog]   = useState([]);
  const [selLabId,  setSelLabId]  = useState('');
  const [dryRun,    setDryRun]    = useState(false);
  const [pushing,   setPushing]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [result,    setResult]    = useState(null);
  const [showLog,   setShowLog]   = useState(false);

  useEffect(() => {
    Promise.all([getLabs(), getPushLog(booking.id)]).then(([l, pl]) => {
      setLabs(l.data.labs.filter(lab => lab.is_active));
      setPushLog(pl.data.logs);
      if (l.data.labs.length) setSelLabId(l.data.labs[0].id);
    }).finally(() => setLoading(false));
  }, [booking.id]);

  const handlePush = async () => {
    if (!selLabId) return toast.error('Select a lab');
    setPushing(true);
    setResult(null);
    try {
      const res = await pushToLab(booking.id, { lab_id: selLabId, dry_run: dryRun });
      setResult(res.data);
      if (res.data.success) {
        toast.success(dryRun ? 'Dry run complete — no data sent' : `Pushed to ${res.data.lab?.name}!`);
        onPushed?.();
        // Refresh push log
        getPushLog(booking.id).then(pl => setPushLog(pl.data.logs));
      } else {
        toast.error(res.data.message || 'Push failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Push failed';
      toast.error(msg);
      setResult({ success: false, message: msg });
    } finally {
      setPushing(false);
    }
  };

  const selectedLab = labs.find(l => String(l.id) === String(selLabId));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ptl-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Push to Third-Party Lab</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              #{booking.booking_number} — {booking.patient_name}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-container" style={{ padding:48 }}><div className="spinner"/></div>
          ) : (
            <>
              {/* Previous push status */}
              {booking.push_status && booking.push_status !== 'not_pushed' && (
                <div className={`ptl-current-status ${booking.push_status}`}>
                  {statusIcon[booking.push_status] || <Clock size={14}/>}
                  <span>
                    Previously <strong>{booking.push_status}</strong>
                    {booking.external_booking_ref && <> — Ext. Ref: <code>{booking.external_booking_ref}</code></>}
                  </span>
                </div>
              )}

              {/* Lab selection */}
              {labs.length === 0 ? (
                <div className="empty-state" style={{ padding:'32px 0' }}>
                  <FlaskConical size={36}/>
                  <h3>No labs configured</h3>
                  <p>Add a third-party lab in the Labs section first</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Select Destination Lab *</label>
                    <div className="ptl-lab-list">
                      {labs.map(lab => (
                        <label key={lab.id} className={`ptl-lab-option ${String(selLabId) === String(lab.id) ? 'selected' : ''}`}>
                          <input type="radio" name="lab" value={lab.id} checked={String(selLabId) === String(lab.id)}
                            onChange={() => setSelLabId(lab.id)} hidden/>
                          <div className="ptl-lab-radio"/>
                          <div className="ptl-lab-info">
                            <div className="ptl-lab-name">{lab.name}</div>
                            <div className="ptl-lab-meta">
                              <code>{lab.code}</code> · {lab.api_base_url}{lab.booking_endpoint}
                            </div>
                          </div>
                          <span className="badge badge-info" style={{ fontSize:10 }}>{lab.auth_type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Booking summary for review */}
                  <div className="ptl-summary">
                    <div className="ptl-summary-title">Booking Summary</div>
                    <div className="ptl-summary-row"><span>Patient</span><span>{booking.patient_name} · {booking.patient_phone}</span></div>
                    <div className="ptl-summary-row"><span>Tests</span><span style={{ maxWidth:280, textAlign:'right', fontSize:12 }}>{booking.tests}</span></div>
                    <div className="ptl-summary-row"><span>Collection</span><span style={{ textTransform:'capitalize' }}>{booking.collection_type}{booking.collection_date ? ` · ${new Date(booking.collection_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}` : ''}</span></div>
                    <div className="ptl-summary-row"><span>Amount</span><span style={{ fontFamily:'Space Mono,monospace', fontWeight:700 }}>₹{parseFloat(booking.final_amount).toFixed(0)}</span></div>
                  </div>

                  {/* Dry run toggle */}
                  <label className="ptl-dryrun-toggle">
                    <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)}/>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>Dry Run (no data sent)</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>Preview the payload without actually calling the lab API</div>
                    </div>
                  </label>

                  {/* Result */}
                  {result && (
                    <div className={`ptl-result ${result.success ? 'success' : 'error'}`}>
                      {result.success ? <CheckCircle size={18}/> : <XCircle size={18}/>}
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{result.message}</div>
                        {result.external_ref && <div style={{ fontSize:12, marginTop:4 }}>External Ref: <code>{result.external_ref}</code></div>}
                        {result.dry_run && result.payload && (
                          <details style={{ marginTop:8 }}>
                            <summary style={{ cursor:'pointer', fontSize:12, color:'var(--text-muted)' }}>View payload</summary>
                            <pre style={{ fontSize:11, marginTop:8, padding:'8px', background:'rgba(0,0,0,0.05)', borderRadius:6, overflow:'auto', maxHeight:200 }}>
                              {JSON.stringify(result.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Push History */}
              {pushLog.length > 0 && (
                <div className="ptl-log-section">
                  <button className="ptl-log-toggle" onClick={() => setShowLog(!showLog)}>
                    <span>Push History ({pushLog.length})</span>
                    {showLog ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </button>
                  {showLog && (
                    <div className="ptl-log-list">
                      {pushLog.map(log => (
                        <div key={log.id} className="ptl-log-item">
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {statusIcon[log.push_status] || <Clock size={13}/>}
                            <span style={{ fontWeight:600, fontSize:13 }}>{log.lab_name}</span>
                            <span className={`badge ${statusColor[log.push_status]||'badge-muted'}`} style={{ fontSize:10 }}>{log.push_status}</span>
                            {log.http_status && <code style={{ fontSize:10, color:'var(--text-muted)' }}>HTTP {log.http_status}</code>}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                            {new Date(log.pushed_at).toLocaleString('en-IN')}
                            {log.external_ref && <> · Ext: <code>{log.external_ref}</code></>}
                            {log.error_message && <> · <span style={{ color:'var(--danger)' }}>{log.error_message.substring(0,80)}</span></>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          {labs.length > 0 && (
            <button
              className={`btn ${dryRun ? 'btn-outline' : 'btn-primary'}`}
              onClick={handlePush}
              disabled={pushing || !selLabId}
            >
              <Send size={14}/>
              {pushing ? 'Pushing…' : dryRun ? 'Dry Run' : `Push to ${selectedLab?.name || 'Lab'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}