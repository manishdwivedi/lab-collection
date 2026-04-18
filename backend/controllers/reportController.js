const path = require('path');
const fs   = require('fs');
const db   = require('../config/db');
const { UPLOAD_DIR } = require('../middleware/upload');

/* ─────────────────────────────────────────────
   POST /api/admin/bookings/:bookingId/reports
   Upload one or more report files (multipart)
   ───────────────────────────────────────────── */
exports.uploadReports = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { notes }     = req.body;
    const files         = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Verify booking exists
    const [bookings] = await db.query('SELECT id FROM bookings WHERE id = ?', [bookingId]);
    if (!bookings.length) {
      // Clean up orphaned uploads
      files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const insertedIds = [];
    for (const file of files) {
      const relativePath = path.relative(
        path.join(__dirname, '..'),
        file.path
      ).replace(/\\/g, '/');

      const [result] = await db.query(
        `INSERT INTO booking_reports
         (booking_id, file_name, file_path, file_size, mime_type, uploaded_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          file.originalname,
          relativePath,
          file.size,
          file.mimetype,
          req.user.id,
          notes || null,
        ]
      );
      insertedIds.push(result.insertId);
    }

    // Update booking report_status → ready, booking_status → completed if it was processing
    await db.query(
      `UPDATE bookings
       SET report_status = 'ready',
           booking_status = CASE WHEN booking_status IN ('processing','sample_collected') THEN 'completed' ELSE booking_status END
       WHERE id = ?`,
      [bookingId]
    );

    res.status(201).json({
      success: true,
      message: `${files.length} report(s) uploaded successfully`,
      reportIds: insertedIds,
    });
  } catch (err) {
    // Clean up files if DB insert failed
    if (req.files) req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   GET /api/bookings/:bookingId/reports
   List reports for a booking (patient + admin)
   ───────────────────────────────────────────── */
exports.getReports = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Authorization: patient can only see their own booking's reports
    if (req.user.role !== 'admin') {
      const [rows] = await db.query(
        'SELECT user_id FROM bookings WHERE id = ?',
        [bookingId]
      );
      if (!rows.length) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (rows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const [reports] = await db.query(
      `SELECT r.id, r.file_name, r.file_size, r.mime_type, r.notes, r.created_at,
              u.name AS uploaded_by_name
       FROM   booking_reports r
       JOIN   users u ON r.uploaded_by = u.id
       WHERE  r.booking_id = ? AND r.is_active = 1
       ORDER  BY r.created_at DESC`,
      [bookingId]
    );

    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   GET /api/reports/:reportId/download
   Stream file to browser (patient + admin)
   ───────────────────────────────────────────── */
exports.downloadReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const [rows] = await db.query(
      `SELECT r.*, b.user_id AS booking_user_id
       FROM booking_reports r
       JOIN bookings b ON r.booking_id = b.id
       WHERE r.id = ? AND r.is_active = 1`,
      [reportId]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'Report not found' });

    const report = rows[0];

    // Authorization check for patients
    if (req.user.role !== 'admin' && report.booking_user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const absolutePath = path.join(__dirname, '..', report.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.setHeader('Content-Type', report.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(report.file_name)}"`
    );
    res.setHeader('Content-Length', report.file_size);

    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   DELETE /api/admin/reports/:reportId
   Soft-delete a report (admin only)
   ───────────────────────────────────────────── */
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const [rows] = await db.query(
      'SELECT * FROM booking_reports WHERE id = ? AND is_active = 1',
      [reportId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Report not found' });

    // Soft-delete in DB
    await db.query('UPDATE booking_reports SET is_active = 0 WHERE id = ?', [reportId]);

    // Check if this was the last active report for the booking
    const [[{ remaining }]] = await db.query(
      'SELECT COUNT(*) AS remaining FROM booking_reports WHERE booking_id = ? AND is_active = 1',
      [rows[0].booking_id]
    );

    if (remaining === 0) {
      await db.query(
        "UPDATE bookings SET report_status = 'not_uploaded' WHERE id = ?",
        [rows[0].booking_id]
      );
    }

    // Optionally remove physical file (uncomment to enable hard delete)
    // const absPath = path.join(__dirname, '..', rows[0].file_path);
    // if (fs.existsSync(absPath)) fs.unlinkSync(absPath);

    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};