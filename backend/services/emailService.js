/**
 * Email Service — powered by Resend
 * https://resend.com/docs
 *
 * Install: npm install resend
 * Docs:    https://resend.com/docs/send-with-nodejs
 */

const { Resend } = require('resend');

// Lazy-initialise so the app boots even without a key (just skips sending)
let resend = null;
const getResend = () => {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) return null;
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

const FROM    = process.env.EMAIL_FROM  || 'LabCollect Diagnostics <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL     || 'http://localhost:3000';

/* ── Shared colour palette ───────────────────────────── */
const BRAND = {
  primary : '#0A3D62',
  accent  : '#00B4D8',
  success : '#2ECC71',
  bg      : '#F0F4F8',
  text    : '#1A2B3C',
  muted   : '#5D7B96',
};

/* ── Base HTML shell ─────────────────────────────────── */
const htmlShell = (body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>LabCollect Diagnostics</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: ${BRAND.bg}; color: ${BRAND.text}; }
    a { color: ${BRAND.accent}; text-decoration: none; }
    .wrapper { max-width: 600px; margin: 32px auto; }
    .header  { background: ${BRAND.primary}; border-radius: 12px 12px 0 0; padding: 28px 36px; display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 40px; height: 40px; background: ${BRAND.accent}; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
    .header-logo svg { display: block; }
    .brand-name { font-size: 20px; font-weight: 700; color: #fff; }
    .brand-sub  { font-size: 11px; color: rgba(144,224,239,0.8); margin-top: 2px; }
    .body    { background: #fff; padding: 36px; }
    .footer  { background: ${BRAND.primary}; border-radius: 0 0 12px 12px; padding: 20px 36px; text-align: center; }
    .footer p { font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.7; }
    .btn     { display: inline-block; background: ${BRAND.accent}; color: #fff !important; font-weight: 700;
               padding: 14px 32px; border-radius: 8px; font-size: 15px; text-decoration: none; }
    .tag     { display: inline-block; background: ${BRAND.bg}; color: ${BRAND.muted};
               font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 100px; }
    .tag.green  { background: #D5F5E3; color: #1E8449; }
    .tag.blue   { background: #EBF5FB; color: #1A5276; }
    .divider { border: none; border-top: 1px solid #E8EFF5; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0;
                border-bottom: 1px solid #F0F4F8; font-size: 14px; }
    .info-label { color: ${BRAND.muted}; font-weight: 500; }
    .info-value { font-weight: 600; text-align: right; }
    .report-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px;
                   background: ${BRAND.bg}; border-radius: 8px; margin-bottom: 8px; }
    .report-icon { width: 36px; height: 36px; background: #fff; border-radius: 8px;
                   display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                   border: 1px solid #E8EFF5; }
    .report-name { font-size: 13px; font-weight: 600; }
    .report-meta { font-size: 11px; color: ${BRAND.muted}; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">LabCollect</div>
        <div class="brand-sub">Diagnostics at your door</div>
      </div>
    </div>

    <div class="body">
      ${body}
    </div>

    <div class="footer">
      <p>
        LabCollect Diagnostics · Ludhiana, Punjab, India<br/>
        This is an automated notification. Please do not reply to this email.<br/>
        <a href="${APP_URL}" style="color:rgba(144,224,239,0.8);">Visit LabCollect</a>
      </p>
    </div>
  </div>
</body>
</html>`;

/* ── Format file size ────────────────────────────────── */
const fmt = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ── Format date ─────────────────────────────────────── */
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—';

/* ─────────────────────────────────────────────────────────────
   sendReportReadyEmail
   Called after reports are uploaded for a booking.

   params {
     to            string | string[]  — patient email(s)
     patientName   string
     bookingNumber string
     tests         string             — comma-separated test names
     reportFiles   Array<{ file_name, file_size, mime_type }>
     collectionDate string | null
     labNotes       string | null
     bookingId      number            — for the CTA link
   }
   ─────────────────────────────────────────────────────────── */
exports.sendReportReadyEmail = async ({
  to,
  patientName,
  bookingNumber,
  tests,
  reportFiles = [],
  collectionDate,
  labNotes,
  bookingId,
}) => {
  const client = getResend();
  if (!client) {
    console.warn('[Email] RESEND_API_KEY not set — skipping report notification');
    return { skipped: true };
  }

  const bookingUrl = `${APP_URL}/bookings/${bookingId}`;
  const fileIcons  = { 'application/pdf': '📄', 'image/jpeg': '🖼', 'image/png': '🖼', 'image/webp': '🖼' };

  const reportsHtml = reportFiles.length
    ? reportFiles.map(r => `
        <div class="report-item">
          <div class="report-icon">${fileIcons[r.mime_type] || '📄'}</div>
          <div>
            <div class="report-name">${r.file_name}</div>
            <div class="report-meta">${r.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}${r.file_size ? ' · ' + fmt(r.file_size) : ''}</div>
          </div>
        </div>`).join('')
    : '<p style="color:#5D7B96;font-size:14px;">Your reports are now available in your account.</p>';

  const notesHtml = labNotes
    ? `<div style="background:#EBF5FB;border-left:3px solid #00B4D8;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:8px;">
         <p style="font-size:12px;font-weight:700;color:#1A5276;margin-bottom:4px;">Lab Notes</p>
         <p style="font-size:13px;color:#1A2B3C;line-height:1.6;">${labNotes}</p>
       </div>`
    : '';

  const body = `
    <!-- Greeting -->
    <p style="font-size:15px;color:#5D7B96;margin-bottom:4px;">Hello,</p>
    <h1 style="font-size:22px;font-weight:700;color:#0A3D62;margin-bottom:8px;">
      Your Lab Reports Are Ready! 🎉
    </h1>
    <p style="font-size:15px;line-height:1.7;color:#5D7B96;margin-bottom:24px;">
      Dear <strong style="color:#1A2B3C;">${patientName}</strong>, your diagnostic results are now
      available. You can view and download your reports securely from your LabCollect account.
    </p>

    <!-- Booking details -->
    <div style="background:#F0F4F8;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
                color:#5D7B96;margin-bottom:12px;">Booking Details</p>
      <div class="info-row">
        <span class="info-label">Booking Number</span>
        <span class="info-value" style="font-family:monospace;">${bookingNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tests Conducted</span>
        <span class="info-value" style="max-width:280px;">${tests || '—'}</span>
      </div>
      ${collectionDate ? `
      <div class="info-row">
        <span class="info-label">Collection Date</span>
        <span class="info-value">${fmtDate(collectionDate)}</span>
      </div>` : ''}
      <div class="info-row" style="border-bottom:none;">
        <span class="info-label">Report Status</span>
        <span class="tag green">✓ Reports Ready</span>
      </div>
    </div>

    <!-- Reports list -->
    <p style="font-size:13px;font-weight:700;color:#0A3D62;margin-bottom:10px;">
      ${reportFiles.length} Report${reportFiles.length !== 1 ? 's' : ''} Available
    </p>
    ${reportsHtml}
    ${notesHtml}

    <hr class="divider"/>

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${bookingUrl}" class="btn">View &amp; Download Reports →</a>
      <p style="font-size:12px;color:#5D7B96;margin-top:12px;">
        Or copy this link: <a href="${bookingUrl}">${bookingUrl}</a>
      </p>
    </div>

    <hr class="divider"/>

    <!-- Footer note -->
    <p style="font-size:13px;color:#5D7B96;line-height:1.7;">
      If you have any questions about your results, please contact your doctor or call us at
      <strong style="color:#1A2B3C;">+91 98765 43210</strong>.<br/>
      Reports are available securely in your account for 90 days.
    </p>`;

  try {
    const result = await client.emails.send({
      from:    FROM,
      to:      Array.isArray(to) ? to : [to],
      subject: `Your Lab Reports Are Ready — Booking #${bookingNumber}`,
      html:    htmlShell(body),
      // Plain-text fallback for email clients that don't render HTML
      text: [
        `Hello ${patientName},`,
        '',
        `Your lab reports for booking #${bookingNumber} are now ready.`,
        `Tests: ${tests || '—'}`,
        collectionDate ? `Collection date: ${fmtDate(collectionDate)}` : '',
        labNotes ? `Lab notes: ${labNotes}` : '',
        '',
        `View and download your reports here:`,
        bookingUrl,
        '',
        'LabCollect Diagnostics',
      ].filter(Boolean).join('\n'),
    });

    console.log(`[Email] Report notification sent to ${to} — ID: ${result?.data?.id}`);
    return { success: true, id: result?.data?.id };
  } catch (err) {
    console.error('[Email] Failed to send report notification:', err.message);
    return { success: false, error: err.message };
  }
};

/* ─────────────────────────────────────────────────────────────
   sendBookingConfirmationEmail  (bonus — not yet wired to UI)
   ─────────────────────────────────────────────────────────── */
exports.sendBookingConfirmationEmail = async ({
  to,
  patientName,
  bookingNumber,
  tests,
  collectionType,
  collectionDate,
  collectionTime,
  totalAmount,
  bookingId,
}) => {
  const client = getResend();
  if (!client) return { skipped: true };

  const bookingUrl = `${APP_URL}/bookings/${bookingId}`;

  const body = `
    <p style="font-size:15px;color:#5D7B96;margin-bottom:4px;">Hello,</p>
    <h1 style="font-size:22px;font-weight:700;color:#0A3D62;margin-bottom:8px;">
      Booking Confirmed ✅
    </h1>
    <p style="font-size:15px;line-height:1.7;color:#5D7B96;margin-bottom:24px;">
      Dear <strong style="color:#1A2B3C;">${patientName}</strong>, your booking has been confirmed.
      ${collectionType === 'home'
        ? 'Our trained phlebotomist will visit you at the scheduled time.'
        : 'Please visit our collection centre at the scheduled time.'}
    </p>

    <div style="background:#F0F4F8;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
                color:#5D7B96;margin-bottom:12px;">Booking Summary</p>
      <div class="info-row">
        <span class="info-label">Booking Number</span>
        <span class="info-value" style="font-family:monospace;">${bookingNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tests</span>
        <span class="info-value" style="max-width:280px;">${tests || '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Collection Type</span>
        <span class="info-value" style="text-transform:capitalize;">${collectionType || '—'}</span>
      </div>
      ${collectionDate ? `<div class="info-row"><span class="info-label">Date</span><span class="info-value">${fmtDate(collectionDate)}</span></div>` : ''}
      ${collectionTime ? `<div class="info-row"><span class="info-label">Time</span><span class="info-value">${collectionTime}</span></div>` : ''}
      <div class="info-row" style="border-bottom:none;">
        <span class="info-label">Amount Paid</span>
        <span class="info-value" style="font-size:18px;color:#0A3D62;">₹${parseFloat(totalAmount || 0).toFixed(0)}</span>
      </div>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${bookingUrl}" class="btn">View Booking Details →</a>
    </div>

    <hr class="divider"/>
    <p style="font-size:13px;color:#5D7B96;line-height:1.7;">
      You will receive another email when your reports are ready.<br/>
      Questions? Call us at <strong style="color:#1A2B3C;">+91 98765 43210</strong>.
    </p>`;

  try {
    const result = await client.emails.send({
      from:    FROM,
      to:      Array.isArray(to) ? to : [to],
      subject: `Booking Confirmed — #${bookingNumber} | LabCollect`,
      html:    htmlShell(body),
      text: [
        `Hello ${patientName},`,
        '',
        `Your booking #${bookingNumber} is confirmed.`,
        `Tests: ${tests || '—'}`,
        collectionDate ? `Date: ${fmtDate(collectionDate)} ${collectionTime || ''}` : '',
        `Amount paid: ₹${parseFloat(totalAmount || 0).toFixed(0)}`,
        '',
        `Track your booking: ${bookingUrl}`,
        '',
        'LabCollect Diagnostics',
      ].filter(Boolean).join('\n'),
    });
    console.log(`[Email] Booking confirmation sent to ${to}`);
    return { success: true, id: result?.data?.id };
  } catch (err) {
    console.error('[Email] Failed to send booking confirmation:', err.message);
    return { success: false, error: err.message };
  }
};