const mongoose = require('mongoose');

const subProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  relationship: { type: String, required: true }, // Son, Daughter, Spouse, etc.
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  notes: { type: String },
  // Change measurements from a single sub-object to an array of chronological measurement logs
  measurements: [{
    title: { type: String, default: 'Standard Fitting' },
    recordedDate: { type: Date, default: Date.now },
    unit: { type: String, enum: ['inches', 'cm'], default: 'inches' },
    // Top measurements
    neck: Number, shoulder: Number, chest: Number, waist: Number, armHole: Number, 
    sleeveLength: Number, bicep: Number, wrist: Number, topLength: Number,
    bust: Number, underBust: Number, shoulderToNipple: Number, shoulderToUnderBust: Number, 
    halfLength: Number, gownLength: Number,
    // Bottom measurements
    trouserWaist: Number, hips: Number, thigh: Number, knee: Number, calf: Number, 
    instep: Number, trouserLength: Number, inseam: Number, skirtLength: Number,
    notes: String
  }]
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullName: {
    type: String,
    required: [true, 'Please provide customer name']
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Unisex'],
    default: 'Unisex'
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Please provide a phone number']
  },
  address: {
    type: String
  },
  notes: {
    type: String
  },
  subProfiles: [subProfileSchema] // <--- Added Sub-Profiles Array here!
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
