import React, { useState, useEffect } from 'react';
import { getMyAssignments } from '../../utils/api';
import {
  CalendarCheck, MapPin, Clock, Phone, FlaskConical,
  ChevronDown, ChevronUp, Search, User, CheckCircle
} from 'lucide-react';
import './PhleBoAssignments.css';

const statusColor = {
  pending:'badge-warning', confirmed:'badge-info',
  sample_collected:'badge-success', processing:'badge-info',
  completed:'badge-success', cancelled:'badge-danger',
};

const statusLabel = {
  pending:'Pending', confirmed:'Confirmed',
  sample_collected:'Sample Collected', processing:'Processing',
  completed:'Completed', cancelled:'Cancelled',
};

function AssignmentRow({ booking }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="assignment-row">
      {/* Summary row — always visible */}
      <div className="ar-summary" onClick={() => setExpanded(!expanded)}>
        <div className="ar-date-col">
          {booking.collection_date
            ? <div>
                <div className="ar-day">{new Date(booking.collection_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</div>
                <div className="ar-time">{booking.collection_time || '—'}</div>
              </div>
            : <div className="ar-day">Unscheduled</div>
          }
        </div>
        <div className="ar-main">
          <div className="ar-patient">{booking.patient_name}</div>
          <div className="ar-tests">{booking.tests || '—'}</div>
        </div>
        <div className="ar-right">
          <span className={`badge ${statusColor[booking.booking_status] || 'badge-muted'}`}>
            {statusLabel[booking.booking_status] || booking.booking_status}
          </span>
          <span className="ar-num">{booking.booking_number}</span>
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="ar-detail">
          <div className="ar-detail-grid">
            <div className="ar-detail-item">
              <Phone size={13}/>
              <a href={`tel:${booking.patient_phone}`}>{booking.patient_phone}</a>
            </div>
            {booking.collection_address && (
              <div className="ar-detail-item">
                <MapPin size={13}/>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.collection_address)}`} target="_blank" rel="noreferrer">
                  {booking.collection_address}
                </a>
              </div>
            )}
            {booking.patient_address && !booking.collection_address && (
              <div className="ar-detail-item">
                <MapPin size={13}/>
                <span>{booking.patient_address}</span>
              </div>
            )}
            <div className="ar-detail-item">
              <FlaskConical size={13}/>
              <span>{booking.tests}</span>
            </div>
          </div>
          {['sample_collected','processing','completed'].includes(booking.booking_status) && (
            <div className="ar-collected-note">
              <CheckCircle size={13}/> Sample has been collected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PhleBoAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dateFilter,  setDateFilter]  = useState('');
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('');

  const fetchData = (date) => {
    setLoading(true);
    getMyAssignments(date ? { date } : {})
      .then(r => setAssignments(r.data.assignments || []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleDateChange = (e) => {
    setDateFilter(e.target.value);
    fetchData(e.target.value || undefined);
  };

  // Client-side filter for search and status
  const filtered = assignments.filter(a => {
    const matchSearch = !search
      || a.patient_name?.toLowerCase().includes(search.toLowerCase())
      || a.booking_number?.toLowerCase().includes(search.toLowerCase())
      || a.patient_phone?.includes(search);
    const matchStatus = !statusFilter || a.booking_status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Group by date
  const grouped = filtered.reduce((acc, a) => {
    const key = a.collection_date
      ? new Date(a.collection_date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
      : 'Unscheduled';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const todayKey = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return (
    <div className="phlebo-assignments">
      <div className="page-header">
        <div>
          <div className="page-title">All Assignments</div>
          <div className="page-subtitle">All your home-collection bookings</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:20 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <div className="search-bar" style={{ flex:2, minWidth:180 }}>
            <Search size={15}/>
            <input
              className="form-control"
              placeholder="Search patient name, phone, booking #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <input
            className="form-control"
            type="date"
            value={dateFilter}
            onChange={handleDateChange}
            style={{ flex:1, minWidth:140 }}
          />
          <select
            className="form-control"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ flex:1, minWidth:160 }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="sample_collected">Sample Collected</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {(dateFilter || search || statusFilter) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setDateFilter(''); setSearch(''); setStatusFilter(''); fetchData(); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="loading-container" style={{ padding:60 }}><div className="spinner"/></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <CalendarCheck size={48}/>
          <h3>No assignments found</h3>
          <p>{dateFilter ? 'No bookings on this date.' : 'You have no assignments yet.'}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([dateLabel, items]) => (
          <div key={dateLabel} className="pa-date-group">
            <div className={`pa-date-header ${dateLabel === todayKey ? 'today' : ''}`}>
              <CalendarCheck size={14}/>
              {dateLabel}
              {dateLabel === todayKey && <span className="today-pill">Today</span>}
              <span className="pa-date-count">{items.length} booking{items.length !== 1 ? 's' : ''}</span>
            </div>
            {items.map(b => <AssignmentRow key={b.id} booking={b}/>)}
          </div>
        ))
      )}
    </div>
  );
}