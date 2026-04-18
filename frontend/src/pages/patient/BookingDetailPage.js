import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBooking, getBookingReports } from '../../utils/api';
import {
  ArrowLeft, User, MapPin, TestTube, CreditCard,
  FileText, Download, Image as ImageIcon, Loader, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import './BookingDetailPage.css';

const statusColors = {
  pending: 'badge-warning', confirmed: 'badge-info', sample_collected: 'badge-info',
  processing: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger'
};
const payColors = { pending: 'badge-warning', paid: 'badge-success', failed: 'badge-danger' };

const ICON_MAP = {
  'application/pdf': <FileText  size={22} color="#E74C3C"/>,
  'image/jpeg':      <ImageIcon size={22} color="#3498DB"/>,
  'image/png':       <ImageIcon size={22} color="#3498DB"/>,
  'image/webp':      <ImageIcon size={22} color="#3498DB"/>,
};

const fmt = (bytes) => {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function ReportCard({ report }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`/api/reports/${report.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = report.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded!');
    } catch {
      toast.error('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="report-card">
      <div className="rc-icon">
        {ICON_MAP[report.mime_type] || <FileText size={22}/>}
      </div>
      <div className="rc-info">
        <div className="rc-name">{report.file_name}</div>
        <div className="rc-meta">
          {fmt(report.file_size)}&nbsp;·&nbsp;Available since&nbsp;
          {new Date(report.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}
        </div>
        {report.notes && <div className="rc-notes">📝 {report.notes}</div>}
      </div>
      <button
        className="btn btn-primary btn-sm rc-download"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading
          ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }}/>
          : <Download size={13}/>
        }
        {downloading ? 'Downloading…' : 'Download'}
      </button>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const [booking,    setBooking]    = useState(null);
  const [reports,    setReports]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingRep, setLoadingRep] = useState(true);

  useEffect(() => {
    getBooking(id)
      .then(r => setBooking(r.data.booking))
      .finally(() => setLoading(false));

    getBookingReports(id)
      .then(r => setReports(r.data.reports))
      .catch(() => {})
      .finally(() => setLoadingRep(false));
  }, [id]);

  if (loading) return <div className="loading-container"><div className="spinner"/></div>;
  if (!booking) return <div className="empty-state"><h3>Booking not found</h3></div>;

  const hasReports = reports.length > 0;

  return (
    <div className="booking-detail-page">
      <Link to="/my-bookings" className="btn btn-outline btn-sm back-btn">
        <ArrowLeft size={14}/> Back to Bookings
      </Link>

      <div className="bd-header">
        <div>
          <h1 className="bd-title">Booking #{booking.booking_number}</h1>
          <p className="bd-date">
            {new Date(booking.created_at).toLocaleString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>
        <div className="bd-badges">
          <span className={`badge ${statusColors[booking.booking_status] || 'badge-muted'}`}>
            {booking.booking_status?.replace(/_/g, ' ')}
          </span>
          <span className={`badge ${payColors[booking.payment_status] || 'badge-muted'}`}>
            {booking.payment_status}
          </span>
          {hasReports && <span className="badge badge-success">📄 Reports Ready</span>}
        </div>
      </div>

      <div className="bd-body">

        {/* Reports */}
        <div className="card bd-reports-card">
          <div className="bd-section-title">
            <FileText size={16}/>
            Lab Reports
            {hasReports && (
              <span className="reports-ready-pill">
                <CheckCircle size={12}/>
                {reports.length} Report{reports.length > 1 ? 's' : ''} Available
              </span>
            )}
          </div>

          {loadingRep ? (
            <div className="reports-loading">
              <Loader size={20} style={{ animation: 'spin 0.8s linear infinite' }}/>
              <span>Loading reports…</span>
            </div>
          ) : hasReports ? (
            <div className="reports-list">
              {reports.map(r => <ReportCard key={r.id} report={r}/>)}
            </div>
          ) : (
            <div className="reports-pending">
              <div className="rp-icon"><FileText size={36}/></div>
              <div className="rp-text">
                <strong>Reports not uploaded yet</strong>
                <p>
                  {booking.booking_status === 'completed'
                    ? 'Your results are being finalized. Reports will appear here once ready.'
                    : booking.booking_status === 'processing'
                    ? 'Your sample is being analyzed. Reports will be available shortly.'
                    : 'Reports will be uploaded here once your sample has been collected and analyzed.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Patient Info */}
        <div className="card">
          <div className="bd-section-title"><User size={16}/> Patient Info</div>
          <div className="grid-2">
            {[
              ['Name',   booking.patient_name],
              ['Phone',  booking.patient_phone],
              ['Age',    booking.patient_age ? `${booking.patient_age} years` : '—'],
              ['Gender', booking.patient_gender || '—'],
            ].map(([l, v]) => (
              <div key={l} className="bd-field">
                <div className="bd-field-label">{l}</div>
                <div className="bd-field-value">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Collection */}
        <div className="card">
          <div className="bd-section-title"><MapPin size={16}/> Collection Details</div>
          <div className="grid-2">
            {[
              ['Type', booking.collection_type],
              ['Date', booking.collection_date
                ? new Date(booking.collection_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'],
              ['Time', booking.collection_time || '—'],
            ].map(([l, v]) => (
              <div key={l} className="bd-field">
                <div className="bd-field-label">{l}</div>
                <div className="bd-field-value" style={{ textTransform: 'capitalize' }}>{v}</div>
              </div>
            ))}
          </div>
          {booking.collection_address && (
            <div className="bd-field" style={{ marginTop: 12 }}>
              <div className="bd-field-label">Collection Address</div>
              <div className="bd-field-value">{booking.collection_address}</div>
            </div>
          )}
        </div>

        {/* Tests */}
        <div className="card">
          <div className="bd-section-title"><TestTube size={16}/> Tests Ordered</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Test Name</th><th>Code</th><th style={{ textAlign:'right' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {booking.items?.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.test_name}</td>
                    <td>
                      <code style={{ fontSize:11, background:'var(--surface2)', padding:'2px 6px', borderRadius:4 }}>
                        {item.test_code}
                      </code>
                    </td>
                    <td style={{ textAlign:'right', fontWeight:700 }}>
                      ₹{parseFloat(item.total_price).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment */}
        <div className="card">
          <div className="bd-section-title"><CreditCard size={16}/> Payment</div>
          <div className="bd-payment-row">
            <div className="bd-field-label">Total Amount Paid</div>
            <div className="bd-total">₹{parseFloat(booking.final_amount).toFixed(0)}</div>
          </div>
          {booking.payment_id && (
            <div className="bd-payment-id">Payment ID: <code>{booking.payment_id}</code></div>
          )}
        </div>

      </div>
    </div>
  );
}