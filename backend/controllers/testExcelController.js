/**
 * testExcelController.js
 * Export all tests/profiles/packages to .xlsx
 * Import tests from .xlsx (with validation and upsert)
 *
 * Uses: exceljs (npm install exceljs)
 */
const ExcelJS = require('exceljs');
const db      = require('../config/db');

/* ── Brand colours ─────────────────────────────────────── */
const COLORS = {
  headerBg:   '0A3D62',   // dark navy
  headerFg:   'FFFFFF',
  testBg:     'EBF5FB',   // light blue
  profileBg:  'F5EEF8',   // light purple
  packageBg:  'FEF9E7',   // light orange
  subRow:     'F8FAFC',   // very light grey for child rows
  accent:     '00B4D8',
  border:     'D0DDE9',
};

/* ── Shared cell style helpers ──────────────────────────── */
const headerStyle = {
  font:      { bold: true, color: { argb: COLORS.headerFg }, name: 'Arial', size: 10 },
  fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border:    { bottom: { style: 'thin', color: { argb: COLORS.border } } },
};

const cellStyle = (bgArgb) => ({
  fill:      bgArgb ? { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } } : undefined,
  alignment: { vertical: 'middle', wrapText: true },
  border: {
    bottom: { style: 'hair', color: { argb: COLORS.border } },
    right:  { style: 'hair', color: { argb: COLORS.border } },
  },
});

const typeBadgeColors = {
  test:    'EBF5FB',
  profile: 'F5EEF8',
  package: 'FEF9E7',
};

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/tests/export
   Streams an .xlsx file to the client
═══════════════════════════════════════════════════════════ */
exports.exportTests = async (req, res) => {
  try {
    // ── 1. Fetch all active tests ──────────────────────────
    const [tests] = await db.query(`
      SELECT t.id, t.type, t.name, t.code, t.description,
             t.sample_type, t.report_time, t.fasting_required,
             t.base_price, t.is_active,
             c.name AS category
      FROM   tests t
      LEFT   JOIN test_categories c ON t.category_id = c.id
      WHERE  t.is_active = 1
      ORDER  BY t.type, c.name, t.name
    `);

    // ── 2. Fetch ALL compositions in one query ─────────────
    const [compositions] = await db.query(`
      SELECT tc.parent_id, tc.sort_order,
             t.id AS child_id, t.type AS child_type,
             t.name AS child_name, t.code AS child_code,
             t.base_price AS child_price, t.sample_type AS child_sample
      FROM   test_compositions tc
      JOIN   tests t ON tc.child_id = t.id AND t.is_active = 1
      ORDER  BY tc.parent_id, tc.sort_order, t.name
    `);

    // Index compositions by parent_id
    const compMap = {};
    for (const c of compositions) {
      if (!compMap[c.parent_id]) compMap[c.parent_id] = [];
      compMap[c.parent_id].push(c);
    }

    // ── 3. Build workbook ──────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'LabCollect';
    wb.created  = new Date();
    wb.modified = new Date();

    // ── Sheet 1: Tests ─────────────────────────────────────
    const testsSheet = wb.addWorksheet('Tests', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    testsSheet.columns = [
      { header: 'Code',            key: 'code',            width: 14 },
      { header: 'Name',            key: 'name',            width: 36 },
      { header: 'Category',        key: 'category',        width: 20 },
      { header: 'Sample Type',     key: 'sample_type',     width: 22 },
      { header: 'Report Time',     key: 'report_time',     width: 16 },
      { header: 'Fasting Required',key: 'fasting_required',width: 16 },
      { header: 'Price (₹)',       key: 'base_price',      width: 12 },
      { header: 'Description',     key: 'description',     width: 40 },
    ];
    applyHeaderRow(testsSheet, 1);

    const simpleTests = tests.filter(t => t.type === 'test');
    for (const t of simpleTests) {
      const row = testsSheet.addRow({
        code:             t.code,
        name:             t.name,
        category:         t.category || '',
        sample_type:      t.sample_type || '',
        report_time:      t.report_time || '',
        fasting_required: t.fasting_required ? 'Yes' : 'No',
        base_price:       parseFloat(t.base_price),
        description:      t.description || '',
      });
      row.height = 18;
      row.eachCell(cell => Object.assign(cell, cellStyle(COLORS.testBg)));
      row.getCell('base_price').numFmt = '₹#,##0.00';
    }

    testsSheet.autoFilter = { from: 'A1', to: 'H1' };

    // ── Sheet 2: Profiles ──────────────────────────────────
    const profilesSheet = wb.addWorksheet('Profiles', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    profilesSheet.columns = [
      { header: 'Code',             key: 'code',        width: 14 },
      { header: 'Name',             key: 'name',        width: 36 },
      { header: 'Category',         key: 'category',    width: 20 },
      { header: 'Sample Type',      key: 'sample_type', width: 22 },
      { header: 'Report Time',      key: 'report_time', width: 16 },
      { header: 'Fasting Required', key: 'fasting',     width: 16 },
      { header: 'Price (₹)',        key: 'base_price',  width: 12 },
      { header: 'Included Tests',   key: 'children',    width: 50 },
      { header: 'Description',      key: 'description', width: 40 },
    ];
    applyHeaderRow(profilesSheet, 1);

    const profiles = tests.filter(t => t.type === 'profile');
    for (const p of profiles) {
      const children = compMap[p.id] || [];
      const childStr = children.map(c => `${c.child_code} — ${c.child_name}`).join('\n');
      const row = profilesSheet.addRow({
        code:        p.code,
        name:        p.name,
        category:    p.category || '',
        sample_type: p.sample_type || '(auto-derived)',
        report_time: p.report_time || '(auto-derived)',
        fasting:     p.fasting_required ? 'Yes' : 'No',
        base_price:  parseFloat(p.base_price),
        children:    childStr,
        description: p.description || '',
      });
      row.height = Math.max(18, children.length * 18);
      row.eachCell(cell => Object.assign(cell, cellStyle(COLORS.profileBg)));
      row.getCell('base_price').numFmt = '₹#,##0.00';
    }
    profilesSheet.autoFilter = { from: 'A1', to: 'I1' };

    // ── Sheet 3: Packages ──────────────────────────────────
    const packagesSheet = wb.addWorksheet('Packages', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    packagesSheet.columns = [
      { header: 'Code',             key: 'code',        width: 14 },
      { header: 'Name',             key: 'name',        width: 36 },
      { header: 'Category',         key: 'category',    width: 20 },
      { header: 'Sample Type',      key: 'sample_type', width: 22 },
      { header: 'Report Time',      key: 'report_time', width: 16 },
      { header: 'Fasting Required', key: 'fasting',     width: 16 },
      { header: 'Price (₹)',        key: 'base_price',  width: 12 },
      { header: 'Included (Tests / Profiles / Packages)', key: 'children', width: 60 },
      { header: 'Description',      key: 'description', width: 40 },
    ];
    applyHeaderRow(packagesSheet, 1);

    const packages = tests.filter(t => t.type === 'package');
    for (const p of packages) {
      const children = compMap[p.id] || [];
      const childStr = children
        .map(c => `[${c.child_type.toUpperCase()}] ${c.child_code} — ${c.child_name}`)
        .join('\n');
      const row = packagesSheet.addRow({
        code:        p.code,
        name:        p.name,
        category:    p.category || '',
        sample_type: p.sample_type || '(auto-derived)',
        report_time: p.report_time || '(auto-derived)',
        fasting:     p.fasting_required ? 'Yes' : 'No',
        base_price:  parseFloat(p.base_price),
        children:    childStr,
        description: p.description || '',
      });
      row.height = Math.max(18, children.length * 18);
      row.eachCell(cell => Object.assign(cell, cellStyle(COLORS.packageBg)));
      row.getCell('base_price').numFmt = '₹#,##0.00';
    }
    packagesSheet.autoFilter = { from: 'A1', to: 'I1' };

    // ── Sheet 4: Import Template ───────────────────────────
    addImportTemplateSheet(wb);

    // ── 4. Stream to client ────────────────────────────────
    const filename = `labcollect-tests-${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Export] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   POST /api/admin/tests/import
   Parse uploaded .xlsx and upsert tests into the database.
   Returns a detailed result summary.
═══════════════════════════════════════════════════════════ */
exports.importTests = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const results = { created: 0, updated: 0, skipped: 0, errors: [] };
  const conn    = await db.getConnection();

  try {
    await conn.beginTransaction();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    // ── Process each sheet that has importable data ────────
    for (const sheetName of ['Tests', 'Profiles', 'Packages']) {
      const sheet = wb.getWorksheet(sheetName);
      if (!sheet) continue;

      const type = sheetName.slice(0, -1).toLowerCase(); // 'test' | 'profile' | 'package'

      // Read header row to find column positions dynamically
      const headerRow = sheet.getRow(1);
      const colMap    = {};
      headerRow.eachCell((cell, colNum) => {
        const key = cell.value?.toString().toLowerCase().trim();
        colMap[key] = colNum;
      });

      const getCol = (row, name) => {
        const col = colMap[name];
        return col ? row.getCell(col).value?.toString().trim() || '' : '';
      };

      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        if (row.hidden) continue;

        const code = getCol(row, 'code');
        const name = getCol(row, 'name');
        if (!code || !name) continue;  // blank row

        try {
          const category    = getCol(row, 'category');
          const sampleType  = getCol(row, 'sample type') || null;
          const reportTime  = getCol(row, 'report time') || null;
          const fastingRaw  = getCol(row, 'fasting required');
          const fasting     = /yes|true|1/i.test(fastingRaw) ? 1 : 0;
          const priceRaw    = getCol(row, 'price (₹)') || getCol(row, 'price') || '0';
          const price       = parseFloat(priceRaw.replace(/[^\d.]/g, '')) || 0;
          const description = getCol(row, 'description') || null;
          const childrenRaw = getCol(row, 'included tests') ||
                              getCol(row, 'included (tests / profiles / packages)') || '';

          // Resolve category_id
          let categoryId = null;
          if (category) {
            const [catRow] = await conn.query(
              'SELECT id FROM test_categories WHERE name = ? LIMIT 1', [category]
            );
            if (catRow.length) {
              categoryId = catRow[0].id;
            } else {
              // Auto-create missing categories
              const [newCat] = await conn.query(
                'INSERT INTO test_categories (name) VALUES (?)', [category]
              );
              categoryId = newCat.insertId;
            }
          }

          // Resolve child IDs for profiles/packages
          let childIds = [];
          if (type !== 'test' && childrenRaw) {
            const childCodes = childrenRaw
              .split(/[\n,;]+/)
              .map(s => s.replace(/^\[.*?\]\s*/, '').split('—')[0].trim())
              .filter(Boolean);

            for (const childCode of childCodes) {
              const [childRow] = await conn.query(
                'SELECT id FROM tests WHERE code = ? AND is_active = 1 LIMIT 1', [childCode.toUpperCase()]
              );
              if (childRow.length) childIds.push(childRow[0].id);
            }
          }

          // Derive sample meta from children
          let finalSample  = sampleType?.replace('(auto-derived)', '').trim() || null;
          let finalTime    = reportTime?.replace('(auto-derived)', '').trim() || null;
          let finalFasting = fasting;

          if (type !== 'test' && childIds.length) {
            const [leafRows] = await conn.query(
              `WITH RECURSIVE tree AS (
                 SELECT id, type, sample_type, report_time, fasting_required
                 FROM tests WHERE id IN (${childIds.map(() => '?').join(',')}) AND is_active = 1
                 UNION ALL
                 SELECT t.id, t.type, t.sample_type, t.report_time, t.fasting_required
                 FROM test_compositions tc
                 JOIN tests t ON tc.child_id = t.id AND t.is_active = 1
                 JOIN tree p ON tc.parent_id = p.id WHERE p.type IN ('profile','package')
               )
               SELECT DISTINCT id, sample_type, report_time, fasting_required FROM tree WHERE type='test'`,
              childIds
            );
            if (leafRows.length) {
              const samples = [...new Set(leafRows.map(r => r.sample_type).filter(Boolean))];
              if (!finalSample && samples.length) finalSample = samples.join(', ');
              if (!finalTime) {
                const longest = leafRows
                  .filter(r => r.report_time)
                  .sort((a, b) => {
                    const max = rt => Math.max(...(rt.match(/\d+/g) || [0]).map(Number));
                    return max(b.report_time) - max(a.report_time);
                  })[0];
                if (longest) finalTime = longest.report_time;
              }
              if (leafRows.some(r => r.fasting_required)) finalFasting = 1;
            }
          }

          // Upsert
          const [existing] = await conn.query(
            'SELECT id FROM tests WHERE code = ?', [code.toUpperCase()]
          );

          let testId;
          if (existing.length) {
            testId = existing[0].id;
            await conn.query(
              `UPDATE tests SET type=?, category_id=?, name=?, description=?,
               sample_type=?, report_time=?, fasting_required=?, base_price=?, is_active=1
               WHERE id=?`,
              [type, categoryId, name, description, finalSample, finalTime, finalFasting, price, testId]
            );
            results.updated++;
          } else {
            const [ins] = await conn.query(
              `INSERT INTO tests (type, category_id, name, code, description,
               sample_type, report_time, fasting_required, base_price)
               VALUES (?,?,?,?,?,?,?,?,?)`,
              [type, categoryId, name, code.toUpperCase(), description, finalSample, finalTime, finalFasting, price]
            );
            testId = ins.insertId;
            results.created++;
          }

          // Replace composition
          if (type !== 'test') {
            await conn.query('DELETE FROM test_compositions WHERE parent_id=?', [testId]);
            if (childIds.length) {
              const rows = childIds.map((cId, i) => [testId, cId, i]);
              await conn.query('INSERT INTO test_compositions (parent_id,child_id,sort_order) VALUES ?', [rows]);
            }
          }
        } catch (rowErr) {
          results.errors.push({ row: r, sheet: sheetName, code: getCol(row, 'code'), error: rowErr.message });
          results.skipped++;
        }
      }
    }

    await conn.commit();
    res.json({ success: true, ...results });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ── helpers ──────────────────────────────────────────────── */

function applyHeaderRow(sheet, rowNum) {
  const row = sheet.getRow(rowNum);
  row.height = 28;
  row.eachCell(cell => {
    cell.font      = headerStyle.font;
    cell.fill      = headerStyle.fill;
    cell.alignment = headerStyle.alignment;
    cell.border    = headerStyle.border;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function addImportTemplateSheet(wb) {
  const s = wb.addWorksheet('📋 Import Guide', {
    tabColor: { argb: '00B4D8' },
  });
  s.columns = [{ width: 30 }, { width: 60 }];

  const title = s.getCell('A1');
  title.value = 'LabCollect — Import Guide';
  title.font  = { bold: true, size: 14, name: 'Arial', color: { argb: COLORS.headerBg } };
  s.mergeCells('A1:B1');

  const instructions = [
    ['', ''],
    ['HOW TO IMPORT', ''],
    ['Step 1', 'Create or edit rows in the Tests, Profiles, or Packages sheets'],
    ['Step 2', 'Leave Code blank to create new; use existing Code to update'],
    ['Step 3', 'Go to Admin → Tests → Upload icon and select this file'],
    ['Step 4', 'Review the import summary — errors are shown per row'],
    ['', ''],
    ['RULES', ''],
    ['Code', 'Required. Alphanumeric. Duplicates = update existing row'],
    ['Name', 'Required.'],
    ['Category', 'Auto-created if it does not exist'],
    ['Fasting Required', 'Yes / No'],
    ['Price (₹)', 'Numeric only, e.g. 650 or 650.50'],
    ['Included Tests', 'For Profiles: comma or newline separated test codes'],
    ['Included (Tests/Profiles/Packages)', 'For Packages: codes of any type'],
    ['Sample Type / Report Time', 'Leave blank to auto-derive from children'],
    ['', ''],
    ['NOTES', ''],
    ['Import order', 'Import Tests first, then Profiles, then Packages'],
    ['', 'so that child codes can be resolved during import'],
    ['Inactive tests', 'Set is_active=0 manually in the DB to deactivate'],
  ];

  let row = 2;
  for (const [key, val] of instructions) {
    const r = s.getRow(row);
    r.getCell(1).value = key;
    r.getCell(2).value = val;
    if (['HOW TO IMPORT', 'RULES', 'NOTES'].includes(key)) {
      r.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.headerBg } };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EBF5FB' } };
      s.mergeCells(`A${row}:B${row}`);
    }
    r.getCell(1).alignment = { vertical: 'middle' };
    r.getCell(2).alignment = { vertical: 'middle', wrapText: true };
    row++;
  }
}