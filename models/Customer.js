const mongoose = require('mongoose');

// strict: false lets this subdocument store any dynamic measurement
// part the user types (e.g. "Bust", "Gown Length") in addition to the
// explicitly declared fields below. Without this, Mongoose silently
// drops any key not declared on the schema.
const subMeasurementSchema = new mongoose.Schema({
  title: { type: String, default: 'Standard Fitting' },
  recordedDate: { type: Date, default: Date.now },
  unit: { type: String, enum: ['inches', 'cm'], default: 'inches' },
  notes: String
}, { strict: false, timestamps: true });

const subProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  relationship: { type: String, required: true }, // Son, Daughter, Spouse, etc.
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  notes: { type: String },
  measurements: [subMeasurementSchema]
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
  subProfiles: [subProfileSchema]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
