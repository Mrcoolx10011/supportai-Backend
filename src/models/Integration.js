const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema({
  workspace_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  integration_type: {
    type: String,
    enum: ['slack', 'teams', 'zapier', 'stripe', 'jira', 'custom'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  is_enabled: {
    type: Boolean,
    default: true
  },
  // Authentication
  api_key: {
    type: String,
    default: null,
    select: false // Don't return in queries by default
  },
  api_secret: {
    type: String,
    default: null,
    select: false
  },
  oauth_token: {
    type: String,
    default: null,
    select: false
  },
  oauth_refresh_token: {
    type: String,
    default: null,
    select: false
  },
  webhook_url: {
    type: String,
    default: null
  },
  webhook_secret: {
    type: String,
    default: null,
    select: false
  },
  // Configuration
  config: {
    // For Slack
    slack_channel: String,
    slack_workspace_id: String,
    slack_bot_token: String,
    // For Teams
    teams_webhook_url: String,
    teams_channel: String,
    // For Zapier
    zapier_account_id: String,
    zapier_webhook_id: String,
    // For Stripe
    stripe_api_key: String,
    stripe_account_id: String,
    // For Jira
    jira_instance_url: String,
    jira_project_key: String,
    jira_api_token: String,
    // General settings
    sync_tickets: Boolean,
    sync_conversations: Boolean,
    send_notifications: Boolean,
    notification_events: [String],
    auto_create_issues: Boolean,
    auto_update_status: Boolean
  },
  // Notification settings
  notification_settings: {
    notify_on_ticket_created: Boolean,
    notify_on_ticket_resolved: Boolean,
    notify_on_escalation: Boolean,
    notify_on_agent_mention: Boolean,
    notify_on_customer_message: Boolean,
    notify_threshold_priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'high'
    }
  },
  // Sync status
  sync_status: {
    last_sync: Date,
    next_sync: Date,
    sync_interval: Number, // in minutes
    is_syncing: Boolean,
    last_sync_error: String
  },
  // Usage metrics
  usage: {
    api_calls_made: {
      type: Number,
      default: 0
    },
    webhooks_received: {
      type: Number,
      default: 0
    },
    issues_created: {
      type: Number,
      default: 0
    },
    notifications_sent: {
      type: Number,
      default: 0
    }
  },
  // Mapping/Routing
  ticket_routing: [{
    condition: String,
    target_channel_or_webhook: String,
    enabled: Boolean
  }],
  status_mapping: {
    type: Map,
    of: String
  },
  priority_mapping: {
    type: Map,
    of: String
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

integrationSchema.index({ workspace_id: 1, integration_type: 1 });
integrationSchema.index({ is_enabled: 1 });
integrationSchema.index({ created_at: -1 });

module.exports = mongoose.model('Integration', integrationSchema);
