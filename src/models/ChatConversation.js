const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['active', 'waiting', 'resolved', 'closed', 'bot_active', 'with_agent', 'awaiting_agent'],
    default: 'active'
  },
  channel: {
    type: String,
    enum: ['website', 'email', 'phone', 'social'],
    default: 'website'
  },
  subject: {
    type: String,
    default: 'Chat Conversation'
  },
  customer_name: {
    type: String,
    default: null
  },
  customer_email: {
    type: String,
    default: null
  },
  session_id: {
    type: String,
    default: null,
    index: true
  },
  is_new_session: {
    type: Boolean,
    default: true
  },
  previous_sessions: [{
    session_id: String,
    conversation_id: mongoose.Schema.Types.ObjectId,
    started_at: Date,
    ended_at: Date,
    message_count: Number
  }],
  tags: [{
    type: String
  }],
  last_message_at: {
    type: Date,
    default: Date.now
  },
  ai_handled: {
    type: Boolean,
    default: false
  },
  handoff_requested: {
    type: Boolean,
    default: false
  },
  satisfaction_rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  metadata: {
    user_agent: String,
    ip_address: String,
    referrer: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChatConversation', chatConversationSchema);