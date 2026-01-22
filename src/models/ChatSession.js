const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  ticket_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  customer_name: {
    type: String,
    default: null
  },
  customer_email: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'on_hold', 'closed', 'escalated'],
    default: 'active'
  },
  ai_copilot_enabled: {
    type: Boolean,
    default: true
  },
  sentiment_analysis: {
    current_sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'unknown'],
      default: 'unknown'
    },
    sentiment_score: {
      type: Number,
      default: 0,
      min: -1,
      max: 1
    },
    escalation_triggered: {
      type: Boolean,
      default: false
    },
    escalation_reason: {
      type: String,
      default: null
    },
    escalation_timestamp: {
      type: Date,
      default: null
    }
  },
  suggested_responses: [{
    id: String,
    text: String,
    confidence: Number,
    uses_count: Number,
    created_at: {
      type: Date,
      default: Date.now
    }
  }],
  ai_suggestions_enabled: {
    type: Boolean,
    default: true
  },
  auto_complete_enabled: {
    type: Boolean,
    default: true
  },
  suggested_kb_articles: [{
    kb_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeBaseItem'
    },
    relevance_score: Number,
    suggested_at: {
      type: Date,
      default: Date.now
    }
  }],
  total_messages: {
    type: Number,
    default: 0
  },
  agent_messages: {
    type: Number,
    default: 0
  },
  customer_messages: {
    type: Number,
    default: 0
  },
  average_response_time: {
    type: Number, // in milliseconds
    default: 0
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  closed_at: {
    type: Date,
    default: null
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  notes: [{
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    is_internal: Boolean,
    created_at: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    source: String,
    device_type: String,
    browser: String,
    ip_address: String
  }
}, {
  timestamps: true
});

chatSessionSchema.index({ ticket_id: 1 });
chatSessionSchema.index({ agent_id: 1, status: 1 });
chatSessionSchema.index({ created_at: -1 });
chatSessionSchema.index({ 'sentiment_analysis.escalation_triggered': 1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
