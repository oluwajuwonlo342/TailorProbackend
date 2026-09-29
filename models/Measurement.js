const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  
  // Title or Date label for history (e.g., "January 2026 Fitting" or auto-generated date)
  title: { type: String, default: 'Standard Measurement' },
  recordedDate: { type: Date, default: Date.now },
  unit: { type: String, enum: ['inches', 'cm'], default: 'inches' },
  gender: { type: String, enum: ['Male', 'Female', 'Unisex'], default: 'Unisex' },
  
  // Top / Shirt / Gown Measurements
  neck: { type: Number },
  shoulder: { type: Number },
  chest: { type: Number },
  waist: { type: Number },
  armHole: { type: Number },
  sleeveLength: { type: Number },
  bicep: { type: Number },
  wrist: { type: Number },
  topLength: { type: Number },
  bust: { type: Number },
  underBust: { type: Number },
  shoulderToNipple: { type: Number },
  shoulderToUnderBust: { type: Number },
  halfLength: { type: Number },
  gownLength: { type: Number },
  
  // Bottom / Trousers Measurements
  trouserWaist: { type: Number },
  hips: { type: Number },
  thigh: { type: Number },
  knee: { type: Number },
  calf: { type: Number },
  instep: { type: Number },
  trouserLength: { type: Number },
  inseam: { type: Number },
  skirtLength: { type: Number },

  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Measurement', measurementSchema);