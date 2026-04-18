# LabCollect — Diagnostic Lab Management System

> A full-stack, production-grade web application for managing diagnostic lab bookings, home sample collection, phlebotomist dispatch, client portals, report distribution, and third-party lab integration.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Installation & Setup](#5-installation--setup)
6. [Environment Variables](#6-environment-variables)
7. [Running the Application](#7-running-the-application)
8. [User Roles & Access](#8-user-roles--access)
9. [Demo Credentials](#9-demo-credentials)
10. [Feature Guide](#10-feature-guide)
11. [Full API Reference](#11-full-api-reference)
12. [Payment Integration](#12-payment-integration)
13. [Database Migrations](#13-database-migrations)
14. [Frontend Pages Reference](#14-frontend-pages-reference)
15. [Deployment](#15-deployment)
16. [Future Enhancements](#16-future-enhancements)

---

## 1. Project Overview

LabCollect manages the full lifecycle of a diagnostic lab operation — from patient walk-in to report delivery — including corporate client management, home collection dispatch, and integration with external lab networks.

| Capability | Description |
|---|---|
| **Patient Booking** | Browse tests, add to cart, book with home/walk-in collection, pay online |
| **Admin Panel** | Full control over bookings, tests, staff, clients, and system settings |
| **Client Portal** | Corporate/hospital clients log in to view and create bookings under their account |
| **Home Collection** | Phlebotomists are assigned to home-collection bookings and view their daily schedule |
| **Rate Lists** | Custom per-test pricing tables created independently and assigned to clients |
| **Report Management** | Admins upload PDF/image reports; patients and clients download them securely |
| **Third-Party Lab Push** | Bookings can be pushed to external labs (Thyrocare, SRL, etc.) via configurable HTTP APIs |
| **External API** | Third-party hospital LIMS can create bookings and upload reports using API keys |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router v6, Axios, Context API |
| **Styling** | Custom CSS with CSS variables, Sora + Space Mono (Google Fonts) |
| **Icons** | Lucide React |
| **Backend** | Node.js 18+, Express.js 4 |
| **Database** | MySQL 8 with mysql2/promise connection pooling |
| **Authentication** | JWT (jsonwebtoken), bcryptjs for password hashing |
| **File Uploads** | Multer — disk storage, PDF + image validation, 20 MB max |
| **Payments** | Razorpay (simulated in demo mode) |
| **External HTTP** | Node.js built-in `https`/`http` — no extra dependencies |

---

## 3. Project Structure

```
lab-collection/
├── backend/
│   ├── config/
│   │   └── db.js                      # MySQL connection pool
│   ├── controllers/
│   │   ├── authController.js          # Register, login, JWT, profile
│   │   ├── bookingController.js       # Booking CRUD, dashboard stats
│   │   ├── clientController.js        # Client company CRUD
│   │   ├── clientPortalController.js  # Client portal + admin booking create
│   │   ├── testController.js          # Test and category CRUD
│   │   ├── paymentController.js       # Razorpay order and verification
│   │   ├── reportController.js        # Report upload, download, delete
│   │   ├── phleboController.js        # Phlebotomist CRUD and assignment
│   │   ├── rateListController.js      # Rate list CRUD and items
│   │   ├── apiKeyController.js        # API key management and audit logs
│   │   ├── externalApiController.js   # External API v1 endpoints
│   │   └── labPushController.js       # Push to 3rd-party lab, lab CRUD
│   ├── middleware/
│   │   ├── auth.js                    # JWT protect, role guards
│   │   ├── apiKeyAuth.js              # API key auth with permission checks
│   │   └── upload.js                  # Multer configuration
│   ├── routes/
│   │   └── index.js                   # All routes (session + external API v1)
│   ├── schema.sql                     # Full DB schema + seed data
│   ├── migration_reports.sql          # Adds: booking_reports table
│   ├── migration_phlebo_client.sql    # Adds: phlebotomists, client_users
│   ├── migration_api.sql              # Adds: api_clients, third_party_labs, lab_pushes
│   ├── server.js                      # Express entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/
    └── src/
        ├── App.js                     # Router + route guards
        ├── index.css                  # Global CSS variables + shared styles
        ├── context/
        │   ├── AuthContext.js         # Auth state (login/logout/user)
        │   └── CartContext.js         # Shopping cart for test selection
        ├── utils/
        │   └── api.js                 # Axios instance + all API helpers
        ├── components/
        │   ├── shared/
        │   │   ├── PatientLayout.js   # Public navbar + footer
        │   │   └── AdminLayout.js     # Admin sidebar + topbar
        │   ├── admin/
        │   │   ├── ReportUploadModal  # Drag-and-drop report uploader
        │   │   └── PushToLabModal     # Push booking to external lab
        │   └── client/
        │       └── ClientLayout.js    # Client portal sidebar
        └── pages/
            ├── patient/               # Homepage, Tests, Booking, Payment, My Bookings
            ├── admin/                 # Dashboard, Bookings, Tests, Clients, Phlebos,
            │                         # Rate Lists, Labs, API Keys, API Docs
            └── client/               # Login, Dashboard, Bookings, New Booking, Detail
```

---

## 4. Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `users` | All users — patients, admins, phlebotomists, client portal users |
| `test_categories` | Test groupings (Blood, Thyroid, Diabetes, etc.) |
| `tests` | Individual diagnostic tests with base pricing |
| `bookings` | Patient bookings (all types and sources) |
| `booking_items` | Tests attached to each booking with per-item pricing |
| `payments` | Payment transaction log |
| `booking_reports` | Uploaded report files linked to bookings |

### Extended Tables

| Table | Purpose |
|---|---|
| `clients` | Corporate/hospital clients for bulk or home collection |
| `client_users` | Portal login users linked to a client company |
| `rate_lists` | Independent pricing modules |
| `rate_list_items` | Per-test custom prices within a rate list |
| `client_rate_lists` | Rate list → client assignment with effective date range |
| `phlebotomists` | Phlebotomist profiles linked to user accounts |
| `third_party_labs` | External lab configs (URL, auth type, test code mapping) |
| `lab_pushes` | Log of every push attempt to a third-party lab |
| `api_clients` | External API key records with permissions |
| `api_audit_log` | Every external API request received |

### User Roles

| Role | Description |
|---|---|
| `patient` | Default — books tests through the website |
| `admin` | Full system access |
| `phlebo` | Views their assigned home-collection schedule |
| `client_user` | Client portal user — creates/views bookings for their organisation |

### Rate List Pricing Flow

```
When a booking is created with a client_id:
  1. Look up the client's active rate list (from client_rate_lists)
  2. For each test in the booking:
     a. Check rate_list_items for a custom price → use it
     b. If not found → use tests.base_price
  3. Sum all prices → total_amount and final_amount on the booking
```

---

## 5. Installation & Setup

### Prerequisites

- Node.js 18 or higher
- MySQL 8.0 or higher
- npm 9+

### Step 1 — Set up the database

```bash
mysql -u root -p
```

```sql
SOURCE /full/path/to/lab-collection/backend/schema.sql;
```

This creates `lab_collection` and seeds it with 8 categories, 25 tests, 4 clients, 4 rate lists, and 1 admin user.

Then run all migrations in order:

```bash
mysql -u root -p lab_collection < backend/migration_reports.sql
mysql -u root -p lab_collection < backend/migration_phlebo_client.sql
mysql -u root -p lab_collection < backend/migration_api.sql
```

### Step 2 — Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials and secrets
npm install
```

### Step 3 — Install frontend dependencies

```bash
cd ../frontend
npm install
```

The frontend proxies all `/api` calls to `http://localhost:5000` automatically (configured via `"proxy"` in `frontend/package.json`).

---

## 6. Environment Variables

Set all variables in `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lab_collection

# JWT
JWT_SECRET=replace_with_a_64_char_random_string
JWT_EXPIRE=7d

# Razorpay (leave blank for demo/simulated payments)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Express server port |
| `DB_HOST` | Yes | — | MySQL host |
| `DB_USER` | Yes | — | MySQL username |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DB_NAME` | Yes | `lab_collection` | Database name |
| `JWT_SECRET` | Yes | — | Secret for JWT signing (use 64+ random chars) |
| `JWT_EXPIRE` | No | `7d` | Token lifetime |
| `RAZORPAY_KEY_ID` | For live payments | — | From Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | For live payments | — | From Razorpay dashboard |

---

## 7. Running the Application

### Development

Open two terminals:

**Terminal 1 — Backend (port 5000):**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend (port 3000):**
```bash
cd frontend
npm start
```

Open: **http://localhost:3000**

### Production Build

```bash
cd frontend && npm run build
cd ../backend && npm start
```

---

## 8. User Roles & Access

| Role | Login URL | What they can do |
|---|---|---|
| **Patient** | `/login` | Browse tests, book, pay, view bookings, download reports |
| **Admin** | `/admin/login` | Full access to all features and settings |
| **Phlebotomist** | `/login` | View their assigned home-collection schedule |
| **Client User** | `/client/login` | View and create bookings for their organisation |

---

## 9. Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@labcollection.com` | `Admin@123` |
| Client Portal (Apollo) | `portal@apolloclinics.com` | `Admin@123` |
| Phlebotomist | `rajiv.phlebo@labcollection.com` | `Admin@123` |
| Patient | Register a new account at `/register` | — |

---

## 10. Feature Guide

### Patient Portal (`/`)

1. **Browse Tests** — Visit `/tests`. Filter by category or search. Each test shows sample type, report time, fasting requirement, and price.
2. **Add to Cart** — Click **Add** on any test. Manage your cart from the navbar.
3. **Book** — Go to `/book`. Fill patient details, choose home or walk-in collection, pick a date and time.
4. **Pay** — In demo mode, clicking Pay immediately confirms the booking. In production, Razorpay checkout opens.
5. **My Bookings** — At `/my-bookings` after login. Click any booking for full detail including downloadable reports.

### Admin Panel (`/admin`)

#### Dashboard
Live stats: today's bookings and revenue, monthly totals, status breakdown chart, 5 most recent bookings.

#### Bookings (`/admin/bookings`)
Each row has four action buttons:

| Button | Action |
|---|---|
| ✏️ Edit | Change status, payment status, collection date/time, notes |
| 👤 Assign Phlebo | Pick a phlebotomist (home-collection only) — shows workload |
| 📁 Reports | Upload PDFs/images; existing reports listed with download and delete |
| 📤 Push | Push the booking to a third-party lab |

The **Create Booking** button at the top lets admin create a booking on behalf of any client.

Filters: status, payment status, date range, free-text search on booking number or patient name.

#### Tests (`/admin/tests`)
Create, edit, and deactivate tests. Assign to categories. Set sample type, report time, fasting flag, and base price.

#### Clients (`/admin/clients`)
Add/edit corporate clients. Set credit limit, payment terms, and GST number. Assign a rate list with an effective date. The 🔑 **Portal Users** button creates login accounts for the client's staff.

#### Rate Lists (`/admin/rate-lists`)
Create named rate lists (e.g. "Apollo Special Rate"). Open the detail page to add individual tests with custom prices. Savings vs base price are shown per row in real-time. Rate lists are created first, then assigned to clients — they are fully independent.

#### Phlebotomists (`/admin/phlebos`)
Add phlebotomists (creates a user account + profile). Track daily assignments and pending tasks. Toggle availability. Default password for new phlebotomists is `Phlebo@123`.

#### Third-Party Labs (`/admin/labs`)
Configure external lab APIs. Set authentication method, endpoint, and test code mapping (JSON). View total successful pushes and today's failures.

#### API Keys (`/admin/api-keys`)
Create API keys with specific permissions. The raw key is shown **once** immediately after creation — copy it then. Rotate (regenerate) or revoke keys at any time. Last-used timestamp is tracked per key.

#### API Docs (`/admin/api-docs`)
Built-in interactive API documentation with collapsible endpoints, full request/response examples, and copy-paste code samples in cURL, Node.js, Python, and PHP.

### Client Portal (`/client/login`)

1. **Dashboard** — Stats (total, active, completed, reports ready) and recent bookings table.
2. **Bookings** — Full filterable list with phlebo assignment and report status shown per booking.
3. **New Booking** — Two-step wizard: select tests (shows client-specific prices), then patient and collection details.
4. **Booking Detail** — Phlebotomist info, report download, tests ordered, payment summary.

### Report Upload

**Admin via UI:**
- Bookings → 📁 button → drag-and-drop files
- Supports PDF, JPG, PNG, WEBP — up to 10 files, 20 MB each
- Optional lab notes per upload session
- Automatically sets `report_status = ready` and advances booking to `completed` if it was in `processing` or `sample_collected`

**External lab via API:**
```bash
# File upload
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -F "report=@result.pdf" -F "notes=All values normal" \
  http://localhost:5000/api/v1/bookings/BK2412xxxx/reports

# URL reference (file stored on lab's own server)
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_url":"https://lab.com/report.pdf","file_name":"report.pdf"}' \
  http://localhost:5000/api/v1/bookings/BK2412xxxx/reports
```

Reports are downloaded through the backend with authentication — files are never publicly accessible.

### Phlebotomist Management

1. **Create** — From `/admin/phlebos`. Creates both a user account (role: `phlebo`) and a linked profile.
2. **Assign** — Click 👤 on any home-collection booking row. The modal shows workload (Free / Moderate / Busy) per phlebotomist for that date.
3. **Phlebo view** — Log in at `/login`, then use the API `GET /api/phlebo/assignments?date=YYYY-MM-DD` to see assignments.

### Rate Lists

**Workflow:**
```
1. Admin → Rate Lists → Create Rate List (give it a name)
2. System opens the Rate List Detail page
3. Click "Add Tests" → side panel → click tests to add them
4. Edit price in the "Rate List Price" column (savings shown vs base)
5. Click Save Rate List
6. Admin → Clients → Edit client → Assign this rate list + effective date
```

When a booking is made via that client, prices come from the rate list automatically.

### Third-Party Lab Push

1. **Configure** — Go to `/admin/labs`, create a lab config with its API URL, auth method, and test code mapping.
2. **Push** — On the Bookings page, click the purple 📤 button → select lab → optionally enable Dry Run to preview the payload → click Push.
3. **Track** — The modal shows success/failure, HTTP status, and the external reference returned by the lab. Full push history is logged per booking.

**Button colours on booking rows:**
- Gray = not pushed yet
- Green = successfully pushed
- Red = last push failed (retry available)

### External API

API key auth via `X-API-Key` header. Keys are created in `/admin/api-keys` with specific permissions. When a key is linked to a client, all bookings created through that key are automatically associated with the client and priced using its rate list.

---

## 11. Full API Reference

All responses are JSON. Protected routes require `Authorization: Bearer <token>`. External API routes require `X-API-Key: <key>`.

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register patient |
| POST | `/api/auth/login` | Public | Login (all roles) |
| GET | `/api/auth/me` | JWT | Current user |
| PUT | `/api/auth/profile` | JWT | Update profile |

**Login response:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": 1, "name": "Gurpreet", "email": "...", "role": "patient" }
}
```

### Tests (Public)

| Method | Endpoint | Params | Description |
|---|---|---|---|
| GET | `/api/tests` | `category_id`, `search` | All active tests |
| GET | `/api/tests/categories` | — | All categories |
| GET | `/api/tests/:id` | — | Single test |

### Patient Bookings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings/create` | Public | Create booking |
| GET | `/api/bookings/my` | JWT | Patient's bookings |
| GET | `/api/bookings/:id` | JWT | Single booking |

**Create booking body:**
```json
{
  "patient_name": "Gurpreet Singh",
  "patient_age": 45,
  "patient_gender": "male",
  "patient_phone": "9876543210",
  "patient_address": "123 Civil Lines, Ludhiana",
  "test_ids": [1, 6, 13],
  "collection_type": "home",
  "collection_date": "2024-12-20",
  "collection_time": "9:00 AM",
  "collection_address": "Same as above",
  "notes": "Patient is diabetic"
}
```

### Reports

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/bookings/:bookingId/reports` | JWT | List reports |
| GET | `/api/reports/:reportId/download` | JWT | Stream download |

### Payments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/payments/create-order` | Public | Create Razorpay order |
| POST | `/api/payments/verify` | Public | Verify payment |
| GET | `/api/payments/booking/:id` | JWT | Payment log |

**Demo payment body:**
```json
{ "booking_id": 42, "simulate_success": true }
```

### Phlebotomist Self-Service

| Method | Endpoint | Auth | Params |
|---|---|---|---|
| GET | `/api/phlebo/assignments` | JWT (phlebo/admin) | `date` YYYY-MM-DD |

### Client Portal API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/client/profile` | JWT (client_user) | Client company info |
| GET | `/api/client/tests` | JWT (client_user) | Tests with client prices |
| GET | `/api/client/bookings` | JWT (client_user) | All client bookings |
| GET | `/api/client/bookings/:id` | JWT (client_user) | Booking detail + reports |
| POST | `/api/client/bookings` | JWT (client_user) | Create booking |

**GET /api/client/bookings params:** `status`, `date_from`, `date_to`, `search`

### Admin — Bookings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | Stats for dashboard |
| GET | `/api/admin/bookings` | All bookings (filterable) |
| POST | `/api/admin/bookings` | Admin creates booking |
| PUT | `/api/admin/bookings/:id` | Update status, payment, schedule |
| POST | `/api/admin/bookings/:id/assign-phlebo` | Assign phlebotomist |
| POST | `/api/admin/bookings/:id/push-to-lab` | Push to 3rd-party lab |
| GET | `/api/admin/bookings/:id/push-log` | Push history |

**GET /api/admin/bookings params:** `status`, `payment_status`, `client_id`, `date_from`, `date_to`, `search`

**Assign phlebo body:** `{ "phlebo_id": 2 }` (set to `null` to remove)

**Push to lab body:** `{ "lab_id": 1, "dry_run": false }`

### Admin — Reports

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/bookings/:bookingId/reports` | Upload reports (multipart, field: `reports`) |
| DELETE | `/api/admin/reports/:reportId` | Soft-delete report |

### Admin — Tests

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/tests` | Create test |
| PUT | `/api/admin/tests/:id` | Update test |
| DELETE | `/api/admin/tests/:id` | Deactivate test |
| POST | `/api/admin/categories` | Create category |

### Admin — Clients

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/clients` | List clients |
| GET | `/api/admin/clients/:id` | Client detail |
| POST | `/api/admin/clients` | Create client |
| PUT | `/api/admin/clients/:id` | Update client |
| DELETE | `/api/admin/clients/:id` | Deactivate |
| GET | `/api/admin/clients/:clientId/users` | List portal users |
| POST | `/api/admin/clients/:clientId/users` | Create portal user |
| DELETE | `/api/admin/client-users/:id` | Deactivate portal user |

### Admin — Rate Lists

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/rate-lists` | List all rate lists |
| GET | `/api/admin/rate-lists/:id` | Rate list + items |
| POST | `/api/admin/rate-lists` | Create |
| PUT | `/api/admin/rate-lists/:id` | Update (with items array) |
| DELETE | `/api/admin/rate-lists/:id` | Deactivate |

**PUT body:**
```json
{
  "name": "Apollo Special",
  "discount_type": "fixed",
  "is_active": true,
  "items": [
    { "test_id": 1, "price": 200.00 },
    { "test_id": 6, "price": 700.00 }
  ]
}
```

### Admin — Phlebotomists

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/phlebos/available` | Available phlebos + workload (`?date=`) |
| GET | `/api/admin/phlebos` | All phlebotomists |
| GET | `/api/admin/phlebos/:id` | Detail + assignments |
| POST | `/api/admin/phlebos` | Create |
| PUT | `/api/admin/phlebos/:id` | Update |
| DELETE | `/api/admin/phlebos/:id` | Deactivate |

### Admin — Third-Party Labs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/labs` | List labs with push stats |
| GET | `/api/admin/labs/:id` | Lab detail (auth key masked) |
| POST | `/api/admin/labs` | Create lab config |
| PUT | `/api/admin/labs/:id` | Update |
| DELETE | `/api/admin/labs/:id` | Deactivate |
| GET | `/api/admin/lab-push-history` | All push attempts |

**Create lab body:**
```json
{
  "name": "Thyrocare Technologies",
  "code": "THYROCARE",
  "api_base_url": "https://api.thyrocare.com/v1",
  "auth_type": "api_key",
  "auth_key_name": "X-API-Key",
  "auth_key_value": "your_thyrocare_key",
  "booking_endpoint": "/order/create",
  "test_code_mapping": {
    "CBC001": "CBC",
    "TSH001": "T3T4TSH",
    "LFT001": "LFT"
  },
  "timeout_seconds": 30,
  "retry_attempts": 3
}
```

**auth_type options:** `api_key`, `bearer`, `basic`, `oauth2`

### Admin — API Keys

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/api-clients` | List all API keys |
| POST | `/api/admin/api-clients` | Create key (raw key returned once) |
| PUT | `/api/admin/api-clients/:id` | Update name/permissions |
| POST | `/api/admin/api-clients/:id/rotate` | Regenerate key |
| DELETE | `/api/admin/api-clients/:id` | Revoke key |
| GET | `/api/admin/api-clients/:id/audit` | Audit log for key |
| GET | `/api/admin/api-audit-log` | All audit logs |

**Create API key body:**
```json
{
  "name": "Apollo LIMS Integration",
  "description": "Used by Apollo clinic management system",
  "client_id": 1,
  "permissions": ["bookings:write", "bookings:read", "reports:write"],
  "rate_limit": 100,
  "expires_at": "2025-12-31T23:59:59"
}
```

**Permissions:** `bookings:read`, `bookings:write`, `reports:write`, `*` (full access)

**Create response (raw key shown once only):**
```json
{
  "success": true,
  "message": "API key created. Copy the key now — it will NOT be shown again.",
  "apiKey": "lc_live_a3f9b2c8d1e4f6a0b7c2d5e8f1a4b9c3...",
  "prefix": "lc_live_a3f9"
}
```

### External API v1

**Base URL:** `http://localhost:5000/api/v1`
**Auth header:** `X-API-Key: lc_live_your_key_here`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/api/v1/tests` | `bookings:read` | Tests with client-specific pricing |
| POST | `/api/v1/bookings` | `bookings:write` | Create booking |
| GET | `/api/v1/bookings/:booking_number` | `bookings:read` | Get booking status |
| POST | `/api/v1/bookings/:booking_number/reports` | `reports:write` | Upload report |

**GET /api/v1/tests params:** `category`, `search`

**POST /api/v1/bookings body:**
```json
{
  "patient_name": "Harpreet Kaur",
  "patient_phone": "9876543210",
  "patient_age": 32,
  "patient_gender": "female",
  "patient_address": "456 Model Town, Ludhiana",
  "test_codes": ["CBC001", "TSH001", "LFT001"],
  "collection_type": "home",
  "collection_date": "2024-12-20",
  "collection_time": "9:00 AM",
  "collection_address": "Same as patient address",
  "notes": "Request morning slot"
}
```

Use `test_ids` (integer array) or `test_codes` (string array) — not both.

**POST /api/v1/bookings/:number/reports — multipart:**
```bash
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -F "report=@result.pdf" \
  -F "notes=All values normal" \
  http://localhost:5000/api/v1/bookings/EXT2412xxxx/reports
```

**POST /api/v1/bookings/:number/reports — JSON URL:**
```bash
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "file_url": "https://storage.yourlab.com/report.pdf",
    "file_name": "CBC_Report.pdf",
    "mime_type": "application/pdf",
    "notes": "Generated by Thyrocare LIMS"
  }' \
  http://localhost:5000/api/v1/bookings/EXT2412xxxx/reports
```

**Standard error format:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "patient_name and patient_phone are required"
}
```

**Error codes:** `MISSING_API_KEY` · `INVALID_API_KEY` · `INSUFFICIENT_PERMISSIONS` · `VALIDATION_ERROR` · `NO_VALID_TESTS` · `NOT_FOUND` · `SERVER_ERROR`

**Integration examples:**

```javascript
// Node.js
const axios = require('axios');
const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
  headers: { 'X-API-Key': process.env.LAB_API_KEY }
});
const result = await api.post('/bookings', {
  patient_name: 'Gurpreet Singh',
  patient_phone: '9876543210',
  test_codes: ['CBC001', 'TSH001'],
  collection_type: 'home',
  collection_date: '2024-12-20'
});
```

```python
# Python
import requests
r = requests.post('http://localhost:5000/api/v1/bookings',
  headers={'X-API-Key': 'lc_live_your_key', 'Content-Type': 'application/json'},
  json={
    'patient_name': 'Gurpreet Singh',
    'patient_phone': '9876543210',
    'test_codes': ['CBC001', 'TSH001'],
    'collection_type': 'home',
    'collection_date': '2024-12-20'
  }
)
print(r.json()['booking']['booking_number'])
```

---

## 12. Payment Integration

### Demo Mode

Works out of the box — no Razorpay account needed. The frontend sends `simulate_success: true` and the booking is immediately confirmed.

### Production Mode (Razorpay)

1. Create account at [razorpay.com](https://razorpay.com), get `Key ID` and `Key Secret`
2. Add to `backend/.env`
3. Add to `frontend/public/index.html`:
   ```html
   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
   ```
4. Update `frontend/src/pages/patient/PaymentPage.js` — replace simulate call with:
   ```javascript
   const order = await createPaymentOrder({ booking_id: bookingId });
   const options = {
     key: order.data.razorpayKeyId,
     amount: order.data.amount,
     currency: 'INR',
     order_id: order.data.orderId,
     handler: async (response) => {
       await verifyPayment({
         booking_id: bookingId,
         payment_id: response.razorpay_payment_id,
         order_id: response.razorpay_order_id,
         signature: response.razorpay_signature,
       });
       navigate('/payment-success', { state: { bookingNumber, totalAmount } });
     }
   };
   new window.Razorpay(options).open();
   ```

---

## 13. Database Migrations

Run SQL files in this exact order:

| Order | File | What it adds |
|---|---|---|
| 1 | `schema.sql` | Full database + all tables + seed data |
| 2 | `migration_reports.sql` | `booking_reports` table, `report_status` column on `bookings` |
| 3 | `migration_phlebo_client.sql` | `phlebotomists`, `client_users` tables; `phlebo_id`, `phlebo_assigned_at` on `bookings`; extended user roles |
| 4 | `migration_api.sql` | `api_clients`, `third_party_labs`, `lab_pushes`, `api_audit_log` tables; `external_booking_ref`, `pushed_to_lab_id`, `push_status` on `bookings` |

```bash
# All in one go
mysql -u root -p < backend/schema.sql
mysql -u root -p lab_collection < backend/migration_reports.sql
mysql -u root -p lab_collection < backend/migration_phlebo_client.sql
mysql -u root -p lab_collection < backend/migration_api.sql
```

---

## 14. Frontend Pages Reference

### Patient Pages (`/`)

| URL | Page | Auth Required |
|---|---|---|
| `/` | Home — hero, categories, popular tests | No |
| `/tests` | Browse all tests with filters and search | No |
| `/book` | Cart checkout with patient details form | No |
| `/payment/:bookingId` | Payment method selection and confirmation | No |
| `/payment-success` | Payment success confirmation | No |
| `/login` | Patient / phlebotomist login | No |
| `/register` | New patient registration | No |
| `/my-bookings` | Booking history list | Yes (patient) |
| `/bookings/:id` | Full booking detail with report download | Yes (patient) |

### Admin Pages (`/admin/*`)

| URL | Page |
|---|---|
| `/admin/login` | Admin login (split-screen design) |
| `/admin` | Dashboard with live stats |
| `/admin/bookings` | All bookings — edit, assign phlebo, upload reports, push to lab |
| `/admin/phlebos` | Phlebotomist roster with today's assignments |
| `/admin/tests` | Test catalog CRUD |
| `/admin/clients` | Client management with portal user control |
| `/admin/rate-lists` | Rate list library |
| `/admin/rate-lists/:id` | Rate list configurator with per-test price editor |
| `/admin/labs` | Third-party lab API configurations |
| `/admin/api-keys` | API key management with one-time reveal |
| `/admin/api-docs` | Interactive API documentation |

### Client Portal Pages (`/client/*`)

| URL | Page |
|---|---|
| `/client/login` | Client portal login |
| `/client` | Dashboard with org stats and recent bookings |
| `/client/bookings` | Full bookings list with filters |
| `/client/bookings/:id` | Booking detail — phlebo info and report download |
| `/client/new` | Two-step new booking wizard |

---

## 15. Deployment

### Pre-deployment Checklist

- [ ] `NODE_ENV=production` in `.env`
- [ ] Strong random `JWT_SECRET` (minimum 64 characters)
- [ ] Real Razorpay keys configured
- [ ] MySQL dedicated non-root user with limited permissions
- [ ] SSL/TLS certificate (HTTPS) configured on the server
- [ ] CORS origin in `server.js` updated to your production domain
- [ ] `uploads/reports/` directory exists and is writable by the Node process
- [ ] PM2 or similar process manager configured

### Nginx Reverse Proxy

```nginx
server {
  listen 443 ssl;
  server_name yourdomain.com;

  # React frontend
  location / {
    root /var/www/labcollect/frontend/build;
    try_files $uri $uri/ /index.html;
  }

  # Express API
  location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 25M;
  }
}
```

### PM2

```bash
npm install -g pm2
cd /var/www/labcollect/backend
pm2 start server.js --name "labcollect-api" --env production
pm2 save && pm2 startup
```

### Build frontend

```bash
cd /var/www/labcollect/frontend
npm run build
```

---

## 16. Future Enhancements

| Feature | Description |
|---|---|
| SMS / WhatsApp Alerts | Booking confirmations and report-ready notifications via Twilio / MSG91 |
| PDF Invoice Generation | Branded PDF invoices using PDFKit or Puppeteer |
| Barcode / QR Samples | Barcodes for sample tubes generated at collection time |
| Route Optimization | Map-based daily route planning for phlebotomists |
| Multi-Branch Support | Multiple collection centres under one admin |
| Doctor Referral Tracking | Track referring physicians and calculate commissions |
| Longitudinal Health Records | Patient health trend graphs across historical reports |
| Scheduled Reminders | Cron jobs to send pre-collection reminders |
| OTP / OAuth Login | Phone OTP or Google login for patients |
| Incoming Webhooks | Receive result callbacks from external labs using `report_webhook_secret` |
| React Native App | Mobile app for patients and phlebotomists |
| NABL Audit Module | Track NABL accreditation requirements and equipment calibration logs |

---

*Built with Node.js · React · MySQL — Designed for diagnostic labs in India*
