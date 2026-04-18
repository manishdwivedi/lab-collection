import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClientBookings, getClientProfile } from '../../utils/api';
import { CalendarCheck, Plus, FileText, TrendingUp, Clock, CheckCircle, ArrowRight, Building2 } from 'lucide-react';
import './ClientDashboard.css';

const statusColor = {
  pending:'badge-warning', confirmed:'badge-info', sample_collected:'badge-info',
  processing:'badge-info', completed:'badge-success', cancelled:'badge-danger'
};
const payColor = { pending:'badge-warning', paid:'badge-success', failed:'badge-danger' };

export default function ClientDashboard() {
  const [bookings, setBookings] = useState([]);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      getClientBookings({ limit: 50 }),
      getClientProfile(),
    ]).then(([b, p]) => {
      setBookings(b.data.bookings);
      setProfile(p.data.client);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;

  const total     = bookings.length;
  const pending   = bookings.filter(b => ['pending','confirmed','sample_collected','processing'].includes(b.booking_status)).length;
  const completed = bookings.filter(b => b.booking_status === 'completed').length;
  const withRep   = bookings.filter(b => b.report_status === 'ready').length;
  const recent    = bookings.slice(0, 5);

  return (
    <div className="client-dashboard">
      {/* Welcome */}
      <div className="cd-welcome">
        <div className="cd-welcome-left">
          <div className="cd-welcome-icon"><Building2 size={22}/></div>
          <div>
            <h1 className="cd-welcome-title">Welcome back!</h1>
            <p className="cd-welcome-sub">
              {profile?.name || 'Client Organisation'} &nbsp;·&nbsp; Rate: <strong>{profile?.rate_list_name || 'Standard'}</strong>
            </p>
          </div>
        </div>
        <Link to="/client/new" className="btn btn-primary">
          <Plus size={15}/> New Booking
        </Link>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { label:'Total Bookings',    val: total,     icon: CalendarCheck, color:'#3498DB' },
          { label:'Active / Pending',  val: pending,   icon: Clock,         color:'#E67E22' },
          { label:'Completed',         val: completed, icon: CheckCircle,   color:'#2ECC71' },
          { label:'Reports Ready',     val: withRep,   icon: FileText,      color:'#9B59B6' },
        ].map((c, i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': c.color }}>
            <div className="stat-icon" style={{ background: c.color + '20' }}>
              <c.icon size={20} color={c.color}/>
            </div>
            <div className="stat-value" style={{ color: c.color }}>{c.val}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontWeight:700, fontSize:15, color:'var(--primary)' }}>Recent Bookings</span>
          <Link to="/client/bookings" className="btn btn-outline btn-sm">
            View All <ArrowRight size={13}/>
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state" style={{ padding:'40px 20px' }}>
            <CalendarCheck size={40}/>
            <h3>No bookings yet</h3>
            <p>Create your first booking to get started</p>
            <Link to="/client/new" className="btn btn-primary" style={{ marginTop:14 }}>Create Booking</Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Booking #</th><th>Patient</th><th>Tests</th>
                  <th>Collection</th><th>Phlebo</th><th>Status</th>
                  <th>Amount</th><th>Report</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(b => (
                  <tr key={b.id} style={{ cursor:'pointer' }} onClick={() => window.location.href=`/client/bookings/${b.id}`}>
                    <td><span style={{ fontFamily:'Space Mono,monospace', fontWeight:700, fontSize:12, color:'var(--primary)' }}>{b.booking_number}</span></td>
                    <td>
                      <div style={{ fontWeight:600, fontSize:13 }}>{b.patient_name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{b.patient_phone}</div>
                    </td>
                    <td style={{ fontSize:12, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-muted)' }}>{b.tests}</td>
                    <td style={{ fontSize:12 }}>
                      <div style={{ textTransform:'capitalize' }}>{b.collection_type}</div>
                      {b.collection_date && <div style={{ color:'var(--text-muted)' }}>{new Date(b.collection_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>}
                    </td>
                    <td style={{ fontSize:12 }}>{b.phlebo_name || <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                    <td><span className={`badge ${statusColor[b.booking_status]||'badge-muted'}`}>{b.booking_status?.replace(/_/g,' ')}</span></td>
                    <td style={{ fontWeight:700, fontFamily:'Space Mono,monospace', fontSize:13 }}>₹{parseFloat(b.final_amount).toFixed(0)}</td>
                    <td>{b.report_status === 'ready' ? <span className="badge badge-success">📄 Ready</span> : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}