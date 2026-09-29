const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  businessName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  address: { type: String, trim: true, default: '' },
  profilePhoto: { type: String, default: '' },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
// Add this inside your UserSchema definition:
isSuspended: {
  type: Boolean,
  default: false
},
  // Subscription & SaaS logic
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['trial', 'active', 'expired', 'cancelled', 'free'], default: 'trial' },
  trialStart: { type: Date, default: Date.now },
  trialEnd: {
    type: Date,
    default: () => new Date(+new Date() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
  },
  subscriptionEnd: { type: Date },
}, { timestamps: true });

// Password hashing
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model('User', userSchema);