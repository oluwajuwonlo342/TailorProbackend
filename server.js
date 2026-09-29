require('dotenv').config(); 
const express = require('express'); 
const mongoose = require('mongoose'); 
const cors = require('cors'); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 

const userRoutes = require('./routes/userRoutes'); 
const subscriptionRoutes = require('./routes/subscriptionRoutes'); 

const app = express(); 

// Security Middleware 
app.use(helmet()); 
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:5174'], 
  credentials: true 
})); 
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
  message: { error: 'Too many requests from this IP, please try again in an hour!' } 
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
app.use('/api/subscriptions', require('./routes/subscriptionRoutes')); 
app.use('/api/contact', require('./routes/contactRoutes')); // MUST BE HERE

// Unknown API routes (MUST BE BELOW ALL OTHER ROUTES)
app.use('/api', (req, res) => { 
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` }); 
}); // <-- NEW CONTACT ROUTE



// Global Error Handler 
app.use((err, req, res, next) => { 
  console.error('GLOBAL ERROR:', err); 
  res.status(err.statusCode || err.http_code || 500).json({ 
    status: 'error', 
    message: err.message || err.error?.message || 'Something went wrong. Please try again.' 
  }); 
}); 

// Database connection 
mongoose.connect(process.env.MONGO_URI) 
  .then(() => console.log('MongoDB connection successful!')) 
  .catch(err => console.error('MongoDB connection error:', err)); 

const PORT = process.env.PORT || 5000; 
app.listen(PORT, () => { 
  console.log(`TailorPro backend running on port ${PORT}`); 
});