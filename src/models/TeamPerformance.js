const mongoose = require('mongoose');

const teamPerformanceSchema = new mongoose.Schema({
  team_member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'all_time'],
    required: true
  },
  // Metrics
  tickets_resolved: {
    type: Number,
    default: 0
  },
  tickets_assigned: {
    type: Number,
    default: 0
  },
  tickets_in_progress: {
    type: Number,
    default: 0
  },
  average_resolution_time: {
    type: Number, // in hours
    default: 0
  },
  first_response_time: {
    type: Number, // in minutes
    default: 0
  },
  customer_satisfaction_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  total_messages_sent: {
    type: Number,
    default: 0
  },
  ai_response_acceptance_rate: {
    type: Number, // percentage 0-100
    default: 0
  },
  kb_articles_created: {
    type: Number,
    default: 0
  },
  kb_articles_improved: {
    type: Number,
    default: 0
  },
  internal_notes_created: {
    type: Number,
    default: 0
  },
  team_mentions_received: {
    type: Number,
    default: 0
  },
  helpfulness_score: {
    type: Number, // based on helpful votes
    default: 0
  },
  // Achievements
  achievements: [{
    title: String,
    description: String,
    badge: String,
    earned_at: {
      type: Date,
      default: Date.now
    }
  }],
  // Rankings
  rank: {
    type: Number,
    default: null
  },
  score: {
    type: Number,
    default: 0
  },
  percentile: {
    type: Number, // 0-100
    default: 0
  },
  // Trends
  trend: {
    type: String,
    enum: ['up', 'down', 'stable'],
    default: 'stable'
  },
  trend_percentage: {
    type: Number, // percentage change from previous period
    default: 0
  },
  last_updated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

teamPerformanceSchema.index({ team_member_id: 1, period: 1 });
teamPerformanceSchema.index({ team_id: 1, score: -1 });
teamPerformanceSchema.index({ rank: 1 });
teamPerformanceSchema.index({ last_updated: -1 });

module.exports = mongoose.model('TeamPerformance', teamPerformanceSchema);
