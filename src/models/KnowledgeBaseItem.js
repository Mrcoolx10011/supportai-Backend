const mongoose = require('mongoose');

const knowledgeBaseItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'general'
  },
  tags: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  last_updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  view_count: {
    type: Number,
    default: 0
  },
  helpful_count: {
    type: Number,
    default: 0
  },
  not_helpful_count: {
    type: Number,
    default: 0
  },
  search_keywords: [{
    type: String
  }],
  ai_summary: {
    type: String,
    default: null
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    type: String
  }],
  related_items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeBaseItem'
  }]
}, {
  timestamps: true
});

// Index for text search
knowledgeBaseItemSchema.index({ 
  title: 'text', 
  content: 'text', 
  search_keywords: 'text' 
});

module.exports = mongoose.model('KnowledgeBaseItem', knowledgeBaseItemSchema);