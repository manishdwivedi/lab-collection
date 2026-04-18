import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyBookings } from '../../utils/api';
import { CalendarCheck, ChevronRight, FlaskConical, FileText } from 'lucide-react';
import './BookingHistory.css';

const statusColors = {
  pending: 'badge-warning', confirmed: 'badge-info', sample_collected: 'badge-info',
  processing: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger'
};
const payColors = { pending: 'badge-warning', paid: 'badge-success', failed: 'badge-danger' };

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getMyBookings()
      .then(r => setBookings(r.data.bookings))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;

  return (
    <div className="my-bookings-page">
      <div className="page-header-bg">
        <div className="page-header-inner">
          <h1><CalendarCheck size={24}/> My Bookings</h1>
          <p>Track your test bookings and download reports</p>
        </div>
      </div>

      <div className="bookings-container">
        {bookings.length === 0 ? (
          <div className="empty-state">
            <FlaskConical size={48}/>
            <h3>No bookings yet</h3>
            <p>Book your first test and see it here</p>
            <Link to="/tests" className="btn btn-primary" style={{ marginTop: 16 }}>Browse Tests</Link>
          </div>
        ) : (
          <div className="bookings-list">
            {bookings.map(b => (
              <Link to={`/bookings/${b.id}`} key={b.id} className="booking-row">
                <div className="br-left">
                  <div className="br-number">{b.booking_number}</div>
                  <div className="br-tests">{b.tests}</div>
                  <div className="br-date">
                    {new Date(b.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </div>
                </div>

                <div className="br-right">
                  <div className="br-amount">₹{parseFloat(b.final_amount).toFixed(0)}</div>
                  <span className={`badge ${statusColors[b.booking_status] || 'badge-muted'}`}>
                    {b.booking_status?.replace(/_/g, ' ')}
                  </span>
                  <span className={`badge ${payColors[b.payment_status] || 'badge-muted'}`}>
                    {b.payment_status}
                  </span>
                  {b.report_status === 'ready' && (
                    <span className="badge badge-success reports-badge">
                      <FileText size={11}/> Reports
                    </span>
                  )}
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }}/>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}