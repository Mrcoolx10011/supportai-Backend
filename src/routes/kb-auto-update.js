const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Ticket = require('../models/Ticket');
const {
  createKBFromResolvedTicket,
  bulkCreateKBFromTickets,
  suggestKBForTicket,
  linkKBToTickets
} = require('../utils/kbAutoUpdate');

// Suggest KB articles for a ticket
router.get('/:ticketId/kb-suggestions', [
  param('ticketId').isMongoId()
], async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const suggestions = await suggestKBForTicket(ticket);

    res.json({
      ticket_id: ticketId,
      suggestions
    });
  } catch (error) {
    console.error('KB suggestion error:', error);
    res.status(500).json({ error: 'Failed to get KB suggestions' });
  }
});

// Auto-create KB article from resolved ticket
router.post('/:ticketId/create-kb', [
  param('ticketId').isMongoId(),
  body('auto_publish').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ticketId } = req.params;
    const { auto_publish } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status !== 'resolved') {
      return res.status(400).json({ 
        error: 'Only resolved tickets can be converted to KB articles' 
      });
    }

    const result = await createKBFromResolvedTicket(ticket);

    if (auto_publish) {
      // Update status to published
      const kbItem = result.kb_item;
      kbItem.status = 'published';
      await kbItem.save();
    }

    res.status(201).json({
      success: true,
      message: 'KB article created from ticket',
      kb_item: result.kb_item,
      auto_published: auto_publish || false
    });
  } catch (error) {
    console.error('KB creation error:', error);
    res.status(500).json({ error: 'Failed to create KB article from ticket' });
  }
});

// Bulk create KB articles from multiple resolved tickets
router.post('/bulk/create-kb', [
  body('ticket_ids').isArray({ min: 1 }).notEmpty(),
  body('auto_publish').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ticket_ids, auto_publish } = req.body;

    const tickets = await Ticket.find({
      _id: { $in: ticket_ids },
      status: 'resolved'
    });

    if (tickets.length === 0) {
      return res.status(400).json({ 
        error: 'No resolved tickets found' 
      });
    }

    const results = await bulkCreateKBFromTickets(tickets);

    if (auto_publish) {
      // Publish all successful KB items
      for (const result of results.success) {
        result.kb_item.status = 'published';
        await result.kb_item.save();
      }
    }

    res.json({
      success: true,
      message: `Created ${results.success.length} KB articles`,
      created: results.success.length,
      failed: results.failed.length,
      results
    });
  } catch (error) {
    console.error('Bulk KB creation error:', error);
    res.status(500).json({ error: 'Failed to create KB articles' });
  }
});

module.exports = router;
