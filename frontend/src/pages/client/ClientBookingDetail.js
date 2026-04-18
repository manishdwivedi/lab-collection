import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getClientBooking } from '../../utils/api';
import { ArrowLeft, User, MapPin, TestTube, CreditCard, FileText, Download, UserCheck, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

const statusColor = {
  pending:'badge-warning', confirmed:'badge-info', sample_collected:'badge-info',
  processing:'badge-info', completed:'badge-success', cancelled:'badge-danger'
};
const payColor = { pending:'badge-warning', paid:'badge-success', failed:'badge-danger' };

const fmt = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

function ReportRow({ report }) {
  const [dl, setDl] = useState(false);
  const download = async () => {
    setDl(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`/api/reports/${report.id}/download`, { headers:{ Authorization:`Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = report.file_name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Downloaded!');
    } catch { toast.error('Download failed'); }
    finally { setDl(false); }
  };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:'1.5px solid var(--border)', borderRadius:10, background:'white', transition:'border-color .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
    >
      <div style={{ width:38, height:38, background:'var(--surface2)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <FileText size={18} color="#E74C3C"/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{report.file_name}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
          {fmt(report.file_size)} · {new Date(report.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
        </div>
        {report.notes && <div style={{ fontSize:11, color:'var(--text)', marginTop:2, fontStyle:'italic' }}>📝 {report.notes}</div>}
      </div>
      <button className="btn btn-primary btn-sm" onClick={download} disabled={dl}>
        {dl ? <Loader size={12} style={{ animation:'spin .8s linear infinite' }}/> : <Download size={12}/>}
        {dl ? 'Downloading…' : 'Download'}
      </button>
    </div>
  );
}

export default function ClientBookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClientBooking(id).then(r => setBooking(r.data.booking)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;
  if (!booking) return <div className="empty-state"><h3>Booking not found</h3></div>;

  return (
    <div style={{ maxWidth:800 }}>
      <Link to="/client/bookings" className="btn btn-outline btn-sm" style={{ marginBottom:20 }}>
        <ArrowLeft size={14}/> Back to Bookings
      </Link>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:12, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--primary)', marginBottom:4 }}>#{booking.booking_number}</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>{new Date(booking.created_at).toLocaleString('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <span className={`badge ${statusColor[booking.booking_status]||'badge-muted'}`}>{booking.booking_status?.replace(/_/g,' ')}</span>
          <span className={`badge ${payColor[booking.payment_status]||'badge-muted'}`}>{booking.payment_status}</span>
          {booking.report_status === 'ready' && <span className="badge badge-success">📄 Reports Ready</span>}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Phlebotomist */}
        {booking.phlebo_name && (
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'var(--primary)', marginBottom:14 }}><UserCheck size={16}/> Assigned Phlebotomist</div>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
              {[['Name',booking.phlebo_name],['Code',booking.employee_code],['Phone',booking.phlebo_phone]].map(([l,v]) => v && (
                <div key={l}><div style={{ fontSize:11, color:'var(--text-muted)' }}>{l}</div><div style={{ fontWeight:600 }}>{v}</div></div>
              ))}
            </div>
          </div>
        )}

        {/* Reports */}
        <div className="card" style={{ borderTop:'4px solid var(--accent)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'var(--primary)', marginBottom:14 }}>
            <FileText size={16}/> Lab Reports
            {booking.reports?.length > 0 && <span style={{ background:'#D5F5E3', color:'#1E8449', fontSize:11, padding:'2px 8px', borderRadius:100, fontWeight:700, marginLeft:'auto' }}>✓ {booking.reports.length} Available</span>}
          </div>
          {booking.reports?.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {booking.reports.map(r => <ReportRow key={r.id} report={r}/>)}
            </div>
          ) : (
            <div style={{ padding:'20px 0', color:'var(--text-muted)', fontSize:14 }}>
              <FileText size={32} style={{ opacity:.3, display:'block', marginBottom:10 }}/>
              Reports will be uploaded here once results are ready.
            </div>
          )}
        </div>

        {/* Patient */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'var(--primary)', marginBottom:14 }}><User size={16}/> Patient Info</div>
          <div className="grid-2">
            {[['Name',booking.patient_name],['Phone',booking.patient_phone],['Age',booking.patient_age?`${booking.patient_age} yrs`:'—'],['Gender',booking.patient_gender||'—']].map(([l,v]) => (
              <div key={l}><div style={{ fontSize:11, color:'var(--text-muted)' }}>{l}</div><div style={{ fontWeight:600 }}>{v}</div></div>
            ))}
          </div>
        </div>

        {/* Collection */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'var(--primary)', marginBottom:14 }}><MapPin size={16}/> Collection</div>
          <div className="grid-2">
            {[['Type',booking.collection_type],['Date',booking.collection_date?new Date(booking.collection_date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}):'—'],['Time',booking.collection_time||'—']].map(([l,v]) => (
              <div key={l}><div style={{ fontSize:11, color:'var(--text-muted)' }}>{l}</div><div style={{ fontWeight:600, textTransform:'capitalize' }}>{v}</div></div>
            ))}
          </div>
        </div>

        {/* Tests */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'var(--primary)', marginBottom:14 }}><TestTube size={16}/> Tests</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Test</th><th>Code</th><th style={{ textAlign:'right' }}>Price</th></tr></thead>
              <tbody>
                {booking.items?.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontWeight:600 }}>{i.test_name}</td>
                    <td><code style={{ fontSize:11, background:'var(--surface2)', padding:'2px 6px', borderRadius:4 }}>{i.test_code}</code></td>
                    <td style={{ textAlign:'right', fontWeight:700 }}>₹{parseFloat(i.total_price).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'var(--primary)', marginBottom:14 }}><CreditCard size={16}/> Payment</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>Total Amount</span>
            <span style={{ fontSize:28, fontWeight:700, color:'var(--primary)', fontFamily:'Space Mono,monospace' }}>₹{parseFloat(booking.final_amount).toFixed(0)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}