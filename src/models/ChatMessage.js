const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatConversation',
    required: true
  },
  session_id: {
    type: String,
    default: null,
    index: true
  },
  sender_type: {
    type: String,
    enum: ['client', 'customer', 'agent', 'ai', 'bot', 'system'],
    required: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  message: {
    type: String,
    required: true
  },
  message_type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    type: String
  }],
  ai_confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  ai_model: {
    type: String,
    default: null
  },
  read_at: {
    type: Date,
    default: null
  },
  edited: {
    type: Boolean,
    default: false
  },
  edited_at: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);