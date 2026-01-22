const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Integration = require('../models/Integration');
const Ticket = require('../models/Ticket');
const {
  SlackIntegration,
  TeamsIntegration,
  ZapierIntegration,
  StripeIntegration,
  JiraIntegration
} = require('../utils/integrations');
const crypto = require('crypto');

// Create integration
router.post('/', [
  body('workspace_id').isMongoId(),
  body('integration_type').isIn(['slack', 'teams', 'zapier', 'stripe', 'jira']),
  body('name').notEmpty().trim(),
  body('config').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { workspace_id, integration_type, name, config, notification_settings } = req.body;
    const created_by = req.user?.id;

    if (!created_by) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if integration already exists
    const existing = await Integration.findOne({
      workspace_id,
      integration_type,
      is_enabled: true
    });

    if (existing && integration_type !== 'custom') {
      return res.status(400).json({ 
        error: `${integration_type} integration already exists` 
      });
    }

    const integration = new Integration({
      workspace_id,
      integration_type,
      name,
      config,
      notification_settings: notification_settings || {
        notify_on_ticket_created: true,
        notify_on_ticket_resolved: true,
        notify_on_escalation: true,
        notify_on_agent_mention: true,
        notify_threshold_priority: 'high'
      },
      created_by,
      sync_status: {
        sync_interval: 5,
        is_syncing: false
      }
    });

    await integration.save();

    // Test connection
    let testResult = null;
    try {
      if (integration_type === 'slack') {
        const slack = new SlackIntegration(config);
        testResult = await slack.sendNotification('SupportAI: Integration test successful ✓');
      } else if (integration_type === 'teams') {
        const teams = new TeamsIntegration(config);
        testResult = await teams.sendNotification(
          'SupportAI Integration Test',
          'Your Teams integration has been successfully connected!'
        );
      }
    } catch (testError) {
      console.warn('Integration test warning:', testError.message);
    }

    res.status(201).json({
      success: true,
      integration,
      test_result: testResult
    });
  } catch (error) {
    console.error('Integration creation error:', error);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

// Get integrations for workspace
router.get('/workspace/:workspaceId', [
  param('workspaceId').isMongoId()
], async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const integrations = await Integration.find({ workspace_id: workspaceId })
      .select('-api_key -api_secret -oauth_token -webhook_secret')
      .populate('created_by', 'name email');

    res.json({
      workspace_id: workspaceId,
      integrations,
      count: integrations.length
    });
  } catch (error) {
    console.error('Integration fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Get single integration
router.get('/:integrationId', [
  param('integrationId').isMongoId()
], async (req, res) => {
  try {
    const { integrationId } = req.params;

    const integration = await Integration.findById(integrationId)
      .select('-api_key -api_secret -oauth_token -webhook_secret')
      .populate('created_by', 'name email');

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ integration });
  } catch (error) {
    console.error('Integration fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

// Update integration
router.put('/:integrationId', [
  param('integrationId').isMongoId(),
  body('name').optional().notEmpty().trim(),
  body('config').optional().isObject(),
  body('is_enabled').optional().isBoolean(),
  body('notification_settings').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { integrationId } = req.params;
    const { name, config, is_enabled, notification_settings } = req.body;

    const integration = await Integration.findById(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (name) integration.name = name;
    if (config) integration.config = { ...integration.config, ...config };
    if (is_enabled !== undefined) integration.is_enabled = is_enabled;
    if (notification_settings) {
      integration.notification_settings = {
        ...integration.notification_settings,
        ...notification_settings
      };
    }

    await integration.save();

    res.json({
      success: true,
      integration
    });
  } catch (error) {
    console.error('Integration update error:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// Test integration connection
router.post('/:integrationId/test', [
  param('integrationId').isMongoId()
], async (req, res) => {
  try {
    const { integrationId } = req.params;

    const integration = await Integration.findById(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    let testResult = null;
    let error = null;

    try {
      if (integration.integration_type === 'slack') {
        const slack = new SlackIntegration(integration.config);
        testResult = await slack.sendNotification('SupportAI: Connection test ✓');
      } else if (integration.integration_type === 'teams') {
        const teams = new TeamsIntegration(integration.config);
        testResult = await teams.sendNotification(
          'SupportAI Connection Test',
          'Your integration is connected successfully!'
        );
      } else if (integration.integration_type === 'zapier') {
        const zapier = new ZapierIntegration(integration.config);
        testResult = await zapier.sendEvent('test', { message: 'Connection test' });
      }
    } catch (testError) {
      error = testError.message;
    }

    res.json({
      success: !error,
      test_result: testResult,
      error
    });
  } catch (error) {
    console.error('Integration test error:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});

// Send test notification
router.post('/:integrationId/test-notification', [
  param('integrationId').isMongoId(),
  body('notification_type').isIn(['ticket', 'message', 'escalation'])
], async (req, res) => {
  try {
    const { integrationId } = req.params;
    const { notification_type } = req.body;

    const integration = await Integration.findById(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    let result = null;

    if (integration.integration_type === 'slack') {
      const slack = new SlackIntegration(integration.config);
      const testTicket = {
        _id: 'test',
        ticket_number: 'TEST-001',
        title: 'Test Ticket - Please Ignore',
        customer_name: 'Test User',
        priority: 'high',
        status: 'open',
        category: 'test'
      };
      result = await slack.sendTicketNotification(testTicket);
    } else if (integration.integration_type === 'teams') {
      const teams = new TeamsIntegration(integration.config);
      result = await teams.sendTicketNotification({
        _id: 'test',
        ticket_number: 'TEST-001',
        title: 'Test Ticket - Please Ignore',
        customer_name: 'Test User',
        customer_email: 'test@example.com',
        priority: 'high',
        status: 'open',
        category: 'test'
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Notification test error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Delete integration
router.delete('/:integrationId', [
  param('integrationId').isMongoId()
], async (req, res) => {
  try {
    const { integrationId } = req.params;

    const integration = await Integration.findById(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await Integration.findByIdAndDelete(integrationId);

    res.json({
      success: true,
      message: 'Integration deleted'
    });
  } catch (error) {
    console.error('Integration delete error:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// Webhook handler for receiving events from integrations
router.post('/webhook/:integrationId/:webhookSecret', [
  param('integrationId').isMongoId(),
  param('webhookSecret').isString()
], async (req, res) => {
  try {
    const { integrationId, webhookSecret } = req.params;

    const integration = await Integration.findById(integrationId);
    if (!integration || integration.webhook_secret !== webhookSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { event_type, data } = req.body;

    // Handle different webhook events
    if (integration.integration_type === 'slack') {
      // Handle Slack events
      console.log(`Slack webhook: ${event_type}`, data);
    } else if (integration.integration_type === 'teams') {
      // Handle Teams events
      console.log(`Teams webhook: ${event_type}`, data);
    } else if (integration.integration_type === 'jira') {
      // Handle Jira events
      console.log(`Jira webhook: ${event_type}`, data);
    }

    // Update usage metrics
    integration.usage.webhooks_received += 1;
    await integration.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get integration usage statistics
router.get('/:integrationId/stats', [
  param('integrationId').isMongoId()
], async (req, res) => {
  try {
    const { integrationId } = req.params;

    const integration = await Integration.findById(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({
      integration_id: integrationId,
      integration_type: integration.integration_type,
      usage: integration.usage,
      sync_status: integration.sync_status,
      is_enabled: integration.is_enabled
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;