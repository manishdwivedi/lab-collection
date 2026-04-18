const db = require('../config/db');
const crypto = require('crypto');

// POST /api/payments/create-order
exports.createOrder = async (req, res) => {
  try {
    const { booking_id } = req.body;
    const [booking] = await db.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);
    if (!booking.length) return res.status(404).json({ success: false, message: 'Booking not found' });

    // In production, use Razorpay SDK:
    // const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    // const order = await razorpay.orders.create({ amount: booking[0].final_amount * 100, currency: 'INR', receipt: booking[0].booking_number });

    // Simulated order for demo
    const orderId = `order_demo_${Date.now()}`;
    await db.query('UPDATE bookings SET payment_order_id = ? WHERE id = ?', [orderId, booking_id]);
    await db.query(
      'INSERT INTO payments (booking_id, amount, gateway_order_id, status) VALUES (?,?,?,?)',
      [booking_id, booking[0].final_amount, orderId, 'initiated']
    );

    res.json({
      success: true,
      orderId,
      amount: booking[0].final_amount * 100,
      currency: 'INR',
      bookingNumber: booking[0].booking_number,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/payments/verify
exports.verifyPayment = async (req, res) => {
  try {
    const { booking_id, payment_id, order_id, signature, simulate_success } = req.body;

    let isValid = false;

    if (simulate_success) {
      // Demo mode: simulate successful payment
      isValid = true;
    } else {
      // Production: verify Razorpay signature
      const body = order_id + '|' + payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');
      isValid = expectedSignature === signature;
    }

    if (!isValid) {
      await db.query('UPDATE bookings SET payment_status = ? WHERE id = ?', ['failed', booking_id]);
      await db.query('UPDATE payments SET status = ? WHERE booking_id = ?', ['failed', booking_id]);
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const paymentId = payment_id || `pay_demo_${Date.now()}`;
    await db.query(
      'UPDATE bookings SET payment_status = ?, payment_id = ?, booking_status = ? WHERE id = ?',
      ['paid', paymentId, 'confirmed', booking_id]
    );
    await db.query(
      'UPDATE payments SET status = ?, gateway_payment_id = ?, gateway_signature = ? WHERE booking_id = ?',
      ['success', paymentId, signature || 'demo_sig', booking_id]
    );

    const [booking] = await db.query('SELECT booking_number FROM bookings WHERE id = ?', [booking_id]);
    res.json({ success: true, message: 'Payment successful!', bookingNumber: booking[0].booking_number });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/payments/booking/:bookingId
exports.getPaymentByBooking = async (req, res) => {
  try {
    const [payments] = await db.query('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC', [req.params.bookingId]);
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
