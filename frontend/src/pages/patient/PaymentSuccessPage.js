// PaymentSuccessPage.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, Home, List } from 'lucide-react';

export function PaymentSuccessPage() {
  const { state } = useLocation();
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 80, height: 80, background: '#D5F5E3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle size={40} color="#2ECC71"/>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>Payment Successful!</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Your booking has been confirmed.</p>
        <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '16px 24px', marginBottom: 32, display: 'inline-block' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Booking Number</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Space Mono, monospace' }}>{state?.bookingNumber}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>₹{parseFloat(state?.totalAmount || 0).toFixed(0)} Paid</div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>Our team will contact you to confirm the collection schedule. Reports will be shared digitally.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/my-bookings" className="btn btn-primary"><List size={16}/> My Bookings</Link>
          <Link to="/" className="btn btn-outline"><Home size={16}/> Go Home</Link>
        </div>
      </div>
    </div>
  );
}
export default PaymentSuccessPage;
