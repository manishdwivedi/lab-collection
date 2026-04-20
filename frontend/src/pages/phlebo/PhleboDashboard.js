import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyAssignments, markSampleCollected } from '../../utils/api';
import {
  MapPin, Clock, Phone, FlaskConical,
  CheckCircle, CalendarCheck, ChevronRight,
  User, AlertCircle
} from 'lucide-react';
import './PhleboDashboard.css';

const statusColor = {
  pending:          'badge-warning',
  confirmed:        'badge-info',
  sample_collected: 'badge-success',
  processing:       'badge-info',
  completed:        'badge-success',
  cancelled:        'badge-danger',
};

const statusLabel = {
  pending:          'Pending',
  confirmed:        'Confirmed',
  sample_collected: 'Sample Collected',
  processing:       'Processing',
  completed:        'Completed',
  cancelled:        'Cancelled',
};

function BookingCard({ booking, onMarkCollected }) {
  const isCollected = ['sample_collected', 'processing', 'completed'].includes(booking.booking_status);
  const isCancelled = booking.booking_status === 'cancelled';

  return (
    <div className={`phlebo-booking-card ${isCollected ? 'collected' : ''} ${isCancelled ? 'cancelled' : ''}`}>
      {/* Time strip */}
      <div className="pbc-time-strip">
        <Clock size={13}/>
        <span>{booking.collection_time || 'Time not set'}</span>
        <span className={`badge ${statusColor[booking.booking_status] || 'badge-muted'}`} style={{ marginLeft: 'auto', fontSize: 10 }}>
          {statusLabel[booking.booking_status] || booking.booking_status}
        </span>
      </div>

      <div className="pbc-body">
        {/* Patient info */}
        <div className="pbc-patient">
          <div className="pbc-patient-avatar">
            <User size={16}/>
          </div>
          <div>
            <div className="pbc-patient-name">{booking.patient_name}</div>
            <a className="pbc-patient-phone" href={`tel:${booking.patient_phone}`}>
              <Phone size={12}/> {booking.patient_phone}
            </a>
          </div>
          <div className="pbc-booking-num">{booking.booking_number}</div>
        </div>

        {/* Tests */}
        <div className="pbc-tests">
          <FlaskConical size={13}/>
          <span>{booking.tests || 'No tests listed'}</span>
        </div>

        {/* Address */}
        {booking.collection_address && (
          <a
            className="pbc-address"
            href={`https://maps.google.com/?q=${encodeURIComponent(booking.collection_address)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={13}/>
            <span>{booking.collection_address}</span>
          </a>
        )}

        {/* Actions */}
        {!isCancelled && !isCollected && (
          <button
            className="btn btn-primary btn-sm pbc-collect-btn"
            onClick={() => onMarkCollected(booking.id)}
          >
            <CheckCircle size={13}/>
            Mark Sample Collected
          </button>
        )}
        {isCollected && (
          <div className="pbc-done-badge">
            <CheckCircle size={14}/> Sample collected
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhleboDashboard() {
  const { user }               = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [marking,     setMarking]     = useState(null);
  const today = new Date().toISOString().split('T')[0];

  const fetchData = () => {
    setLoading(true);
    getMyAssignments({ date: today })
      .then(r => setAssignments(r.data.assignments || []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleMarkCollected = async (bookingId) => {
    setMarking(bookingId);
    try {
      await markSampleCollected(bookingId);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update status. Please contact the lab.';
      alert(msg);
    } finally {
      setMarking(null);
    }
  };

  const pending   = assignments.filter(a => ['pending','confirmed'].includes(a.booking_status));
  const collected = assignments.filter(a => ['sample_collected','processing','completed'].includes(a.booking_status));
  const cancelled = assignments.filter(a => a.booking_status === 'cancelled');

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="phlebo-dashboard">
      {/* Welcome header */}
      <div className="pd-welcome">
        <div>
          <h1 className="pd-welcome-title">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}!</h1>
          <div className="pd-welcome-date">{todayFormatted}</div>
        </div>
        <Link to="/phlebo/assignments" className="btn btn-outline pd-all-btn">
          View All <ChevronRight size={14}/>
        </Link>
      </div>

      {/* Stats */}
      <div className="pd-stats">
        {[
          { label: "Today's Jobs",  val: assignments.length,   color: '#3498DB' },
          { label: 'Pending',       val: pending.length,       color: '#E67E22' },
          { label: 'Collected',     val: collected.length,     color: '#2ECC71' },
          { label: 'Cancelled',     val: cancelled.length,     color: '#E74C3C' },
        ].map((s, i) => (
          <div key={i} className="pd-stat-card" style={{ borderTopColor: s.color }}>
            <div className="pd-stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="pd-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today's bookings */}
      <div className="pd-section-title">
        <CalendarCheck size={16}/>
        Today's Home Collection Schedule
      </div>

      {loading ? (
        <div className="loading-container" style={{ padding: 60 }}>
          <div className="spinner"/>
        </div>
      ) : assignments.length === 0 ? (
        <div className="pd-empty">
          <CalendarCheck size={48}/>
          <h3>No assignments today</h3>
          <p>You have no home collection bookings scheduled for today. Check the <Link to="/phlebo/assignments">All Assignments</Link> page for upcoming jobs.</p>
        </div>
      ) : (
        <>
          {/* Pending section */}
          {pending.length > 0 && (
            <div className="pd-group">
              <div className="pd-group-label pending">
                <AlertCircle size={13}/> Pending — {pending.length} booking{pending.length !== 1 ? 's' : ''}
              </div>
              {pending.map(b => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onMarkCollected={handleMarkCollected}
                />
              ))}
            </div>
          )}

          {/* Collected section */}
          {collected.length > 0 && (
            <div className="pd-group">
              <div className="pd-group-label done">
                <CheckCircle size={13}/> Collected — {collected.length} booking{collected.length !== 1 ? 's' : ''}
              </div>
              {collected.map(b => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onMarkCollected={handleMarkCollected}
                />
              ))}
            </div>
          )}

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <div className="pd-group">
              <div className="pd-group-label cancelled">
                Cancelled — {cancelled.length}
              </div>
              {cancelled.map(b => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onMarkCollected={handleMarkCollected}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}