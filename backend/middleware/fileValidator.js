/**
 * Magic-byte file type validator
 * Validates uploaded files by inspecting actual binary content,
 * not just the MIME type claimed by the browser.
 *
 * Uses dynamic import of 'file-type' (ESM-only package).
 */
const fs   = require('fs');
const path = require('path');

const ALLOWED_TYPES = [
  { mime: 'application/pdf', ext: '.pdf', magic: [0x25, 0x50, 0x44, 0x46] },  // %PDF
  { mime: 'image/jpeg',      ext: '.jpg', magic: [0xFF, 0xD8, 0xFF]         },  // JPEG SOI
  { mime: 'image/png',       ext: '.png', magic: [0x89, 0x50, 0x4E, 0x47] },  // ‰PNG
  { mime: 'image/webp',      ext: null,   magic: null                       },  // detected via file-type
];

/**
 * Read the first 12 bytes of a file to check magic numbers.
 * Falls back gracefully if file-type package isn't installed.
 */
async function detectFileType(filePath) {
  try {
    // Try dynamic import of ESM file-type
    const { fileTypeFromFile } = await import('file-type');
    const result = await fileTypeFromFile(filePath);
    return result; // { mime, ext } or undefined
  } catch {
    // Fallback: manual magic byte check
    const buf = Buffer.alloc(12);
    const fd  = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    for (const type of ALLOWED_TYPES) {
      if (!type.magic) continue;
      const match = type.magic.every((byte, i) => buf[i] === byte);
      if (match) return { mime: type.mime, ext: type.ext };
    }
    return null;
  }
}

/**
 * Express middleware: validates each uploaded file's magic bytes
 * against the allowlist. Rejects and removes files that don't match.
 * Must be applied AFTER multer.
 */
const validateMagicBytes = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return next();

  const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const bad = [];

  for (const file of files) {
    try {
      const detected = await detectFileType(file.path);
      if (!detected || !ALLOWED_MIMES.includes(detected.mime)) {
        bad.push(file);
        // Remove the rejected file immediately
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    } catch {
      bad.push(file);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
  }

  if (bad.length > 0) {
    // Also clean remaining good files to avoid partial uploads
    files.filter(f => !bad.includes(f))
         .forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));

    return res.status(400).json({
      success: false,
      message: `${bad.length} file(s) rejected: file content does not match allowed types (PDF, JPG, PNG, WEBP). Do not rename files to bypass this check.`,
    });
  }

  next();
};

module.exports = { validateMagicBytes };