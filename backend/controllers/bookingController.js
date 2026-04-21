const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const generateBookingNumber = () => {
  const date = new Date();
  const prefix = 'BK';
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}${year}${month}${random}`;
};

// Get price for a test (considering client rate list)
const getTestPrice = async (testId, clientId) => {
  if (clientId) {
    const [rateItem] = await db.query(`
      SELECT rli.price FROM rate_list_items rli
      JOIN client_rate_lists crl ON rli.rate_list_id = crl.rate_list_id
      WHERE crl.client_id = ? AND rli.test_id = ? AND crl.is_active = 1
      AND (crl.effective_to IS NULL OR crl.effective_to >= CURDATE())
      ORDER BY crl.created_at DESC LIMIT 1
    `, [clientId, testId]);
    if (rateItem.length) return { price: rateItem[0].price, rateListId: null };
  }
  const [test] = await db.query('SELECT base_price FROM tests WHERE id = ?', [testId]);
  return { price: test[0]?.base_price || 0, rateListId: null };
};

// POST /api/bookings/create
exports.createBooking = async (req, res) => {
  try {
    const {
      patient_name, patient_age, patient_gender, patient_phone, patient_address,
      collection_type, collection_date, collection_time, collection_address,
      test_ids, client_id, notes
    } = req.body;
    console.log(req.body);
    if (!test_ids || !test_ids.length)
      return res.status(400).json({ success: false, message: 'Please select at least one test' });

    // Build items with prices
    let totalAmount = 0;
    const bookingItems = [];
    for (const testId of test_ids) {
      const [testRow] = await db.query('SELECT * FROM tests WHERE id = ? AND is_active = 1', [testId]);
      if (!testRow.length) continue;
      const test = testRow[0];
      const { price } = await getTestPrice(testId, client_id);
      totalAmount += parseFloat(price);
      bookingItems.push({
        test_id: testId,
        test_name: test.name,
        test_code: test.code,
        unit_price: price,
        quantity: 1,
        total_price: price
      });
    }

    const bookingNumber = generateBookingNumber();
    const userId = req.body.user_id ? req.body.user_id : null;

    const [result] = await db.query(`
      INSERT INTO bookings (booking_number, user_id, client_id, patient_name, patient_age, patient_gender,
        patient_phone, patient_address, collection_type, collection_date, collection_time,
        collection_address, total_amount, final_amount, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      bookingNumber, userId, client_id || null, patient_name, patient_age, patient_gender,
      patient_phone, patient_address, collection_type || 'walkin', collection_date, collection_time,
      collection_address, totalAmount, totalAmount, notes
    ]);

    const bookingId = result.insertId;
    for (const item of bookingItems) {
      await db.query(
        'INSERT INTO booking_items (booking_id, test_id, test_name, test_code, unit_price, quantity, total_price) VALUES (?,?,?,?,?,?,?)',
        [bookingId, item.test_id, item.test_name, item.test_code, item.unit_price, item.quantity, item.total_price]
      );
    }

    res.status(201).json({
      success: true, bookingId, bookingNumber,
      totalAmount, message: 'Booking created. Proceed to payment.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/my - Patient's bookings
exports.getMyBookings = async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.id, b.booking_number, b.patient_name, b.final_amount,
             b.booking_status, b.payment_status, b.report_status, b.created_at,
             GROUP_CONCAT(bi.test_name SEPARATOR ', ') as tests
      FROM bookings b
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      WHERE b.user_id = ?
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/:id
exports.getBooking = async (req, res) => {
  try {
    const [booking] = await db.query(`
      SELECT b.*, u.name as user_name, u.email as user_email,
        c.name as client_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (!booking.length) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Check authorization
    if (req.user.role !== 'admin' && booking[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const [items] = await db.query('SELECT * FROM booking_items WHERE booking_id = ?', [req.params.id]);
    res.json({ success: true, booking: { ...booking[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/bookings - Admin all bookings
exports.getAllBookings = async (req, res) => {
  try {
    const { status, payment_status, client_id, date_from, date_to, search } = req.query;

    // Pagination
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = (page - 1) * limit;

    let where   = 'WHERE 1=1';
    const params = [];

    if (status)         { where += ' AND b.booking_status = ?';          params.push(status); }
    if (payment_status) { where += ' AND b.payment_status = ?';          params.push(payment_status); }
    if (client_id)      { where += ' AND b.client_id = ?';               params.push(client_id); }
    if (date_from)      { where += ' AND DATE(b.created_at) >= ?';       params.push(date_from); }
    if (date_to)        { where += ' AND DATE(b.created_at) <= ?';       params.push(date_to); }
    if (search)         {
      where += ' AND (b.booking_number LIKE ? OR b.patient_name LIKE ? OR b.patient_phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT b.id) AS total FROM bookings b ${where}`,
      params
    );

    const [bookings] = await db.query(
      `SELECT b.id, b.booking_number, b.patient_name, b.patient_phone,
              b.final_amount, b.collection_type, b.collection_date, b.collection_time,
              b.booking_status, b.payment_status, b.report_status, b.push_status, b.created_at,
              u.name as user_name, c.name as client_name,
              ph_u.name as phlebo_name,
              GROUP_CONCAT(DISTINCT bi.test_name SEPARATOR ', ') as tests
       FROM bookings b
       LEFT JOIN users u       ON b.user_id   = u.id
       LEFT JOIN clients c     ON b.client_id = c.id
       LEFT JOIN phlebotomists ph ON b.phlebo_id = ph.id
       LEFT JOIN users ph_u    ON ph.user_id  = ph_u.id
       LEFT JOIN booking_items bi ON b.id     = bi.booking_id
       ${where}
       GROUP BY b.id
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({ success: false, message: isProd ? 'Failed to fetch bookings' : err.message });
  }
};

// PUT /api/admin/bookings/:id - Admin update booking
exports.updateBooking = async (req, res) => {
  try {
    const { booking_status, payment_status, notes, collection_date, collection_time } = req.body;
    await db.query(
      'UPDATE bookings SET booking_status=?, payment_status=?, notes=?, collection_date=?, collection_time=? WHERE id=?',
      [booking_status, payment_status, notes, collection_date, collection_time, req.params.id]
    );
    res.json({ success: true, message: 'Booking updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const [[todayStats]] = await db.query(`
      SELECT 
        COUNT(*) as today_bookings,
        SUM(CASE WHEN payment_status = 'paid' THEN final_amount ELSE 0 END) as today_revenue
      FROM bookings WHERE DATE(created_at) = CURDATE()
    `);
    const [[monthStats]] = await db.query(`
      SELECT COUNT(*) as month_bookings, SUM(CASE WHEN payment_status = 'paid' THEN final_amount ELSE 0 END) as month_revenue
      FROM bookings WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
    `);
    const [[totalStats]] = await db.query(`
      SELECT COUNT(*) as total_bookings, SUM(CASE WHEN payment_status = 'paid' THEN final_amount ELSE 0 END) as total_revenue
      FROM bookings
    `);
    const [[totalPatients]] = await db.query("SELECT COUNT(*) as total FROM users WHERE role = 'patient'");
    const [statusBreakdown] = await db.query('SELECT booking_status, COUNT(*) as count FROM bookings GROUP BY booking_status');
    const [recentBookings] = await db.query(`
      SELECT b.booking_number, b.patient_name, b.final_amount, b.booking_status, b.payment_status, b.created_at,
        c.name as client_name
      FROM bookings b LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        today: todayStats,
        month: monthStats,
        total: totalStats,
        totalPatients: totalPatients.total,
        statusBreakdown,
        recentBookings
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};