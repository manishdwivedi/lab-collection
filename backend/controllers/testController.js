const db = require('../config/db');

// GET /api/tests - Public
exports.getTests = async (req, res) => {
  try {
    const { category_id, search } = req.query;
    let query = `
      SELECT t.*, c.name as category_name
      FROM tests t
      LEFT JOIN test_categories c ON t.category_id = c.id
      WHERE t.is_active = 1
    `;
    const params = [];
    if (category_id) { query += ' AND t.category_id = ?'; params.push(category_id); }
    if (search) { query += ' AND (t.name LIKE ? OR t.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY c.name, t.name';
    const [tests] = await db.query(query, params);
    res.json({ success: true, tests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tests/categories
exports.getCategories = async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM test_categories WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tests/:id
exports.getTest = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT t.*, c.name as category_name FROM tests t LEFT JOIN test_categories c ON t.category_id = c.id WHERE t.id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Test not found' });
    res.json({ success: true, test: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/tests - Admin
exports.createTest = async (req, res) => {
  try {
    const { category_id, name, code, description, sample_type, report_time, fasting_required, base_price } = req.body;
    const [result] = await db.query(
      'INSERT INTO tests (category_id, name, code, description, sample_type, report_time, fasting_required, base_price) VALUES (?,?,?,?,?,?,?,?)',
      [category_id, name, code, description, sample_type, report_time, fasting_required || false, base_price]
    );
    res.status(201).json({ success: true, message: 'Test created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admin/tests/:id - Admin
exports.updateTest = async (req, res) => {
  try {
    const { category_id, name, code, description, sample_type, report_time, fasting_required, base_price, is_active } = req.body;
    await db.query(
      'UPDATE tests SET category_id=?, name=?, code=?, description=?, sample_type=?, report_time=?, fasting_required=?, base_price=?, is_active=? WHERE id=?',
      [category_id, name, code, description, sample_type, report_time, fasting_required, base_price, is_active, req.params.id]
    );
    res.json({ success: true, message: 'Test updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/tests/:id - Admin
exports.deleteTest = async (req, res) => {
  try {
    await db.query('UPDATE tests SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Test deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const [result] = await db.query('INSERT INTO test_categories (name, description, icon) VALUES (?,?,?)', [name, description, icon]);
    res.status(201).json({ success: true, message: 'Category created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
