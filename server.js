require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const userRoutes = require('./routes/userRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();

// Render (and most hosts) put a proxy in front of the app. Without this, every visitor
// appears to come from the proxy's IP, so the rate limiter below would count ALL users together.
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

const allowedOrigins = [
  'https://tailorpro-lpnb.onrender.com', // no trailing slash
  'http://localhost:5173',
  'http://localhost:5174',
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (curl, server-to-server, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// JSON bodies only. Portfolio photo uploads are multipart/form-data (handled by multer
// in the portfolio routes), so this 10kb limit does not affect them.
app.use(express.json({ limit: '10kb' }));

// Log every request so you can see whether it reaches this server
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Rate Limiting (relaxed in development so testing doesn't lock you out)
const limiter = rateLimit({
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  windowMs: 60 * 60 * 1000,
  message: { error: 'Too many requests from this IP, please try again in an hour!' },
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', userRoutes);
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/measurements', require('./routes/measurementRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/portfolio', require('./routes/portfolioRoutes'));

// Unknown API routes (MUST BE BELOW ALL OTHER ROUTES)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
// The frontend reads `err.response.data.error`, so every error response includes both
// `error` and `message` (message kept for anything already relying on it).
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err);

  let statusCode = err.statusCode || err.http_code || 500;
  let message = err.message || err.error?.message || 'Something went wrong. Please try again.';

  // Friendly messages for photo upload problems (multer)
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'One of your photos is too large. Please use images under 5MB.';
    else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many photos selected. Please upload fewer images at a time.';
  }

  // Bad input that Mongoose rejects (e.g. an invalid gender/category value or a bad number)
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(' ');
  }
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for "${err.path}".`;
  }

  res.status(statusCode).json({
    status: 'error',
    error: message,
    message,
  });
});

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connection successful!'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`TailorPro backend running on port ${PORT}`);
});
