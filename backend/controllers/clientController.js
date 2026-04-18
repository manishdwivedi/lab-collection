const db = require('../config/db');

// GET /api/admin/clients
exports.getClients = async (req, res) => {
  try {
    const [clients] = await db.query(`
      SELECT c.*, 
        rl.name as rate_list_name, rl.id as rate_list_id,
        crl.effective_from, crl.effective_to
      FROM clients c
      LEFT JOIN client_rate_lists crl ON c.id = crl.client_id AND crl.is_active = 1
      LEFT JOIN rate_lists rl ON crl.rate_list_id = rl.id
      WHERE c.is_active = 1
      ORDER BY c.name
    `);
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/clients/:id
exports.getClient = async (req, res) => {
  try {
    const [client] = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client.length) return res.status(404).json({ success: false, message: 'Client not found' });

    const [rateListAssignment] = await db.query(`
      SELECT crl.*, rl.name as rate_list_name
      FROM client_rate_lists crl
      JOIN rate_lists rl ON crl.rate_list_id = rl.id
      WHERE crl.client_id = ?
      ORDER BY crl.created_at DESC
    `, [req.params.id]);

    const [bookings] = await db.query(`
      SELECT b.booking_number, b.patient_name, b.final_amount, b.booking_status, b.created_at
      FROM bookings b WHERE b.client_id = ? ORDER BY b.created_at DESC LIMIT 10
    `, [req.params.id]);

    res.json({ success: true, client: { ...client[0], rateListAssignments: rateListAssignment, recentBookings: bookings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/clients
exports.createClient = async (req, res) => {
  try {
    const { name, code, contact_person, email, phone, address, city, gst_number, credit_limit, payment_terms, rate_list_id, effective_from } = req.body;
    const [result] = await db.query(
      'INSERT INTO clients (name, code, contact_person, email, phone, address, city, gst_number, credit_limit, payment_terms) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name, code, contact_person, email, phone, address, city, gst_number, credit_limit || 0, payment_terms || 30]
    );
    const clientId = result.insertId;

    if (rate_list_id) {
      await db.query(
        'INSERT INTO client_rate_lists (client_id, rate_list_id, effective_from) VALUES (?,?,?)',
        [clientId, rate_list_id, effective_from || new Date().toISOString().split('T')[0]]
      );
    }
    res.status(201).json({ success: true, message: 'Client created', id: clientId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admin/clients/:id
exports.updateClient = async (req, res) => {
  try {
    const { name, code, contact_person, email, phone, address, city, gst_number, credit_limit, payment_terms, is_active, rate_list_id, effective_from } = req.body;
    await db.query(
      'UPDATE clients SET name=?, code=?, contact_person=?, email=?, phone=?, address=?, city=?, gst_number=?, credit_limit=?, payment_terms=?, is_active=? WHERE id=?',
      [name, code, contact_person, email, phone, address, city, gst_number, credit_limit, payment_terms, is_active, req.params.id]
    );

    if (rate_list_id !== undefined) {
      await db.query('UPDATE client_rate_lists SET is_active = 0 WHERE client_id = ?', [req.params.id]);
      if (rate_list_id) {
        await db.query(
          'INSERT INTO client_rate_lists (client_id, rate_list_id, effective_from) VALUES (?,?,?)',
          [req.params.id, rate_list_id, effective_from || new Date().toISOString().split('T')[0]]
        );
      }
    }
    res.json({ success: true, message: 'Client updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/clients/:id
exports.deleteClient = async (req, res) => {
  try {
    await db.query('UPDATE clients SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Client deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
