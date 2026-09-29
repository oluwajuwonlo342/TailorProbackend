const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Import your controller function
const { updateUserProfile } = require('../controllers/userController');

// Import your authentication middleware (adjust the path if yours is different)
const { protect } = require('../middleware/auth'); 

// 1. Configure Cloudinary with your .env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tailorpro_profiles',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// 3. THIS IS THE ROUTE THAT FIXES THE 404 ERROR
// It listens for: PUT http://localhost:5000/api/users/profile
router.put('/profile', protect, upload.single('profilePhoto'), updateUserProfile);

// 4. Export the router so server.js can use it
module.exports = router;