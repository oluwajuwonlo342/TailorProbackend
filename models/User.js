const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { TRIAL_DAYS } = require('../config/plans');

const DAY_MS = 24 * 60 * 60 * 1000;

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 80 },
  businessName: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, trim: true, default: '' },
  profilePhoto: { type: String, default: '' },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isSuspended: { type: Boolean, default: false },

  // Password reset (only a hash of the emailed token is stored)
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  passwordChangedAt: { type: Date },

  // Subscription & SaaS logic
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['trial', 'active', 'expired', 'cancelled', 'free'], default: 'trial' },
  trialStart: { type: Date, default: Date.now },
  trialEnd: {
    type: Date,
    default: () => new Date(Date.now() + TRIAL_DAYS * DAY_MS)
  },
  subscriptionEnd: { type: Date },
}, { timestamps: true });

// Safety net: never include secrets if a user document is ever sent as JSON
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  }
});

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
