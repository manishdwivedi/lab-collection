const db = require('../config/db');

/* ─────────────────────────────────────────────────────────────
   deriveCompositionMeta
   Given an array of child IDs, recursively collects all leaf-test
   sample types, picks the longest report_time, and ORs fasting flags.
   Returns { sample_type, report_time, fasting_required }
   ─────────────────────────────────────────────────────────── */
async function deriveCompositionMeta(childIds, connOrDb) {
  const q = connOrDb || db;

  // Recursively collect leaf tests
  const visited  = new Set();
  const leafTests = [];

  async function collect(ids) {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await q.query(
      `SELECT t.id, t.type, t.sample_type, t.report_time, t.fasting_required
       FROM tests t WHERE t.id IN (${placeholders}) AND t.is_active = 1`,
      ids
    );

    for (const row of rows) {
      if (visited.has(row.id)) continue;
      visited.add(row.id);

      if (row.type === 'test') {
        leafTests.push(row);
      } else {
        // profile or package — get its children
        const [childRows] = await q.query(
          'SELECT child_id FROM test_compositions WHERE parent_id = ?',
          [row.id]
        );
        await collect(childRows.map(c => c.child_id));
      }
    }
  }

  await collect(childIds);

  if (!leafTests.length) {
    return { sample_type: null, report_time: null, fasting_required: 0 };
  }

  // Collect unique, non-null sample types
  const sampleTypes = [...new Set(
    leafTests.map(t => t.sample_type).filter(Boolean)
  )];

  // Build a merged sample type string e.g. "Blood (EDTA), Blood (Serum), Urine"
  const mergedSampleType = sampleTypes.length ? sampleTypes.join(', ') : null;

  // Pick the longest report time (simple heuristic: 24h > 8-10h > 6-8h > 3-4h)
  const reportTimeHours = (rt) => {
    if (!rt) return 0;
    const nums = rt.match(/\d+/g);
    return nums ? Math.max(...nums.map(Number)) : 0;
  };
  const longestReportTime = leafTests
    .filter(t => t.report_time)
    .sort((a, b) => reportTimeHours(b.report_time) - reportTimeHours(a.report_time))[0]?.report_time || null;

  // Fasting required if ANY child requires it
  const fastingRequired = leafTests.some(t => t.fasting_required) ? 1 : 0;

  return {
    sample_type:      mergedSampleType,
    report_time:      longestReportTime,
    fasting_required: fastingRequired,
  };
}

/* ── Helper: recursively flatten a profile/package into leaf test IDs ── */
async function flattenToTests(parentId, visited = new Set()) {
  if (visited.has(parentId)) return [];
  visited.add(parentId);

  const [children] = await db.query(
    `WITH RECURSIVE composition_tree AS (
    
    SELECT child_id, parent_id, 0 AS depth
    FROM test_compositions
    WHERE parent_id = ?

    UNION ALL

    SELECT tc.child_id, tc.parent_id, ct.depth + 1
    FROM test_compositions tc
    JOIN composition_tree ct ON tc.parent_id = ct.child_id
    WHERE ct.depth < 10   -- cycle guard
  )
  SELECT DISTINCT t.id, t.name, t.code, t.sample_type, t.report_time, t.fasting_required
  FROM composition_tree ct
  JOIN tests t ON ct.child_id = t.id
  WHERE t.type = 'test' AND t.is_active = 1`,
    [parentId]
  );

  const leafTests = [];
  for (const child of children) {
    if (child.type === 'test') {
      leafTests.push(child);
    } else {
      const nested = await flattenToTests(child.id, visited);
      leafTests.push(...nested);
    }
  }
  return leafTests;
}

/* ── GET /api/tests — Public ──────────────────────────────── */
exports.getTests = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(100, parseInt(req.query.limit || '10', 10));
    const offset = (page - 1) * limit;
    const { category_id, search, type } = req.query;
    console.log(type);
    let q = `
      SELECT t.*, c.name AS category_name,
      (select group_concat(child_id) from test_compositions where parent_id=t.id ) as childrens 
      FROM tests t 
      LEFT JOIN test_categories c ON t.category_id = c.id 
      WHERE t.is_active = 1
    `;
    const params = [];
    if (category_id) { q += ' AND t.category_id = ?'; params.push(category_id); }
    if (type)        { q += ' AND t.type = ?';        params.push(type); }
    if (search)      {
      q += ' AND (t.name LIKE ? OR t.code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    q += ' ORDER BY t.type, c.name, t.name';
    // const [tests] = await db.query(q, params);
    // const [[{ total }]] = await db.query(countQuery, params);
    const [tests]       = await db.query(q + ' LIMIT ? OFFSET ?', [...params, limit, offset]);
    const [totalTests]       = await db.query(q,[...params]);
    // console.log(tests.length);
    const total = totalTests.length;
    // res.json({ success: true, tests });
    res.json({ success: true, tests, pagination: { page, limit, total, pages: Math.ceil(total/limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/tests/categories ─────────────────────────────── */
exports.getCategories = async (req, res) => {
  try {
    const [cats] = await db.query('SELECT * FROM test_categories WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/tests/:id — with composition tree ─────────────── */
exports.getTest = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, c.name AS category_name
       FROM tests t LEFT JOIN test_categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    const test = rows[0];

    // Attach composition children for profiles / packages
    if (test.type !== 'test') {
      const [children] = await db.query(
        `SELECT t.id, t.type, t.name, t.code, t.base_price, tc.sort_order
         FROM test_compositions tc
         JOIN tests t ON tc.child_id = t.id
         WHERE tc.parent_id = ?
         ORDER BY tc.sort_order, t.name`,
        [test.id]
      );
      test.children = children;
      test.leaf_tests = await flattenToTests(test.id);
    }

    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/tests/:id — Fect Comma Seperated Test Data ─────────────── */
exports.getTestList = async (req, res) => {
  try {

    const { ids } = req.query;

    const idArray = ids
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

      if (!idArray.length) {
      return res.status(400).json({ message: 'Invalid ids' });
    }

    // Create placeholders (?, ?, ?)
    const placeholders = idArray.map(() => '?').join(',');

    // res.json({ success: true, query });
    // const [rows] = await db.query(
    //   `SELECT t.*, c.name AS category_name
    //    FROM tests t LEFT JOIN test_categories c ON t.category_id = c.id
    //    WHERE t.id in (${placeholders})`,
    //   [idArray]
    // );
    // if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    // const test = rows[0];
    // // res.json({ success: true, req });
    // res.json({ success: true, test });
    const query = `
      SELECT t.*, c.name AS category_name
      FROM tests t LEFT JOIN test_categories c ON t.category_id = c.id
      WHERE t.id in (${placeholders})
    `;

    const [rows] = await db.execute(query, idArray);

    return res.json({
      success: true,
      count: rows.length,
      tests: rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/admin/tests ──────────────────────────────────── */
exports.createTest = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      type = 'test', category_id, name, code, description,
      sample_type, report_time, fasting_required, base_price,
      children = []
    } = req.body;

    if (!name || !code || base_price === '' || base_price === undefined)
      return res.status(400).json({ success: false, message: 'name, code and base_price are required' });

    if (!['test','profile','package'].includes(type))
      return res.status(400).json({ success: false, message: 'Invalid type' });

    if (type !== 'test' && (!children || children.length === 0))
      return res.status(400).json({ success: false, message: `A ${type} must contain at least one item` });

    // Auto-derive sample_type, report_time, fasting for profiles/packages
    let derivedSampleType  = sample_type  || null;
    let derivedReportTime  = report_time  || null;
    let derivedFasting     = fasting_required ? 1 : 0;

    if (type !== 'test' && children.length > 0) {
      const derived = await deriveCompositionMeta(children, conn);
      if (!derivedSampleType) derivedSampleType = derived.sample_type;
      if (!derivedReportTime) derivedReportTime  = derived.report_time;
      if (!fasting_required)  derivedFasting     = derived.fasting_required;
    }

    const [result] = await conn.query(
      `INSERT INTO tests (type, category_id, name, code, description,
         sample_type, report_time, fasting_required, base_price)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [type, category_id || null, name, code.toUpperCase(), description || null,
       derivedSampleType, derivedReportTime, derivedFasting,
       parseFloat(base_price)]
    );
    const parentId = result.insertId;

    for (let i = 0; i < children.length; i++) {
      await conn.query(
        'INSERT INTO test_compositions (parent_id, child_id, sort_order) VALUES (?,?,?)',
        [parentId, children[i], i]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: `${type} created`,
      id: parentId,
      derived: type !== 'test' ? { sample_type: derivedSampleType, report_time: derivedReportTime, fasting_required: derivedFasting } : undefined,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
};

/* ── PUT /api/admin/tests/:id ───────────────────────────────── */
exports.updateTest = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      type, category_id, name, code, description,
      sample_type, report_time, fasting_required, base_price,
      is_active, children
    } = req.body;

    // Auto-derive sample_type / report_time / fasting if children changed
    let finalSampleType = sample_type || null;
    let finalReportTime = report_time || null;
    let finalFasting    = fasting_required ? 1 : 0;

    if (type !== 'test' && children !== undefined && children.length > 0) {
      const derived = await deriveCompositionMeta(children, conn);
      if (!sample_type) finalSampleType = derived.sample_type;
      if (!report_time) finalReportTime  = derived.report_time;
      if (!fasting_required) finalFasting = derived.fasting_required;
    }

    await conn.query(
      `UPDATE tests SET type=?, category_id=?, name=?, code=?,
         description=?, sample_type=?, report_time=?,
         fasting_required=?, base_price=?, is_active=?
       WHERE id=?`,
      [type, category_id || null, name, code?.toUpperCase() || code,
       description || null, finalSampleType, finalReportTime,
       finalFasting, parseFloat(base_price),
       is_active ? 1 : 0, req.params.id]
    );

    if (children !== undefined && type !== 'test') {
      await conn.query('DELETE FROM test_compositions WHERE parent_id = ?', [req.params.id]);
      for (let i = 0; i < children.length; i++) {
        await conn.query(
          'INSERT INTO test_compositions (parent_id, child_id, sort_order) VALUES (?,?,?)',
          [req.params.id, children[i], i]
        );
      }
    }

    await conn.commit();
    res.json({
      success: true,
      message: 'Updated successfully',
      derived: type !== 'test' ? { sample_type: finalSampleType, report_time: finalReportTime, fasting_required: finalFasting } : undefined,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
};

/* ── DELETE /api/admin/tests/:id ────────────────────────────── */
exports.deleteTest = async (req, res) => {
  try {
    await db.query('UPDATE tests SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/admin/tests/:id/composition ── detail for edit modal */
exports.getComposition = async (req, res) => {
  try {
    const [children] = await db.query(
      `SELECT t.id, t.type, t.name, t.code, t.base_price, tc.sort_order
       FROM test_compositions tc
       JOIN tests t ON tc.child_id = t.id
       WHERE tc.parent_id = ?
       ORDER BY tc.sort_order, t.name`,
      [req.params.id]
    );
    res.json({ success: true, children });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/admin/categories ─────────────────────────────── */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const [r] = await db.query(
      'INSERT INTO test_categories (name, description, icon) VALUES (?,?,?)',
      [name, description, icon]
    );
    res.status(201).json({ success: true, message: 'Category created', id: r.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};