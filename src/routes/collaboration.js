const express = require('express');
const router = express.Router();
const { body, param, validationResult, query } = require('express-validator');
const TicketNote = require('../models/TicketNote');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Summarize note with AI
async function summarizeNote(content) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(
      `Summarize this support note in 1-2 sentences:\n\n${content}`
    );
    return result.response.text();
  } catch (error) {
    console.error('Summarization error:', error);
    return null;
  }
}

// Extract mentions from content
function extractMentions(content) {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = content.match(mentionRegex) || [];
  return [...new Set(matches.map(m => m.substring(1)))];
}

// Create internal note with mentions and AI summary
router.post('/tickets/:ticketId/notes', [
  param('ticketId').isMongoId(),
  body('content').notEmpty().trim(),
  body('is_internal').optional().isBoolean(),
  body('generate_summary').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ticketId } = req.params;
    const { content, is_internal = true, generate_summary = true } = req.body;
    const author_id = req.user?.id;

    if (!author_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Extract mentions
    const mentionedUsernames = extractMentions(content);
    const mentionedUsers = await User.find({
      username: { $in: mentionedUsernames }
    }).select('_id username');

    const mentions = mentionedUsers.map(user => ({
      user_id: user._id,
      username: user.username,
      mentioned_at: new Date()
    }));

    // Generate AI summary if requested
    let ai_summary = null;
    if (generate_summary) {
      ai_summary = await summarizeNote(content);
    }

    const note = new TicketNote({
      ticket_id: ticketId,
      author_id,
      content,
      is_internal,
      mentions,
      ai_summary: ai_summary || null,
      summary_generated_at: ai_summary ? new Date() : null
    });

    await note.save();

    // Notify mentioned users
    for (const mention of mentions) {
      // TODO: Implement notification system
      console.log(`Notify user ${mention.user_id} about mention in ticket ${ticketId}`);
    }

    // Update ticket's last activity
    ticket.last_activity = new Date();
    await ticket.save();

    // Populate references
    await note.populate('author_id', 'name email username');
    await note.populate('mentions.user_id', 'name email username');

    res.status(201).json({
      success: true,
      note: note,
      mentions_notified: mentions.length
    });
  } catch (error) {
    console.error('Note creation error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Get all notes for a ticket
router.get('/tickets/:ticketId/notes', [
  param('ticketId').isMongoId(),
  query('is_internal').optional().isBoolean(),
  query('sort').optional().isIn(['newest', 'oldest']),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { is_internal = null, sort = 'newest', limit = 50 } = req.query;

    const filter = { ticket_id: ticketId };
    if (is_internal !== null && is_internal !== 'null') {
      filter.is_internal = is_internal === 'true';
    }

    const sortOption = sort === 'newest' ? { created_at: -1 } : { created_at: 1 };

    const notes = await TicketNote.find(filter)
      .populate('author_id', 'name email username avatar')
      .populate('mentions.user_id', 'name email username')
      .populate('edited_by', 'name email')
      .sort(sortOption)
      .limit(parseInt(limit));

    res.json({
      ticket_id: ticketId,
      notes,
      count: notes.length
    });
  } catch (error) {
    console.error('Notes fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Update note
router.put('/notes/:noteId', [
  param('noteId').isMongoId(),
  body('content').notEmpty().trim(),
  body('regenerate_summary').optional().isBoolean()
], async (req, res) => {
  try {
    const { noteId } = req.params;
    const { content, regenerate_summary = false } = req.body;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const note = await TicketNote.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check authorization
    if (note.author_id.toString() !== user_id && !req.user?.is_admin) {
      return res.status(403).json({ error: 'Unauthorized to edit this note' });
    }

    // Update content
    note.content = content;
    note.edited = true;
    note.edited_at = new Date();
    note.edited_by = user_id;

    // Extract new mentions
    const mentionedUsernames = extractMentions(content);
    const mentionedUsers = await User.find({
      username: { $in: mentionedUsernames }
    }).select('_id username');

    note.mentions = mentionedUsers.map(user => ({
      user_id: user._id,
      username: user.username,
      mentioned_at: new Date()
    }));

    // Regenerate summary if requested
    if (regenerate_summary) {
      note.ai_summary = await summarizeNote(content);
      note.summary_generated_at = new Date();
    }

    await note.save();
    await note.populate('author_id', 'name email username');
    await note.populate('mentions.user_id', 'name email username');

    res.json({
      success: true,
      note: note
    });
  } catch (error) {
    console.error('Note update error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete note
router.delete('/notes/:noteId', [
  param('noteId').isMongoId()
], async (req, res) => {
  try {
    const { noteId } = req.params;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const note = await TicketNote.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check authorization
    if (note.author_id.toString() !== user_id && !req.user?.is_admin) {
      return res.status(403).json({ error: 'Unauthorized to delete this note' });
    }

    await TicketNote.findByIdAndDelete(noteId);

    res.json({
      success: true,
      message: 'Note deleted'
    });
  } catch (error) {
    console.error('Note delete error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Get ticket history timeline
router.get('/tickets/:ticketId/timeline', [
  param('ticketId').isMongoId()
], async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const notes = await TicketNote.find({ ticket_id: ticketId })
      .populate('author_id', 'name email avatar')
      .sort({ created_at: 1 });

    // Build timeline
    const timeline = [
      {
        type: 'created',
        timestamp: ticket.createdAt,
        created_by: ticket.created_by,
        title: 'Ticket created',
        description: ticket.title,
        data: {
          status: 'open',
          priority: ticket.priority
        }
      }
    ];

    // Add status changes
    if (ticket.first_response_at) {
      timeline.push({
        type: 'first_response',
        timestamp: ticket.first_response_at,
        title: 'First response sent',
        description: 'Agent responded to customer'
      });
    }

    if (ticket.resolved_at) {
      timeline.push({
        type: 'resolved',
        timestamp: ticket.resolved_at,
        title: 'Ticket resolved',
        description: 'Issue has been resolved'
      });
    }

    // Add notes
    notes.forEach(note => {
      timeline.push({
        type: 'note',
        timestamp: note.createdAt,
        author: note.author_id,
        is_internal: note.is_internal,
        title: note.is_internal ? 'Internal note' : 'Customer reply',
        description: note.content.substring(0, 100) + '...',
        ai_summary: note.ai_summary,
        mentions: note.mentions
      });
    });

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      ticket_id: ticketId,
      timeline,
      total_events: timeline.length
    });
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// Bulk update tickets
router.put('/tickets/bulk/update', [
  body('ticket_ids').isArray({ min: 1 }),
  body('status').optional().isIn(['open', 'in_progress', 'pending', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assigned_to').optional().isMongoId(),
  body('tags').optional().isArray(),
  body('add_note').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ticket_ids, status, priority, assigned_to, tags, add_note } = req.body;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assigned_to) updateData.assigned_to = assigned_to;
    if (tags) updateData.tags = tags;
    updateData.last_activity = new Date();

    // Perform bulk update
    const result = await Ticket.updateMany(
      { _id: { $in: ticket_ids } },
      updateData
    );

    // Add note to each ticket if provided
    if (add_note) {
      for (const ticketId of ticket_ids) {
        const note = new TicketNote({
          ticket_id: ticketId,
          author_id: user_id,
          content: add_note,
          is_internal: true
        });
        await note.save();
      }
    }

    res.json({
      success: true,
      updated_count: result.modifiedCount,
      message: `Updated ${result.modifiedCount} tickets`
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to update tickets' });
  }
});

// Get note mentions
router.get('/notes/:noteId/mentions', [
  param('noteId').isMongoId()
], async (req, res) => {
  try {
    const { noteId } = req.params;

    const note = await TicketNote.findById(noteId)
      .populate('mentions.user_id', 'name email username avatar');

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({
      note_id: noteId,
      mentions: note.mentions
    });
  } catch (error) {
    console.error('Mentions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch mentions' });
  }
});

module.exports = router;
