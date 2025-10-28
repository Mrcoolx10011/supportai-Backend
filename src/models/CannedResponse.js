const mongoose = require('mongoose');

const cannedResponseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  shortcut: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  category: {
    type: String,
    default: 'general'
  },
  tags: [{
    type: String
  }],
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usage_count: {
    type: Number,
    default: 0
  },
  last_used: {
    type: Date,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  variables: [{
    name: String,
    description: String,
    default_value: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('CannedResponse', cannedResponseSchema);