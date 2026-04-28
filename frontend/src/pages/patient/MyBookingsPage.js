import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyBookings } from '../../utils/api';
import {
  CalendarCheck, ChevronRight, FlaskConical,
  FileText, Clock, CheckCircle, XCircle,
  AlertCircle, Search, Filter,
} from 'lucide-react';
import './BookingHistory.css';

const STATUS_MAP = {
  pending:          { label: 'Pending',          color: 'badge-warning', icon: Clock },
  confirmed:        { label: 'Confirmed',         color: 'badge-info',    icon: CheckCircle },
  sample_collected: { label: 'Sample Collected',  color: 'badge-info',    icon: CheckCircle },
  processing:       { label: 'Processing',        color: 'badge-info',    icon: Clock },
  completed:        { label: 'Completed',         color: 'badge-success', icon: CheckCircle },
  cancelled:        { label: 'Cancelled',         color: 'badge-danger',  icon: XCircle },
};
const PAY_MAP = {
  pending: 'badge-warning',
  paid:    'badge-success',
  failed:  'badge-danger',
};

export default function MyBookingsPage() {
  const { user }                 = useAuth();
  const location                 = useLocation();
  const [bookings,  setBookings] = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [search,    setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // If user just arrived from payment success, show a welcome banner
  const fromPayment = location.state?.fromPayment;

  useEffect(() => {
    getMyBookings()
      .then(r => setBookings(r.data.bookings || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.booking_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.tests?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || b.booking_status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="loading-container" style={{ padding: 80 }}><div className="spinner"/></div>;

  return (
    <div className="my-bookings-page">
      {/* Header */}
      <div className="page-header-bg">
        <div className="page-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CalendarCheck size={28}/>
            <div>
              <h1 style={{ margin: 0 }}>My Bookings</h1>
              <p style={{ margin: 0, opacity: 0.8 }}>Track your tests and download reports</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bookings-container">
        {/* Welcome back banner if arriving from payment */}
        {fromPayment && (
          <div className="booking-welcome-banner">
            <CheckCircle size={20} color="#2ECC71"/>
            <span>Your booking has been saved to your account! You can track it below.</span>
          </div>
        )}

        {bookings.length === 0 ? (
          /* Empty state */
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <FlaskConical size={56}/>
            <h3>No bookings yet</h3>
            <p>
              {user
                ? 'Once you book a test, it will appear here. Track status, view reports, and more.'
                : 'Log in and your booking history will appear here.'}
            </p>
            <Link to="/tests" className="btn btn-primary" style={{ marginTop: 16 }}>
              Browse Tests
            </Link>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="bookings-filters">
              <div className="search-bar" style={{ flex: 2, minWidth: 200 }}>
                <Search size={14}/>
                <input
                  className="form-control"
                  placeholder="Search by booking number or test name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-control"
                style={{ flex: 1, minWidth: 160 }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Stats strip */}
            <div className="bookings-stats">
              {[
                { label: 'Total', count: bookings.length, color: 'var(--primary)' },
                { label: 'Active', count: bookings.filter(b => ['pending','confirmed','sample_collected','processing'].includes(b.booking_status)).length, color: '#3498DB' },
                { label: 'Completed', count: bookings.filter(b => b.booking_status === 'completed').length, color: '#2ECC71' },
                { label: 'Reports Ready', count: bookings.filter(b => b.report_status === 'ready').length, color: '#9B59B6' },
              ].map(s => (
                <div key={s.label} className="bstat">
                  <div className="bstat-val" style={{ color: s.color }}>{s.count}</div>
                  <div className="bstat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Bookings list */}
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <AlertCircle size={32}/>
                <p>No bookings match your search</p>
              </div>
            ) : (
              <div className="bookings-list">
                {filtered.map(b => {
                  const statusCfg = STATUS_MAP[b.booking_status] || { label: b.booking_status, color: 'badge-muted', icon: Clock };
                  const StatusIcon = statusCfg.icon;
                  return (
                    <Link to={`/bookings/${b.id}`} key={b.id} className="booking-row">
                      {/* Left: info */}
                      <div className="br-left">
                        <div className="br-number">{b.booking_number}</div>
                        <div className="br-tests">{b.tests || 'Tests loading…'}</div>
                        <div className="br-meta">
                          <span className="br-date">
                            {new Date(b.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                          {b.collection_date && (
                            <span className="br-collection">
                              · Collection: {new Date(b.collection_date).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short'
                              })}
                              {b.collection_time ? ` @ ${b.collection_time}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: badges + amount */}
                      <div className="br-right">
                        <div className="br-amount">₹{parseFloat(b.final_amount).toFixed(0)}</div>
                        <div className="br-badges">
                          <span className={`badge ${statusCfg.color}`} style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <StatusIcon size={10}/>
                            {statusCfg.label}
                          </span>
                          <span className={`badge ${PAY_MAP[b.payment_status] || 'badge-muted'}`}>
                            {b.payment_status}
                          </span>
                          {b.report_status === 'ready' && (
                            <span className="badge badge-success" style={{ display:'flex', alignItems:'center', gap:3 }}>
                              <FileText size={10}/> Reports
                            </span>
                          )}
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}