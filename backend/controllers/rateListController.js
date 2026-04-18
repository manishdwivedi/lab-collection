const db = require('../config/db');

// GET /api/admin/rate-lists
exports.getRateLists = async (req, res) => {
  try {
    const [rateLists] = await db.query('SELECT * FROM rate_lists ORDER BY created_at DESC');
    res.json({ success: true, rateLists });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/rate-lists/:id
exports.getRateList = async (req, res) => {
  try {
    const [rateList] = await db.query('SELECT * FROM rate_lists WHERE id = ?', [req.params.id]);
    if (!rateList.length) return res.status(404).json({ success: false, message: 'Rate list not found' });

    const [items] = await db.query(`
      SELECT rli.*, t.name as test_name, t.code as test_code, t.base_price, c.name as category_name
      FROM rate_list_items rli
      JOIN tests t ON rli.test_id = t.id
      LEFT JOIN test_categories c ON t.category_id = c.id
      WHERE rli.rate_list_id = ?
      ORDER BY c.name, t.name
    `, [req.params.id]);

    res.json({ success: true, rateList: { ...rateList[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/rate-lists
exports.createRateList = async (req, res) => {
  try {
    const { name, description, discount_type, items } = req.body;
    const [result] = await db.query(
      'INSERT INTO rate_lists (name, description, discount_type) VALUES (?,?,?)',
      [name, description, discount_type || 'percentage']
    );
    const rateListId = result.insertId;

    if (items && items.length > 0) {
      const values = items.map(item => [rateListId, item.test_id, item.price]);
      await db.query('INSERT INTO rate_list_items (rate_list_id, test_id, price) VALUES ?', [values]);
    }
    res.status(201).json({ success: true, message: 'Rate list created', id: rateListId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admin/rate-lists/:id
exports.updateRateList = async (req, res) => {
  try {
    const { name, description, discount_type, is_active, items } = req.body;
    await db.query(
      'UPDATE rate_lists SET name=?, description=?, discount_type=?, is_active=? WHERE id=?',
      [name, description, discount_type, is_active, req.params.id]
    );

    if (items !== undefined) {
      await db.query('DELETE FROM rate_list_items WHERE rate_list_id = ?', [req.params.id]);
      if (items.length > 0) {
        const values = items.map(item => [req.params.id, item.test_id, item.price]);
        await db.query('INSERT INTO rate_list_items (rate_list_id, test_id, price) VALUES ?', [values]);
      }
    }
    res.json({ success: true, message: 'Rate list updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/rate-lists/:id
exports.deleteRateList = async (req, res) => {
  try {
    await db.query('UPDATE rate_lists SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Rate list deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
