const User = require('../models/User');
const formatUser = require('../utils/formatUser');

const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // The form sends "brandName"; the schema stores it as "businessName"
    if (req.body.brandName && req.body.brandName.trim()) {
      user.businessName = req.body.brandName.trim();
    }
    if (req.body.fullName && req.body.fullName.trim()) {
      user.fullName = req.body.fullName.trim();
    }
    if (req.body.phone && req.body.phone.trim()) {
      user.phone = req.body.phone.trim();
    }
    // address is optional, so an empty string is allowed (lets the user clear it)
    if (req.body.address !== undefined) {
      user.address = req.body.address.trim();
    }

    if (req.body.newPassword) {
      user.password = req.body.newPassword; // hashed by the pre('save') hook
    }

    if (req.file) {
      user.profilePhoto = req.file.path; // Cloudinary URL
    }

    await user.save();
console.log('FILE:', req.file?.path, '| SAVED PHOTO:', user.profilePhoto);
    res.status(200).json({ status: 'success', data: formatUser(user) });
  } catch (error) {
    console.error('PROFILE UPDATE CRASH ERROR:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Something went wrong. Please try again.'
    });
  }
};

module.exports = { updateUserProfile };