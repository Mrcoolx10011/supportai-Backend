const mongoose = require('mongoose');

const kbVersionSchema = new mongoose.Schema({
  kb_item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeBaseItem',
    required: true
  },
  version_number: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  changes_summary: {
    type: String,
    required: true
  },
  changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  change_type: {
    type: String,
    enum: ['created', 'updated', 'published', 'archived', 'restored'],
    required: true
  },
  previous_version: {
    type: Number,
    default: null
  },
  is_published: {
    type: Boolean,
    default: false
  },
  restore_enabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

kbVersionSchema.index({ kb_item_id: 1, version_number: -1 });
kbVersionSchema.index({ created_at: -1 });

module.exports = mongoose.model('KBVersion', kbVersionSchema);
