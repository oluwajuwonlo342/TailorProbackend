const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  subProfileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetType: { type: String, default: 'customer' },
  
  // Title or Date label for history (e.g., "January 2026 Fitting" or auto-generated date)
  title: { type: String, default: 'Standard Measurement' },
  recordedDate: { type: Date, default: Date.now },
  unit: { type: String, enum: ['inches', 'cm'], default: 'inches' },
  gender: { type: String, enum: ['Male', 'Female', 'Unisex'], default: 'Unisex' },
  
  // Predefined Top / Shirt / Gown Measurements
  neck: { type: mongoose.Schema.Types.Mixed },
  shoulder: { type: mongoose.Schema.Types.Mixed },
  chest: { type: mongoose.Schema.Types.Mixed },
  waist: { type: mongoose.Schema.Types.Mixed },
  armHole: { type: mongoose.Schema.Types.Mixed },
  sleeveLength: { type: mongoose.Schema.Types.Mixed },
  bicep: { type: mongoose.Schema.Types.Mixed },
  wrist: { type: mongoose.Schema.Types.Mixed },
  topLength: { type: mongoose.Schema.Types.Mixed },
  bust: { type: mongoose.Schema.Types.Mixed },
  underBust: { type: mongoose.Schema.Types.Mixed },
  shoulderToNipple: { type: mongoose.Schema.Types.Mixed },
  shoulderToUnderBust: { type: mongoose.Schema.Types.Mixed },
  halfLength: { type: mongoose.Schema.Types.Mixed },
  gownLength: { type: mongoose.Schema.Types.Mixed },
  
  // Predefined Bottom / Trousers Measurements
  trouserWaist: { type: mongoose.Schema.Types.Mixed },
  hips: { type: mongoose.Schema.Types.Mixed },
  thigh: { type: mongoose.Schema.Types.Mixed },
  knee: { type: mongoose.Schema.Types.Mixed },
  calf: { type: mongoose.Schema.Types.Mixed },
  instep: { type: mongoose.Schema.Types.Mixed },
  trouserLength: { type: mongoose.Schema.Types.Mixed },
  inseam: { type: mongoose.Schema.Types.Mixed },
  skirtLength: { type: mongoose.Schema.Types.Mixed },

  // Catch-all object for any custom/dynamic part names sent from public or dashboard forms
  measurementsData: { type: mongoose.Schema.Types.Mixed, default: {} },

  notes: { type: String }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Measurement', measurementSchema);
