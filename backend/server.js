require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const cookieParser = require('cookie-parser');
const routes     = require('./routes');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,          // required for cookies to be sent cross-origin
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());      // parse httpOnly refresh cookie

// Serve uploaded reports as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', service: 'Lab Collection API' }));

// Multer / upload error handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 20 MB.' });
  if (err.message?.includes('Only PDF'))
    return res.status(400).json({ success: false, message: err.message });
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server error' });
});

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Lab Collection Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
