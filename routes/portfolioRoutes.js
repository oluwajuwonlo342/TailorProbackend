const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { protect } = require('../middleware/auth');
const {
  getMyPortfolio,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getPublicPortfolio
} = require('../controllers/portfolioController');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tailorpro_portfolio',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per image
});

// ==========================================================
// 1. PUBLIC ROUTE (MUST GO BEFORE THE PROTECT MIDDLEWARE)
// ==========================================================
router.get('/public/:userId', getPublicPortfolio);

// ==========================================================
// 2. AUTH MIDDLEWARE (LOCKS DOWN EVERYTHING BELOW THIS LINE)
// ==========================================================
router.use(protect);

// ==========================================================
// 3. SECURE DASHBOARD ROUTES
// ==========================================================
router.get('/', getMyPortfolio);
router.post('/', upload.array('images', 10), createPortfolioItem);
router.put('/:id', upload.array('images', 10), updatePortfolioItem);
router.delete('/:id', deletePortfolioItem);

module.exports = router;
