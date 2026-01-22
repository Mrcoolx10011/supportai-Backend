const mongoose = require('mongoose');

const ticketNoteSchema = new mongoose.Schema({
  ticket_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  is_internal: {
    type: Boolean,
    default: true
  },
  mentions: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    mentioned_at: {
      type: Date,
      default: Date.now
    }
  }],
  ai_summary: {
    type: String,
    default: null
  },
  summary_generated_at: {
    type: Date,
    default: null
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    type: String
  }],
  edited: {
    type: Boolean,
    default: false
  },
  edited_at: {
    type: Date,
    default: null
  },
  edited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [{
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    created_at: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

ticketNoteSchema.index({ ticket_id: 1, created_at: -1 });
ticketNoteSchema.index({ author_id: 1 });
ticketNoteSchema.index({ 'mentions.user_id': 1 });
ticketNoteSchema.index({ is_internal: 1 });

module.exports = mongoose.model('TicketNote', ticketNoteSchema);
