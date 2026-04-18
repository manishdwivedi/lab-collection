import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../../utils/api';
import {
  TrendingUp, Users, Calendar, IndianRupee, CalendarCheck,
  ArrowRight, CheckCircle, Clock, XCircle, AlertCircle
} from 'lucide-react';
import './AdminDashboard.css';

const statusIcon = {
  pending: <Clock size={14}/>,
  confirmed: <CheckCircle size={14}/>,
  completed: <CheckCircle size={14}/>,
  cancelled: <XCircle size={14}/>,
  sample_collected: <AlertCircle size={14}/>,
  processing: <Clock size={14}/>,
};
const statusColor = {
  pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success',
  cancelled: 'badge-danger', sample_collected: 'badge-info', processing: 'badge-info'
};
const payColor = { pending: 'badge-warning', paid: 'badge-success', failed: 'badge-danger' };

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats().then(r => { setStats(r.data.stats); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;

  const statCards = [
    { label: "Today's Bookings", value: stats.today.today_bookings || 0, icon: CalendarCheck, color: '#3498DB' },
    { label: "Today's Revenue", value: `₹${parseFloat(stats.today.today_revenue || 0).toFixed(0)}`, icon: IndianRupee, color: '#2ECC71' },
    { label: 'This Month Revenue', value: `₹${parseFloat(stats.month.month_revenue || 0).toFixed(0)}`, icon: TrendingUp, color: '#9B59B6' },
    { label: 'Total Patients', value: stats.totalPatients || 0, icon: Users, color: '#E67E22' },
  ];

  return (
    <div className="admin-dashboard">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Overview of your diagnostics business</div>
        </div>
        <Link to="/admin/bookings" className="btn btn-primary btn-sm">
          <Calendar size={14}/> All Bookings
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': card.color }}>
            <div className="stat-icon" style={{ background: card.color + '20' }}>
              <card.icon size={22} color={card.color}/>
            </div>
            <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {/* Recent Bookings */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Bookings</span>
            <Link to="/admin/bookings" className="btn btn-outline btn-sm">
              View All <ArrowRight size={12}/>
            </Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Patient</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBookings.map(b => (
                  <tr key={b.booking_number}>
                    <td><span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{b.booking_number}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.patient_name}</div>
                      {b.client_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>via {b.client_name}</div>}
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'Space Mono, monospace' }}>₹{parseFloat(b.final_amount).toFixed(0)}</td>
                    <td><span className={`badge ${statusColor[b.booking_status] || 'badge-muted'}`}>{statusIcon[b.booking_status]} {b.booking_status?.replace('_', ' ')}</span></td>
                    <td><span className={`badge ${payColor[b.payment_status] || 'badge-muted'}`}>{b.payment_status}</span></td>
                  </tr>
                ))}
                {!stats.recentBookings.length && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No bookings yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Booking Status</span>
          </div>
          <div className="status-breakdown">
            {stats.statusBreakdown.map(s => (
              <div key={s.booking_status} className="sb-row">
                <div className="sb-label">
                  <span className={`badge ${statusColor[s.booking_status] || 'badge-muted'}`}>{s.booking_status?.replace('_', ' ')}</span>
                </div>
                <div className="sb-bar-wrap">
                  <div
                    className="sb-bar"
                    style={{ width: `${Math.min((s.count / (stats.total.total_bookings || 1)) * 100, 100)}%` }}
                  />
                </div>
                <div className="sb-count">{s.count}</div>
              </div>
            ))}
            {!stats.statusBreakdown.length && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No data yet</div>
            )}
          </div>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Bookings</span>
              <span style={{ fontWeight: 700, fontFamily: 'Space Mono, monospace' }}>{stats.total.total_bookings || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Revenue</span>
              <span style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'Space Mono, monospace' }}>₹{parseFloat(stats.total.total_revenue || 0).toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
