const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    default: null
  },
  company: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },
  tags: [{
    type: String
  }],
  notes: {
    type: String,
    default: null
  },
  avatar_url: {
    type: String,
    default: null
  },
  last_contact: {
    type: Date,
    default: null
  },
  total_tickets: {
    type: Number,
    default: 0
  },
  satisfaction_rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);