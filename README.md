# 🧪 LabCollect — Diagnostic Lab Management System

A full-stack web application for managing lab test bookings, home collections, payments, clients, and rate lists.

---

## 🗂️ Project Structure

```
lab-collection/
├── backend/                    # Node.js + Express API
│   ├── config/db.js            # MySQL connection pool
│   ├── controllers/
│   │   ├── authController.js   # Register, Login, Profile
│   │   ├── testController.js   # Test CRUD
│   │   ├── bookingController.js# Booking create/list/update
│   │   ├── paymentController.js# Razorpay integration
│   │   ├── rateListController.js # Rate list CRUD
│   │   └── clientController.js # Client CRUD
│   ├── middleware/auth.js      # JWT protect + adminOnly
│   ├── routes/index.js         # All API routes
│   ├── schema.sql              # DB schema + seed data
│   ├── server.js               # Express app entry
│   └── .env.example            # Environment variables
│
└── frontend/                   # React.js SPA
    └── src/
        ├── context/
        │   ├── AuthContext.js  # Auth state (login/logout/user)
        │   └── CartContext.js  # Cart state for test selection
        ├── utils/api.js        # Axios instance + all API calls
        ├── pages/
        │   ├── patient/
        │   │   ├── HomePage.js         # Landing page
        │   │   ├── TestsPage.js        # Browse & search tests
        │   │   ├── BookingPage.js      # Checkout with patient form
        │   │   ├── PaymentPage.js      # Payment method selection
        │   │   ├── PaymentSuccessPage.js
        │   │   ├── LoginPage.js
        │   │   ├── RegisterPage.js
        │   │   ├── MyBookingsPage.js   # Patient booking history
        │   │   └── BookingDetailPage.js
        │   └── admin/
        │       ├── AdminLogin.js
        │       ├── AdminDashboard.js   # Stats + recent bookings
        │       ├── AdminBookings.js    # All bookings + edit modal
        │       ├── AdminTests.js       # Test catalog management
        │       ├── AdminClients.js     # Client management
        │       ├── AdminRateLists.js   # Rate list list view
        │       └── AdminRateListDetail.js # Per-test price config
        └── components/shared/
            ├── PatientLayout.js  # Navbar + footer
            └── AdminLayout.js    # Sidebar + topbar
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8+

---

### Step 1: Database Setup

```bash
mysql -u root -p
```
```sql
SOURCE /path/to/lab-collection/backend/schema.sql;
```

This creates the database, all tables, and seeds:
- 8 test categories
- 25+ diagnostic tests
- 4 sample clients
- 4 rate lists with item pricing
- 1 admin user

---

### Step 2: Backend Setup

```bash
cd lab-collection/backend
npm install

# Copy and edit environment file
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lab_collection
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
RAZORPAY_KEY_ID=rzp_test_xxxx        # Get from Razorpay dashboard
RAZORPAY_KEY_SECRET=your_secret       # Get from Razorpay dashboard
NODE_ENV=development
```

```bash
npm run dev     # Development with nodemon
# OR
npm start       # Production
```

Backend starts at → **http://localhost:5000**

---

### Step 3: Frontend Setup

```bash
cd lab-collection/frontend
npm install
npm start
```

Frontend starts at → **http://localhost:3000**

> The React app proxies `/api` calls to `http://localhost:5000` automatically.

---

## 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@labcollection.com | Admin@123 |
| Patient | Register a new account | — |

---

## 📋 Feature Overview

### Patient Portal (`/`)
| Page | Description |
|------|-------------|
| `/` | Landing page with categories and popular tests |
| `/tests` | Browse all tests with category filter and search |
| `/book` | Cart checkout with patient form and collection type |
| `/payment/:id` | Payment method selection (Razorpay integration) |
| `/payment-success` | Confirmation page with booking number |
| `/login` | Patient login |
| `/register` | New patient registration |
| `/my-bookings` | List of all patient bookings (login required) |
| `/bookings/:id` | Detailed booking view |

### Admin Panel (`/admin`)
| Page | Description |
|------|-------------|
| `/admin` | Dashboard with stats and recent bookings |
| `/admin/bookings` | All bookings with filters; edit status/payment/schedule |
| `/admin/tests` | Full CRUD for test catalog |
| `/admin/clients` | Client management with rate list assignment |
| `/admin/rate-lists` | List and create rate lists |
| `/admin/rate-lists/:id` | Configure per-test prices in a rate list |

---

## 💳 Payment Integration

The system uses **Razorpay** for payment processing.

### Demo Mode (No Razorpay Account)
The payment flow works in **simulate mode** — clicking "Pay" instantly marks the booking as paid. No Razorpay keys needed.

### Production Mode (Real Payments)
1. Create account at [razorpay.com](https://razorpay.com)
2. Get `Key ID` and `Key Secret` from the dashboard
3. Add to `backend/.env`
4. In `frontend/src/pages/patient/PaymentPage.js`, replace the simulate call:

```javascript
// Replace this in PaymentPage.js handlePayment():
const order = await createPaymentOrder({ booking_id: bookingId });

const options = {
  key: order.data.razorpayKeyId,
  amount: order.data.amount,
  currency: 'INR',
  name: 'LabCollect Diagnostics',
  order_id: order.data.orderId,
  handler: async (response) => {
    await verifyPayment({
      booking_id: bookingId,
      payment_id: response.razorpay_payment_id,
      order_id: response.razorpay_order_id,
      signature: response.razorpay_signature,
    });
    navigate('/payment-success', { state: { bookingNumber, totalAmount } });
  },
};
const rzp = new window.Razorpay(options);
rzp.open();
```

5. Add Razorpay script to `public/index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

## 🗄️ Database Schema

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Patients and admins |
| `test_categories` | Test groupings (Blood, Thyroid, etc.) |
| `tests` | Individual diagnostic tests with base price |
| `clients` | Corporate/hospital clients for home collection |
| `rate_lists` | Independent pricing modules |
| `rate_list_items` | Per-test price within a rate list |
| `client_rate_lists` | Links a rate list to a client (with date range) |
| `bookings` | Patient bookings |
| `booking_items` | Tests within each booking |
| `payments` | Payment transaction log |

### Rate List Flow
```
Rate List (rate_lists)
    │
    ├── Items (rate_list_items)
    │       test_id → price override
    │
    └── Assigned to Client (client_rate_lists)
            client_id → rate_list_id → effective_from/to

When booking is created with client_id:
  → Look up active rate list for client
  → Use rate_list_items price for each test
  → Fall back to tests.base_price if test not in rate list
```

---

## 🔌 API Reference

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me               [protected]
PUT    /api/auth/profile          [protected]
```

### Tests (Public)
```
GET    /api/tests                 ?category_id=&search=
GET    /api/tests/categories
GET    /api/tests/:id
```

### Bookings
```
POST   /api/bookings/create
GET    /api/bookings/my           [protected]
GET    /api/bookings/:id          [protected]
```

### Payments
```
POST   /api/payments/create-order
POST   /api/payments/verify
```

### Admin (all require admin JWT)
```
GET    /api/admin/dashboard
GET    /api/admin/bookings        ?status=&payment_status=&client_id=&date_from=&date_to=&search=
PUT    /api/admin/bookings/:id
POST   /api/admin/tests
PUT    /api/admin/tests/:id
DELETE /api/admin/tests/:id
GET    /api/admin/clients
POST   /api/admin/clients
PUT    /api/admin/clients/:id
DELETE /api/admin/clients/:id
GET    /api/admin/rate-lists
GET    /api/admin/rate-lists/:id
POST   /api/admin/rate-lists
PUT    /api/admin/rate-lists/:id
DELETE /api/admin/rate-lists/:id
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Axios |
| Styling | Custom CSS with CSS variables, Sora + Space Mono fonts |
| Icons | Lucide React |
| State | Context API (Auth + Cart) |
| Backend | Node.js, Express.js |
| Database | MySQL 8 (mysql2/promise) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Payments | Razorpay (simulated in demo) |
| Dev Tools | nodemon |

---

## 🔮 Future Enhancements

- PDF report upload and download
- SMS/WhatsApp notifications via Twilio
- Lab technician assignment module
- Invoice generation (PDF)
- Home collection route mapping
- Multi-branch support
- Patient health records / history
- Doctor referral tracking
