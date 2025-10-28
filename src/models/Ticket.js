const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    default: 'general'
  },
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  tags: [{
    type: String
  }],
  due_date: {
    type: Date,
    default: null
  },
  resolved_at: {
    type: Date,
    default: null
  },
  first_response_at: {
    type: Date,
    default: null
  },
  last_activity: {
    type: Date,
    default: Date.now
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    uploaded_at: { type: Date, default: Date.now }
  }],
  ai_generated: {
    type: Boolean,
    default: false
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

module.exports = mongoose.model('Ticket', ticketSchema);