const express = require('express');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const Client = require('../models/Client');

const router = express.Router();

// Public endpoints for chat widget (no authentication required)

// POST /api/widget/conversation - Create a new conversation
router.post('/conversation', async (req, res) => {
  try {
    const { client_id, customer_name, customer_email } = req.body;

    // Handle demo-client special case
    let clientObjectId = client_id;
    if (client_id === 'demo-client') {
      let demoClient = await Client.findOne({ name: 'Demo Client' });
      
      if (!demoClient) {
        demoClient = new Client({
          name: 'Demo Client',
          email: 'demo@example.com',
          company: 'Demo Company',
          phone: '+1-555-0123',
          status: 'active'
        });
        await demoClient.save();
      }
      
      clientObjectId = demoClient._id;
    }

    const conversation = new ChatConversation({
      client_id: clientObjectId,
      customer_name,
      customer_email,
      status: 'bot_active',
      channel: 'website'
    });

    await conversation.save();
    await conversation.populate('client_id');

    // Transform for frontend
    const transformedConversation = {
      ...conversation.toObject(),
      id: conversation._id,
      updated_date: conversation.updatedAt,
      created_date: conversation.createdAt,
      customer_name: conversation.customer_name || conversation.client_id?.name || 'Unknown',
      customer_email: conversation.customer_email || conversation.client_id?.email || ''
    };

    res.status(201).json({
      success: true,
      data: transformedConversation
    });
  } catch (error) {
    console.error('Widget conversation creation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// POST /api/widget/message - Send a message
router.post('/message', async (req, res) => {
  try {
    const { conversation_id, sender_type, sender_name, message } = req.body;

    if (!conversation_id || !message) {
      return res.status(400).json({ error: 'conversation_id and message are required' });
    }

    const chatMessage = new ChatMessage({
      conversation_id,
      sender_type: sender_type || 'customer',
      sender_name: sender_name || 'Customer',
      message
    });

    await chatMessage.save();

    // Update conversation last_message_at
    await ChatConversation.findByIdAndUpdate(conversation_id, {
      last_message_at: new Date()
    });

    // Transform for frontend
    const transformedMessage = {
      ...chatMessage.toObject(),
      id: chatMessage._id,
      created_date: chatMessage.createdAt,
      sender_name: chatMessage.sender_name
    };

    res.status(201).json({
      success: true,
      data: transformedMessage
    });
  } catch (error) {
    console.error('Widget message creation error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/widget/messages/:conversation_id - Get messages for a conversation
router.get('/messages/:conversation_id', async (req, res) => {
  try {
    const { conversation_id } = req.params;

    const messages = await ChatMessage.find({ conversation_id })
      .sort({ createdAt: 1 });

    // Transform for frontend
    const transformedMessages = messages.map(msg => ({
      ...msg.toObject(),
      id: msg._id,
      created_date: msg.createdAt,
      sender_name: msg.sender_name
    }));

    res.json({
      success: true,
      data: transformedMessages
    });
  } catch (error) {
    console.error('Widget messages fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PUT /api/widget/conversation/:id - Update conversation (for status changes)
router.put('/conversation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const conversation = await ChatConversation.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('client_id');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Transform for frontend
    const transformedConversation = {
      ...conversation.toObject(),
      id: conversation._id,
      updated_date: conversation.updatedAt,
      created_date: conversation.createdAt,
      customer_name: conversation.customer_name || conversation.client_id?.name || 'Unknown',
      customer_email: conversation.customer_email || conversation.client_id?.email || ''
    };

    res.json({
      success: true,
      data: transformedConversation
    });
  } catch (error) {
    console.error('Widget conversation update error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

module.exports = router;