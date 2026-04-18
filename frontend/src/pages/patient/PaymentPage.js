import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { createPaymentOrder, verifyPayment } from '../../utils/api';
import { CreditCard, Shield, CheckCircle, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import './PaymentPage.css';

export default function PaymentPage() {
  const { bookingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { bookingNumber, totalAmount } = location.state || {};
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('upi');
  // console.log(totalAmount);
  const handlePayment = async () => {
    setLoading(true);
    try {
      await createPaymentOrder({ booking_id: bookingId });
      // Simulate payment success (in production, use Razorpay SDK)
      await verifyPayment({
        booking_id: bookingId,
        simulate_success: true,
      });
      navigate('/payment-success', { state: { bookingNumber, totalAmount } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods = [
    { id: 'upi', icon: Smartphone, label: 'UPI / QR Code', desc: 'PhonePe, GPay, Paytm' },
    { id: 'card', icon: CreditCard, label: 'Credit / Debit Card', desc: 'Visa, Mastercard, Rupay' },
    { id: 'netbanking', icon: Shield, label: 'Net Banking', desc: 'All major banks supported' },
  ];

  return (
    <div className="payment-page">
      <div className="payment-header">
        <div className="payment-header-inner">
          <h1>Complete Payment</h1>
          <p>Booking #{bookingNumber}</p>
        </div>
      </div>

      <div className="payment-container">
        <div className="payment-main">
          <div className="payment-card">
            <div className="payment-card-title"><CreditCard size={18}/> Select Payment Method</div>
            <div className="payment-methods">
              {paymentMethods.map(pm => (
                <label key={pm.id} className={`payment-method ${method === pm.id ? 'selected' : ''}`}>
                  <input type="radio" name="method" value={pm.id} checked={method === pm.id} onChange={() => setMethod(pm.id)} hidden/>
                  <div className="pm-radio"/>
                  <pm.icon size={22} className="pm-icon"/>
                  <div>
                    <div className="pm-label">{pm.label}</div>
                    <div className="pm-desc">{pm.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="payment-demo-notice">
              <Shield size={16}/>
              <div>
                <strong>Demo Mode</strong> — This is a simulated payment. In production, Razorpay gateway handles secure transactions.
              </div>
            </div>

            <button className="btn btn-primary btn-lg pay-btn" onClick={handlePayment} disabled={loading}>
              {loading ? 'Processing Payment...' : `Pay ₹${parseFloat(totalAmount || 0).toFixed(0)} Securely`}
            </button>

            <div className="payment-secure">
              <Shield size={14}/>
              <span>256-bit SSL encrypted secure payment</span>
            </div>
          </div>
        </div>

        <div className="payment-summary">
          <div className="pay-summary-card">
            <div className="ps-title">Payment Summary</div>
            <div className="ps-booking">Booking #{bookingNumber}</div>
            <div className="ps-amount-row">
              <span>Total Amount</span>
              <span className="ps-amount">₹{parseFloat(totalAmount || 0).toFixed(0)}</span>
            </div>
            <div className="ps-note">
              ✅ Reports will be available online after sample collection
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
