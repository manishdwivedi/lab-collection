import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Globe, Key, BookOpen } from 'lucide-react';
import './AdminApiDocs.css';

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="copy-btn" onClick={handle}>
      {copied ? <Check size={12}/> : <Copy size={12}/>}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code, lang = 'bash' }) {
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{lang}</span>
        <CopyBtn text={code}/>
      </div>
      <pre className="code-block-body"><code>{code}</code></pre>
    </div>
  );
}

function Endpoint({ method, path, perm, desc, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="endpoint-card">
      <div className="endpoint-header" onClick={() => setOpen(!open)}>
        <div className="endpoint-left">
          <span className={`http-badge ${method.toLowerCase()}`}>{method}</span>
          <code className="endpoint-path">{path}</code>
          <span className="endpoint-perm">{perm}</span>
        </div>
        <div className="endpoint-right">
          <span className="endpoint-desc">{desc}</span>
          {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
        </div>
      </div>
      {open && <div className="endpoint-body">{children}</div>}
    </div>
  );
}

const BASE = 'https://your-domain.com/api/v1';

export default function AdminApiDocs() {
  return (
    <div className="api-docs-page">
      <div className="page-header">
        <div>
          <div className="page-title">API Documentation</div>
          <div className="page-subtitle">External API reference for third-party integrations</div>
        </div>
        <a href="/admin/api-keys" className="btn btn-primary">
          <Key size={15}/> Manage API Keys
        </a>
      </div>

      {/* Overview */}
      <div className="docs-section">
        <h2 className="docs-h2"><Globe size={18}/> Overview</h2>
        <p className="docs-p">
          The LabCollect External API allows third-party systems (hospital LIMS, clinic software, partner labs)
          to create bookings, check booking status, and upload reports programmatically.
          All requests must be authenticated using an API key.
        </p>

        <div className="docs-info-grid">
          <div className="docs-info-card">
            <div className="dic-label">Base URL</div>
            <code className="dic-value">{BASE}</code>
          </div>
          <div className="docs-info-card">
            <div className="dic-label">Authentication</div>
            <code className="dic-value">X-API-Key: lc_live_xxxx…</code>
          </div>
          <div className="docs-info-card">
            <div className="dic-label">Content-Type</div>
            <code className="dic-value">application/json</code>
          </div>
          <div className="docs-info-card">
            <div className="dic-label">Response Format</div>
            <code className="dic-value">JSON (UTF-8)</code>
          </div>
        </div>

        <CodeBlock lang="bash" code={`# All requests require the X-API-Key header
curl -H "X-API-Key: lc_live_your_api_key_here" \\
     -H "Content-Type: application/json" \\
     ${BASE}/tests`}/>
      </div>

      {/* Auth */}
      <div className="docs-section">
        <h2 className="docs-h2"><Key size={18}/> Authentication & Permissions</h2>
        <p className="docs-p">API keys are created in the admin panel and carry specific permissions:</p>
        <div className="perm-table">
          {[
            { perm:'bookings:read',  desc:'Read booking details and list tests with pricing' },
            { perm:'bookings:write', desc:'Create new bookings via the API' },
            { perm:'reports:write',  desc:'Upload or reference reports for a booking' },
            { perm:'*',             desc:'Full access — all current and future permissions' },
          ].map(p => (
            <div key={p.perm} className="perm-row">
              <code className="perm-code">{p.perm}</code>
              <span>{p.desc}</span>
            </div>
          ))}
        </div>

        <h3 className="docs-h3">Error Responses</h3>
        <CodeBlock lang="json" code={`{
  "success": false,
  "error": "INVALID_API_KEY",       // Machine-readable error code
  "message": "Invalid or expired API key"
}

// Common error codes:
// MISSING_API_KEY       — No API key provided
// INVALID_API_KEY       — Key not found or revoked
// INSUFFICIENT_PERMISSIONS — Key lacks required permission
// VALIDATION_ERROR      — Request body missing required fields
// NOT_FOUND             — Resource not found
// SERVER_ERROR          — Internal server error`}/>
      </div>

      {/* Endpoints */}
      <div className="docs-section">
        <h2 className="docs-h2"><BookOpen size={18}/> Endpoints</h2>

        {/* GET /tests */}
        <Endpoint method="GET" path="/api/v1/tests" perm="bookings:read" desc="List all available tests with pricing">
          <p className="docs-p">Returns all active tests. If your API key is linked to a client with a rate list, client-specific prices are returned.</p>
          <h4 className="docs-h4">Query Parameters</h4>
          <div className="param-table">
            {[
              { name:'category', type:'string', req:false, desc:'Filter by category name' },
              { name:'search',   type:'string', req:false, desc:'Search by test name or code' },
            ].map(p => (
              <div key={p.name} className="param-row">
                <code>{p.name}</code>
                <span className="param-type">{p.type}</span>
                {p.req ? <span className="param-required">required</span> : <span className="param-optional">optional</span>}
                <span>{p.desc}</span>
              </div>
            ))}
          </div>
          <CodeBlock lang="bash" code={`curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/tests?search=thyroid"

# Response
{
  "success": true,
  "count": 3,
  "tests": [
    {
      "id": 6,
      "code": "TPL001",
      "name": "T3, T4, TSH (Thyroid Panel)",
      "category": "Thyroid",
      "sample_type": "Blood (Serum)",
      "report_time": "6-8 hours",
      "fasting_required": false,
      "base_price": "850.00",
      "price": "720.00"    // client-specific price if applicable
    }
  ]
}`}/>
        </Endpoint>

        {/* POST /bookings */}
        <Endpoint method="POST" path="/api/v1/bookings" perm="bookings:write" desc="Create a new booking">
          <p className="docs-p">Creates a booking for a patient. Tests can be specified by ID (<code>test_ids</code>) or by lab code (<code>test_codes</code>). If your API key is linked to a client, the booking is associated with that client and uses its rate list pricing automatically.</p>
          <h4 className="docs-h4">Request Body</h4>
          <div className="param-table">
            {[
              { name:'patient_name',    type:'string',   req:true,  desc:'Full name of the patient' },
              { name:'patient_phone',   type:'string',   req:true,  desc:'Contact number' },
              { name:'patient_age',     type:'integer',  req:false, desc:'Age in years' },
              { name:'patient_gender',  type:'string',   req:false, desc:'male | female | other' },
              { name:'patient_address', type:'string',   req:false, desc:'Patient home address' },
              { name:'test_ids',        type:'array',    req:false, desc:'Array of test IDs (use this OR test_codes)' },
              { name:'test_codes',      type:'array',    req:false, desc:'Array of lab codes e.g. ["CBC001","TSH001"]' },
              { name:'collection_type', type:'string',   req:false, desc:'home (default) | walkin' },
              { name:'collection_date', type:'date',     req:false, desc:'YYYY-MM-DD format' },
              { name:'collection_time', type:'string',   req:false, desc:'e.g. "9:00 AM"' },
              { name:'collection_address',type:'string', req:false, desc:'Address for home collection' },
              { name:'notes',           type:'string',   req:false, desc:'Any special instructions' },
            ].map(p => (
              <div key={p.name} className="param-row">
                <code>{p.name}</code>
                <span className="param-type">{p.type}</span>
                {p.req ? <span className="param-required">required</span> : <span className="param-optional">optional</span>}
                <span>{p.desc}</span>
              </div>
            ))}
          </div>
          <CodeBlock lang="bash" code={`curl -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "patient_name": "Gurpreet Singh",
    "patient_phone": "9876543210",
    "patient_age": 45,
    "patient_gender": "male",
    "test_codes": ["CBC001", "TSH001", "LFT001"],
    "collection_type": "home",
    "collection_date": "2024-12-20",
    "collection_time": "8:00 AM",
    "collection_address": "123 Civil Lines, Ludhiana"
  }' \\
  "${BASE}/bookings"

# Response 201
{
  "success": true,
  "booking": {
    "id": 42,
    "booking_number": "EXT2412xxxx",
    "patient_name": "Gurpreet Singh",
    "patient_phone": "9876543210",
    "total_amount": 1800.00,
    "tests": [
      { "code": "CBC001", "name": "Complete Blood Count", "price": 200 },
      { "code": "TSH001", "name": "TSH Only", "price": 280 },
      { "code": "LFT001", "name": "Liver Function Test", "price": 620 }
    ],
    "status": "pending",
    "created_at": "2024-12-19T14:30:00.000Z"
  },
  "message": "Booking created successfully"
}`}/>
        </Endpoint>

        {/* GET /bookings/:bookingNumber */}
        <Endpoint method="GET" path="/api/v1/bookings/:booking_number" perm="bookings:read" desc="Get booking status">
          <p className="docs-p">Retrieve the current status of a booking by its booking number.</p>
          <CodeBlock lang="bash" code={`curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/bookings/EXT2412xxxx"

# Response
{
  "success": true,
  "booking": {
    "id": 42,
    "booking_number": "EXT2412xxxx",
    "patient_name": "Gurpreet Singh",
    "patient_phone": "9876543210",
    "collection_type": "home",
    "collection_date": "2024-12-20",
    "booking_status": "sample_collected",
    "payment_status": "pending",
    "report_status": "not_uploaded",
    "total_amount": "1800.00",
    "final_amount": "1800.00",
    "tests": "Complete Blood Count, TSH Only, Liver Function Test",
    "created_at": "2024-12-19T14:30:00.000Z"
  }
}`}/>
        </Endpoint>

        {/* POST /bookings/:bookingNumber/reports */}
        <Endpoint method="POST" path="/api/v1/bookings/:booking_number/reports" perm="reports:write" desc="Upload a report for a booking">
          <p className="docs-p">Upload a lab report for a booking. Supports two modes: file upload (multipart) or URL reference (JSON). When a report is uploaded, the booking's <code>report_status</code> is automatically set to <code>ready</code> and if the booking was in <code>processing</code> or <code>sample_collected</code> state, it is moved to <code>completed</code>.</p>

          <h4 className="docs-h4">Mode 1 — File Upload (multipart/form-data)</h4>
          <CodeBlock lang="bash" code={`curl -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -F "report=@/path/to/report.pdf" \\
  -F "notes=All values normal. See page 2 for CBC." \\
  "${BASE}/bookings/EXT2412xxxx/reports"

# Response 201
{
  "success": true,
  "message": "Report uploaded successfully",
  "booking_number": "EXT2412xxxx",
  "file_name": "report.pdf"
}`}/>

          <h4 className="docs-h4" style={{ marginTop:20 }}>Mode 2 — URL Reference (application/json)</h4>
          <p className="docs-p" style={{ marginTop:4 }}>If the report is hosted on your own storage (S3, GCS, etc.), send the URL instead of uploading the file.</p>
          <CodeBlock lang="bash" code={`curl -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "file_url": "https://storage.yourlab.com/reports/patient-42-cbc.pdf",
    "file_name": "CBC_Report_GurpreetSingh.pdf",
    "mime_type": "application/pdf",
    "notes": "Report generated by Thyrocare LIMS"
  }' \\
  "${BASE}/bookings/EXT2412xxxx/reports"

# Response 201
{
  "success": true,
  "message": "Report reference recorded successfully",
  "booking_number": "EXT2412xxxx",
  "file_name": "CBC_Report_GurpreetSingh.pdf"
}`}/>
        </Endpoint>
      </div>

      {/* SDKs / Integrations */}
      <div className="docs-section">
        <h2 className="docs-h2">Integration Examples</h2>

        <h3 className="docs-h3">Node.js</h3>
        <CodeBlock lang="javascript" code={`const axios = require('axios');

const labApi = axios.create({
  baseURL: '${BASE}',
  headers: { 'X-API-Key': process.env.LAB_API_KEY }
});

// Create a booking
const booking = await labApi.post('/bookings', {
  patient_name: 'Gurpreet Singh',
  patient_phone: '9876543210',
  test_codes: ['CBC001', 'TSH001'],
  collection_type: 'home',
  collection_date: '2024-12-20'
});

console.log(booking.data.booking.booking_number);

// Upload a report (from file)
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('report', fs.createReadStream('./report.pdf'));
form.append('notes', 'Test complete');

await labApi.post(\`/bookings/\${bookingNumber}/reports\`, form, {
  headers: form.getHeaders()
});`}/>

        <h3 className="docs-h3" style={{ marginTop:24 }}>Python</h3>
        <CodeBlock lang="python" code={`import requests

API_KEY = "lc_live_your_key_here"
BASE_URL = "${BASE}"
HEADERS  = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# Create booking
resp = requests.post(f"{BASE_URL}/bookings", headers=HEADERS, json={
    "patient_name": "Gurpreet Singh",
    "patient_phone": "9876543210",
    "test_codes": ["CBC001", "TSH001"],
    "collection_type": "home",
    "collection_date": "2024-12-20"
})
booking_number = resp.json()["booking"]["booking_number"]

# Upload report as file
with open("report.pdf", "rb") as f:
    resp = requests.post(
        f"{BASE_URL}/bookings/{booking_number}/reports",
        headers={"X-API-Key": API_KEY},
        files={"report": ("report.pdf", f, "application/pdf")},
        data={"notes": "Results normal"}
    )
print(resp.json())`}/>

        <h3 className="docs-h3" style={{ marginTop:24 }}>PHP</h3>
        <CodeBlock lang="php" code={`<?php
$apiKey  = 'lc_live_your_key_here';
$baseUrl = '${BASE}';

// Create booking
$ch = curl_init("$baseUrl/bookings");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        "X-API-Key: $apiKey",
        "Content-Type: application/json"
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'patient_name'    => 'Gurpreet Singh',
        'patient_phone'   => '9876543210',
        'test_codes'      => ['CBC001', 'TSH001'],
        'collection_type' => 'home',
        'collection_date' => '2024-12-20'
    ])
]);
$response = json_decode(curl_exec($ch), true);
$bookingNumber = $response['booking']['booking_number'];
curl_close($ch);
echo "Booking created: $bookingNumber\\n";
?>`}/>
      </div>
    </div>
  );
}