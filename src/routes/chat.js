const express = require('express');
const router = express.Router();
const { body, param, validationResult, query } = require('express-validator');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Ticket = require('../models/Ticket');
const KnowledgeBaseItem = require('../models/KnowledgeBaseItem');
const {
  analyzeSentiment,
  generateResponseSuggestions,
  generateAutoComplete,
  getCommonPhraseSuggestions,
  summarizeConversation
} = require('../utils/chatAI');

// Create or get chat session for ticket
router.post('/sessions', [
  body('ticket_id').isMongoId(),
  body('agent_id').isMongoId(),
  body('ai_copilot_enabled').optional().isBoolean(),
  body('ai_suggestions_enabled').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      ticket_id,
      agent_id,
      ai_copilot_enabled = true,
      ai_suggestions_enabled = true
    } = req.body;

    // Check if session already exists
    let session = await ChatSession.findOne({
      ticket_id,
      agent_id,
      status: { $in: ['active', 'on_hold'] }
    });

    if (!session) {
      const ticket = await Ticket.findById(ticket_id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      session = new ChatSession({
        ticket_id,
        agent_id,
        client_id: ticket.client_id,
        customer_name: ticket.customer_name,
        customer_email: ticket.customer_email,
        ai_copilot_enabled,
        ai_suggestions_enabled,
        status: 'active'
      });

      await session.save();
    }

    res.status(201).json({
      success: true,
      session: session
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// Get chat session
router.get('/sessions/:sessionId', [
  param('sessionId').isMongoId()
], async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ChatSession.findById(sessionId)
      .populate('ticket_id', 'ticket_number title')
      .populate('agent_id', 'name email')
      .populate('suggested_kb_articles.kb_item_id', 'title category');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Add message to chat session
router.post('/sessions/:sessionId/messages', [
  param('sessionId').isMongoId(),
  body('content').notEmpty().trim(),
  body('sender_type').isIn(['agent', 'customer']),
  body('analyze_sentiment').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId } = req.params;
    const { content, sender_type, analyze_sentiment = true } = req.body;
    const sender_id = req.user?.id;

    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create message
    const message = new ChatMessage({
      chat_session_id: sessionId,
      sender_id,
      sender_type,
      content,
      timestamp: new Date()
    });

    await message.save();

    // Update session message count
    session.total_messages += 1;
    if (sender_type === 'agent') {
      session.agent_messages += 1;
    } else {
      session.customer_messages += 1;
    }

    // Analyze sentiment if enabled
    if (analyze_sentiment && sender_type === 'customer') {
      const sentimentAnalysis = await analyzeSentiment(content);
      
      session.sentiment_analysis.current_sentiment = sentimentAnalysis.sentiment;
      session.sentiment_analysis.sentiment_score = sentimentAnalysis.score;

      if (sentimentAnalysis.escalation_triggered) {
        session.sentiment_analysis.escalation_triggered = true;
        session.sentiment_analysis.escalation_reason = sentimentAnalysis.escalation_reason;
        session.sentiment_analysis.escalation_timestamp = new Date();
        session.status = 'escalated';
      }
    }

    await session.save();

    res.status(201).json({
      success: true,
      message: message,
      sentiment_analysis: analyze_sentiment ? session.sentiment_analysis : null
    });
  } catch (error) {
    console.error('Message creation error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Get response suggestions
router.post('/sessions/:sessionId/response-suggestions', [
  param('sessionId').isMongoId(),
  body('message').notEmpty().trim(),
  body('include_kb').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId } = req.params;
    const { message, include_kb = true } = req.body;

    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.ai_suggestions_enabled) {
      return res.status(400).json({ 
        error: 'AI suggestions are disabled for this session' 
      });
    }

    // Get chat history
    const history = await ChatMessage.find({ chat_session_id: sessionId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const chatHistory = history.reverse().map(msg => ({
      role: msg.sender_type,
      content: msg.content
    }));

    // Get relevant KB articles
    let kbArticles = [];
    if (include_kb) {
      const similarKBQuery = message;
      kbArticles = await KnowledgeBaseItem.find({
        status: 'published',
        $text: { $search: similarKBQuery }
      })
        .limit(3)
        .select('title content ai_summary category')
        .lean();
    }

    // Generate suggestions
    const suggestions = await generateResponseSuggestions(
      message,
      chatHistory,
      kbArticles
    );

    // Save suggestions to session
    session.suggested_responses = suggestions;
    await session.save();

    res.json({
      session_id: sessionId,
      suggestions,
      related_kb_articles: kbArticles
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// Get auto-complete suggestions
router.post('/sessions/:sessionId/auto-complete', [
  param('sessionId').isMongoId(),
  body('current_text').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId } = req.params;
    const { current_text } = req.body;

    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.auto_complete_enabled) {
      return res.status(400).json({ 
        error: 'Auto-complete is disabled for this session' 
      });
    }

    const completions = await generateAutoComplete(current_text);

    res.json({
      session_id: sessionId,
      partial_text: current_text,
      completions
    });
  } catch (error) {
    console.error('Auto-complete error:', error);
    res.status(500).json({ error: 'Failed to generate completions' });
  }
});

// Get common phrase suggestions
router.get('/sessions/:sessionId/common-phrases', [
  param('sessionId').isMongoId(),
  query('context').optional().isIn([
    'greeting', 'acknowledgment', 'explanation', 'solution', 'closing', 'escalation'
  ])
], async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { context = 'general' } = req.query;

    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const phrases = getCommonPhraseSuggestions(context);

    res.json({
      session_id: sessionId,
      context,
      phrases
    });
  } catch (error) {
    console.error('Phrases error:', error);
    res.status(500).json({ error: 'Failed to get phrases' });
  }
});

// Close chat session
router.put('/sessions/:sessionId/close', [
  param('sessionId').isMongoId(),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;

    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'closed';
    session.closed_at = new Date();
    session.duration = Math.round(
      (session.closed_at - session.started_at) / 1000
    );

    if (notes) {
      session.notes.push({
        author_id: req.user?.id,
        text: notes,
        is_internal: true,
        created_at: new Date()
      });
    }

    await session.save();

    res.json({
      success: true,
      session: session
    });
  } catch (error) {
    console.error('Session close error:', error);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

// Get active chat sessions for agent
router.get('/agent/:agentId/active', [
  param('agentId').isMongoId()
], async (req, res) => {
  try {
    const { agentId } = req.params;

    const sessions = await ChatSession.find({
      agent_id: agentId,
      status: { $in: ['active', 'on_hold'] }
    })
      .populate('ticket_id', 'ticket_number title')
      .populate('customer_name')
      .sort({ updated_at: -1 });

    res.json({
      agent_id: agentId,
      active_sessions: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Active sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

module.exports = router;
