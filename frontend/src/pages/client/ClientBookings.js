import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClientBookings } from '../../utils/api';
import { Search, Filter, CalendarCheck, ChevronRight, FileText, Plus } from 'lucide-react';

const statusOpts = ['pending','confirmed','sample_collected','processing','completed','cancelled'];
const statusColor = {
  pending:'badge-warning', confirmed:'badge-info', sample_collected:'badge-info',
  processing:'badge-info', completed:'badge-success', cancelled:'badge-danger'
};

export default function ClientBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filters,  setFilters]  = useState({ search:'', status:'', date_from:'', date_to:'' });

  const fetchData = () => {
    setLoading(true);
    getClientBookings(filters).then(r => { setBookings(r.data.bookings); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const h = e => setFilters({ ...filters, [e.target.name]: e.target.value });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Bookings</div>
          <div className="page-subtitle">All bookings for your organisation</div>
        </div>
        <Link to="/client/new" className="btn btn-primary">
          <Plus size={15}/> New Booking
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:20, padding:'16px 20px' }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <div className="search-bar" style={{ flex:2, minWidth:200 }}>
            <Search size={15}/>
            <input className="form-control" name="search" placeholder="Search booking # or patient…"
              value={filters.search} onChange={h}/>
          </div>
          <select className="form-control" name="status" value={filters.status} onChange={h} style={{ flex:1, minWidth:140 }}>
            <option value="">All Statuses</option>
            {statusOpts.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <input className="form-control" type="date" name="date_from" value={filters.date_from} onChange={h} style={{ flex:1 }}/>
          <input className="form-control" type="date" name="date_to"   value={filters.date_to}   onChange={h} style={{ flex:1 }}/>
          <button className="btn btn-primary" onClick={fetchData}><Filter size={14}/> Filter</button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner"/></div> : (
          <>
            {bookings.length === 0 ? (
              <div className="empty-state">
                <CalendarCheck size={44}/>
                <h3>No bookings found</h3>
                <p>Try adjusting filters or create a new booking</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Booking #</th><th>Patient</th><th>Tests</th>
                      <th>Collection</th><th>Phlebo</th><th>Status</th>
                      <th>Amount</th><th>Report</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.id}>
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
                        <td style={{ fontSize:12 }}>{b.phlebo_name || <span style={{ color:'var(--text-muted)' }}>Unassigned</span>}</td>
                        <td><span className={`badge ${statusColor[b.booking_status]||'badge-muted'}`}>{b.booking_status?.replace(/_/g,' ')}</span></td>
                        <td style={{ fontWeight:700, fontFamily:'Space Mono,monospace', fontSize:13 }}>₹{parseFloat(b.final_amount).toFixed(0)}</td>
                        <td>
                          {b.report_status === 'ready'
                            ? <span className="badge badge-success"><FileText size={10}/> Ready</span>
                            : <span style={{ color:'var(--text-muted)', fontSize:11 }}>Pending</span>}
                        </td>
                        <td>
                          <Link to={`/client/bookings/${b.id}`} className="btn btn-outline btn-sm">
                            <ChevronRight size={13}/>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}