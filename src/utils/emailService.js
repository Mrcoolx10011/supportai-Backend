/**
 * Email Service for sending notifications to customers
 * For development: logs to console
 * For production: integrate with email provider (SendGrid, Mailgun, etc.)
 */

const sendTicketCreatedEmail = async (ticket) => {
  try {
    console.log('📧 Sending ticket created email to:', ticket.customer_email);
    
    const emailBody = `
Hello ${ticket.customer_name},

Thank you for contacting us! Your support ticket has been successfully created.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Support Ticket Reference: ${ticket.ticket_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Issue Title: ${ticket.title}
📝 Description: ${ticket.description}
⭐ Priority: ${(ticket.priority || 'medium').toUpperCase()}
📂 Category: ${ticket.category || 'general'}
✅ Status: ${(ticket.status || 'open').toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Our support team has been notified and will review your issue shortly.

Please save your Reference ID (${ticket.ticket_number}) for future reference. You can use this ID to track the status of your ticket.

Best regards,
Support Team
    `.trim();

    // TODO: Integrate with actual email service
    console.log('✉️ Email content:', emailBody);
    console.log('✅ Email notification logged (implement actual email service in production)');
    
    return {
      success: true,
      message: 'Email notification sent',
      ticket_number: ticket.ticket_number,
      customer_email: ticket.customer_email
    };
  } catch (error) {
    console.error('❌ Error sending ticket created email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const sendTicketUpdateEmail = async (ticket, updateFields = {}) => {
  try {
    console.log('📧 Sending ticket update email to:', ticket.customer_email);
    
    const changes = [];
    if (updateFields.status) changes.push(`Status changed to: ${updateFields.status.toUpperCase()}`);
    if (updateFields.priority) changes.push(`Priority changed to: ${updateFields.priority.toUpperCase()}`);
    if (updateFields.assigned_to) changes.push(`Assigned to support team`);
    
    const emailBody = `
Hello ${ticket.customer_name},

Your support ticket has been updated!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Support Ticket Reference: ${ticket.ticket_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Updates:
${changes.map(change => `• ${change}`).join('\n')}

Current Status:
✅ Status: ${(ticket.status || 'open').toUpperCase()}
⭐ Priority: ${(ticket.priority || 'medium').toUpperCase()}
📂 Category: ${ticket.category || 'general'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We appreciate your patience. Our team is working on resolving your issue.

If you have any additional information to share, please reply to this email with your ticket reference ID: ${ticket.ticket_number}

Best regards,
Support Team
    `.trim();

    // TODO: Integrate with actual email service
    console.log('✉️ Email content:', emailBody);
    console.log('✅ Email notification logged (implement actual email service in production)');
    
    return {
      success: true,
      message: 'Update email notification sent',
      ticket_number: ticket.ticket_number,
      customer_email: ticket.customer_email
    };
  } catch (error) {
    console.error('❌ Error sending ticket update email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const sendTicketResolvedEmail = async (ticket) => {
  try {
    console.log('📧 Sending ticket resolved email to:', ticket.customer_email);
    
    const emailBody = `
Hello ${ticket.customer_name},

Great news! Your support ticket has been resolved.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Support Ticket Reference: ${ticket.ticket_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Status: RESOLVED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We're glad we could help! If you have any follow-up questions or if the issue persists, please feel free to reach out.

Thank you for your business!

Best regards,
Support Team
    `.trim();

    // TODO: Integrate with actual email service
    console.log('✉️ Email content:', emailBody);
    console.log('✅ Email notification logged (implement actual email service in production)');
    
    return {
      success: true,
      message: 'Resolution email notification sent',
      ticket_number: ticket.ticket_number,
      customer_email: ticket.customer_email
    };
  } catch (error) {
    console.error('❌ Error sending ticket resolved email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendTicketCreatedEmail,
  sendTicketUpdateEmail,
  sendTicketResolvedEmail
};
