const axios = require('axios');
const crypto = require('crypto');

// Slack Integration
class SlackIntegration {
  constructor(config) {
    this.token = config.slack_bot_token;
    this.channel = config.slack_channel;
    this.baseURL = 'https://slack.com/api';
  }

  async sendNotification(message, attachments = []) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat.postMessage`,
        {
          channel: this.channel,
          text: message,
          attachments: attachments.length > 0 ? attachments : undefined,
          mrkdwn: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.ok) {
        throw new Error(`Slack error: ${response.data.error}`);
      }

      return {
        success: true,
        timestamp: response.data.ts,
        channel: response.data.channel
      };
    } catch (error) {
      console.error('Slack notification error:', error);
      throw error;
    }
  }

  async sendTicketNotification(ticket) {
    const attachments = [{
      color: ticket.priority === 'urgent' ? 'danger' : ticket.priority === 'high' ? 'warning' : 'good',
      title: `Ticket #${ticket.ticket_number}`,
      text: ticket.title,
      fields: [
        {
          title: 'Priority',
          value: ticket.priority,
          short: true
        },
        {
          title: 'Status',
          value: ticket.status,
          short: true
        },
        {
          title: 'Customer',
          value: ticket.customer_name || 'Unknown',
          short: true
        },
        {
          title: 'Category',
          value: ticket.category,
          short: true
        }
      ],
      ts: Math.floor(Date.now() / 1000)
    }];

    return this.sendNotification(
      `New ticket created: ${ticket.title}`,
      attachments
    );
  }

  async updateThreadMessage(channel, ts, message) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat.update`,
        {
          channel,
          ts,
          text: message
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.ok;
    } catch (error) {
      console.error('Slack update error:', error);
      throw error;
    }
  }
}

// Microsoft Teams Integration
class TeamsIntegration {
  constructor(config) {
    this.webhookUrl = config.teams_webhook_url;
  }

  async sendNotification(title, message, details = {}) {
    try {
      const payload = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: title,
        themeColor: details.color || '0078D4',
        sections: [
          {
            activityTitle: title,
            activitySubtitle: details.subtitle || '',
            text: message,
            facts: Object.entries(details.fields || {}).map(([key, value]) => ({
              name: key,
              value: value
            }))
          }
        ],
        potentialAction: details.actions || []
      };

      const response = await axios.post(this.webhookUrl, payload);
      return { success: true, status: response.status };
    } catch (error) {
      console.error('Teams notification error:', error);
      throw error;
    }
  }

  async sendTicketNotification(ticket) {
    const colorMap = {
      urgent: 'FF0000',
      high: 'FF9900',
      medium: 'FFCC00',
      low: '00CC00'
    };

    return this.sendNotification(
      `New Ticket: ${ticket.title}`,
      `Ticket #${ticket.ticket_number} from ${ticket.customer_name}`,
      {
        color: colorMap[ticket.priority],
        subtitle: `Priority: ${ticket.priority}`,
        fields: {
          'Status': ticket.status,
          'Category': ticket.category,
          'Priority': ticket.priority,
          'Customer': ticket.customer_email
        },
        actions: [
          {
            '@type': 'OpenUri',
            name: 'View Ticket',
            targets: [
              { os: 'default', uri: `${process.env.APP_URL}/tickets/${ticket._id}` }
            ]
          }
        ]
      }
    );
  }
}

// Zapier Integration
class ZapierIntegration {
  constructor(config) {
    this.webhookId = config.zapier_webhook_id;
    this.baseURL = `https://hooks.zapier.com/hooks/catch/${config.zapier_account_id}/${config.zapier_webhook_id}`;
  }

  async sendEvent(eventType, data) {
    try {
      const payload = {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        data: data
      };

      const response = await axios.post(this.baseURL, payload);
      return { success: true, status: response.status };
    } catch (error) {
      console.error('Zapier webhook error:', error);
      throw error;
    }
  }

  async sendTicketEvent(ticket) {
    return this.sendEvent('ticket.created', {
      ticket_id: ticket._id,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      customer_name: ticket.customer_name,
      customer_email: ticket.customer_email,
      category: ticket.category,
      created_at: ticket.createdAt
    });
  }

  async sendResolutionEvent(ticket) {
    return this.sendEvent('ticket.resolved', {
      ticket_id: ticket._id,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      resolved_at: ticket.resolved_at,
      resolution_time_hours: (ticket.resolved_at - ticket.createdAt) / (1000 * 60 * 60)
    });
  }
}

// Stripe Billing Integration
class StripeIntegration {
  constructor(config) {
    this.apiKey = config.stripe_api_key;
    this.accountId = config.stripe_account_id;
    this.baseURL = 'https://api.stripe.com/v1';
  }

  async createCustomer(customerData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/customers`,
        {
          email: customerData.email,
          name: customerData.name,
          metadata: {
            client_id: customerData.client_id
          }
        },
        {
          auth: {
            username: this.apiKey,
            password: ''
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Stripe customer creation error:', error);
      throw error;
    }
  }

  async createSubscription(customerId, priceId, metadata = {}) {
    try {
      const response = await axios.post(
        `${this.baseURL}/subscriptions`,
        {
          customer: customerId,
          items: [{ price: priceId }],
          metadata
        },
        {
          auth: {
            username: this.apiKey,
            password: ''
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Stripe subscription creation error:', error);
      throw error;
    }
  }

  async createInvoice(customerId, items) {
    try {
      const response = await axios.post(
        `${this.baseURL}/invoices`,
        {
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: 30,
          line_items: items.map(item => ({
            price_data: {
              currency: 'usd',
              product_data: {
                name: item.name
              },
              unit_amount: item.amount * 100
            },
            quantity: item.quantity || 1
          }))
        },
        {
          auth: {
            username: this.apiKey,
            password: ''
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Stripe invoice creation error:', error);
      throw error;
    }
  }
}

// Jira Integration
class JiraIntegration {
  constructor(config) {
    this.baseURL = `${config.jira_instance_url}/rest/api/3`;
    this.projectKey = config.jira_project_key;
    this.auth = Buffer.from(`${config.jira_email}:${config.jira_api_token}`).toString('base64');
  }

  async createIssue(ticketData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/issue`,
        {
          fields: {
            project: { key: this.projectKey },
            summary: ticketData.title,
            description: {
              version: 3,
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: ticketData.description
                    }
                  ]
                }
              ]
            },
            issuetype: { name: 'Task' },
            priority: { name: this.mapPriority(ticketData.priority) },
            labels: ticketData.tags || [],
            customfield_10000: ticketData.customer_name
          }
        },
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Jira issue creation error:', error);
      throw error;
    }
  }

  async updateIssue(issueKey, updateData) {
    try {
      const response = await axios.put(
        `${this.baseURL}/issue/${issueKey}`,
        {
          fields: updateData
        },
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Jira issue update error:', error);
      throw error;
    }
  }

  mapPriority(supportPriority) {
    const map = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Highest'
    };
    return map[supportPriority] || 'Medium';
  }
}

module.exports = {
  SlackIntegration,
  TeamsIntegration,
  ZapierIntegration,
  StripeIntegration,
  JiraIntegration
};
