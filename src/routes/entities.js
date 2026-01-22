const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
const Client = require('../models/Client');
const Ticket = require('../models/Ticket');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const KnowledgeBaseItem = require('../models/KnowledgeBaseItem');
const CannedResponse = require('../models/CannedResponse');
const User = require('../models/User');
const { sendTicketCreatedEmail, sendTicketUpdateEmail, sendTicketResolvedEmail } = require('../utils/emailService');
const { createKBFromResolvedTicket } = require('../utils/kbAutoUpdate');

const router = express.Router();

// Generic CRUD helper function
const createCRUDRoutes = (Model, modelName) => {
  // GET all entities with filtering and pagination
  router.get(`/${modelName.toLowerCase()}`, authenticateToken, async (req, res) => {
    try {
      const { page = 1, limit = 20, sort = '-createdAt', ...filters } = req.query;
      
      // Build filter object
      const filterQuery = {};
      Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key] !== '') {
          if (key.includes('_id')) {
            filterQuery[key] = filters[key];
          } else if (typeof filters[key] === 'string') {
            filterQuery[key] = { $regex: filters[key], $options: 'i' };
          } else {
            filterQuery[key] = filters[key];
          }
        }
      });

      // Add user ownership filtering for entities that have author_id or created_by
      // Skip filtering for: Ticket (dev mode), KnowledgeBaseItem (shared), CannedResponse (shared)
      if (Model.schema.paths.author_id && modelName !== 'Ticket' && modelName !== 'KnowledgeBaseItem' && modelName !== 'CannedResponse') {
        // Convert string userId to ObjectId for proper matching
        const mongoose = require('mongoose');
        const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
        filterQuery.author_id = userObjectId;
      } else if (Model.schema.paths.created_by && modelName !== 'Ticket' && modelName !== 'KnowledgeBaseItem' && modelName !== 'CannedResponse') {
        filterQuery.created_by = req.user.userId;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [items, total] = await Promise.all([
        Model.find(filterQuery)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .populate(getPopulateFields(modelName)),
        Model.countDocuments(filterQuery)
      ]);

      // Transform data for frontend if needed
      let transformedItems = items;
      if (modelName === 'Client') {
        transformedItems = items.map(item => {
          const clientData = item.toObject();
          // Extract domain from email
          let domain = clientData.email;
          if (domain && domain.includes('@')) {
            domain = domain.split('@')[1];
          }
          
          return {
            ...clientData,
            id: clientData._id, // Add id field for frontend
            company_name: clientData.name || clientData.company,
            domain: domain,
            logo_url: clientData.avatar_url || '',
            primary_color: '#4F46E5', // Default color
            is_active: clientData.status === 'active'
          };
        });
      } else if (modelName === 'ChatConversation') {
        transformedItems = items.map(item => {
          const conversationData = item.toObject();
          return {
            ...conversationData,
            id: conversationData._id,
            updated_date: conversationData.updatedAt,
            created_date: conversationData.createdAt,
            customer_name: conversationData.customer_name || conversationData.client_id?.name || 'Unknown',
            customer_email: conversationData.customer_email || conversationData.client_id?.email || '',
            assigned_agent: conversationData.assigned_to?.email || null
          };
        });
      } else if (modelName === 'ChatMessage') {
        // Normalize message fields for frontend (id, created_date, sender_name)
        transformedItems = items.map(item => {
          const msg = item.toObject();
          return {
            ...msg,
            id: msg._id,
            created_date: msg.createdAt,
            sender_name: msg.sender_name || msg.sender_id?.full_name || null
          };
        });
      } else if (modelName === 'KnowledgeBaseItem') {
        // Map Knowledge Base fields for frontend compatibility (title/content -> question/answer)
        transformedItems = items.map(item => {
          const kbItem = item.toObject();
          return {
            ...kbItem,
            id: kbItem._id,
            question: kbItem.title,
            answer: kbItem.content,
            is_active: kbItem.status === 'published',
            created_date: kbItem.createdAt,
            updated_date: kbItem.updatedAt
          };
        });
      } else if (modelName === 'Ticket') {
        // Ensure Ticket has both created_date and id for frontend compatibility
        transformedItems = items.map(item => {
          const ticket = item.toObject();
          return {
            ...ticket,
            id: ticket._id,
            created_date: ticket.created_date || ticket.createdAt,
            updated_date: ticket.updatedAt
          };
        });
      }

      res.json({
        success: true,
        data: transformedItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error(`Get ${modelName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET single entity by ID
  router.get(`/${modelName.toLowerCase()}/:id`, authenticateToken, async (req, res) => {
    try {
      const item = await Model.findById(req.params.id)
        .populate(getPopulateFields(modelName));
      
      if (!item) {
        return res.status(404).json({ error: `${modelName} not found` });
      }

      // Transform data for frontend if needed
      let transformedItem = item;
      if (modelName === 'Client') {
        const clientData = item.toObject();
        // Extract domain from email
        let domain = clientData.email;
        if (domain && domain.includes('@')) {
          domain = domain.split('@')[1];
        }
        
        transformedItem = {
          ...clientData,
          id: clientData._id, // Add id field for frontend
          company_name: clientData.name || clientData.company,
          domain: domain,
          logo_url: clientData.avatar_url || '',
          primary_color: '#4F46E5', // Default color
          is_active: clientData.status === 'active'
        };
      } else if (modelName === 'ChatConversation') {
        const conversationData = item.toObject();
        transformedItem = {
          ...conversationData,
          id: conversationData._id,
          updated_date: conversationData.updatedAt,
          created_date: conversationData.createdAt,
          customer_name: conversationData.customer_name || conversationData.client_id?.name || 'Unknown',
          customer_email: conversationData.customer_email || conversationData.client_id?.email || '',
          assigned_agent: conversationData.assigned_to?.email || null
        };
      } else if (modelName === 'ChatMessage') {
        const msg = item.toObject();
        transformedItem = {
          ...msg,
          id: msg._id,
          created_date: msg.createdAt,
          sender_name: msg.sender_name || msg.sender_id?.full_name || null
        };
      } else if (modelName === 'KnowledgeBaseItem') {
        const kbItem = item.toObject();
        transformedItem = {
          ...kbItem,
          id: kbItem._id,
          question: kbItem.title,
          answer: kbItem.content,
          is_active: kbItem.status === 'published',
          created_date: kbItem.createdAt,
          updated_date: kbItem.updatedAt
        };
      } else if (modelName === 'Ticket') {
        const ticket = item.toObject();
        transformedItem = {
          ...ticket,
          id: ticket._id,
          created_date: ticket.created_date || ticket.createdAt,
          updated_date: ticket.updatedAt
        };
      }

      res.json({
        success: true,
        data: transformedItem
      });
    } catch (error) {
      console.error(`Get ${modelName} by ID error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST create new entity
  router.post(`/${modelName.toLowerCase()}`, authenticateToken, async (req, res) => {
    try {
      // Add user ID for models that track who created them
      const data = { ...req.body };
      console.log(`📤 POST /${modelName.toLowerCase()} - modelName: ${modelName}`);
      console.log(`📤 Incoming data:`, data);
      
      // Handle field mapping for Client model
      if (modelName === 'Client') {
        // Map frontend fields to backend fields
        if (data.company_name) {
          data.name = data.company_name;
          delete data.company_name;
        }
        if (data.domain) {
          // Convert domain to email format if it doesn't contain @
          data.email = data.domain.includes('@') ? data.domain : `contact@${data.domain}`;
          delete data.domain;
        }
        if (data.is_active !== undefined) {
          data.status = data.is_active ? 'active' : 'inactive';
          delete data.is_active;
        }
        if (data.logo_url) {
          data.avatar_url = data.logo_url;
          delete data.logo_url;
        }
        // Add company field from the name
        if (data.name && !data.company) {
          data.company = data.name;
        }
      }
      
      // Handle field mapping for KnowledgeBaseItem model
      if (modelName === 'KnowledgeBaseItem') {
        // Map frontend fields to backend fields
        if (data.question && !data.title) {
          data.title = data.question;
          delete data.question;
        }
        if (data.answer && !data.content) {
          data.content = data.answer;
          delete data.answer;
        }
        // Ensure required fields are present
        if (!data.title && data.name) {
          data.title = data.name;
        }
        if (!data.content && data.description) {
          data.content = data.description;
        }
      }
      
      // Handle demo-client special case for ChatConversation
      if (modelName === 'ChatConversation' && data.client_id === 'demo-client') {
        // Create or find a demo client
        const Client = require('../models/Client');
        let demoClient = await Client.findOne({ name: 'Demo Client' });
        
        if (!demoClient) {
          demoClient = new Client({
            name: 'Demo Client',
            email: 'demo@example.com',
            company: 'Demo Company',
            phone: '+1-555-0123',
            address: 'Demo Address',
            status: 'active',
            created_by: req.user.userId
          });
          await demoClient.save();
        }
        
        data.client_id = demoClient._id;
      }
      
      // DO NOT generate ticket number here - let the model's pre-save hook handle it
      // This prevents duplicate entry errors from race conditions
      if (modelName === 'Ticket') {
        console.log('📝 Ticket creation - ticket number will be generated by model pre-save hook');
      }
      
      if (Model.schema.paths.author_id) {
        data.author_id = req.user.userId;
      }
      if (Model.schema.paths.created_by) {
        data.created_by = req.user.userId;
      }

      const item = new Model(data);
      console.log(`📝 Creating ${modelName} with data:`, data);
      await item.save();
      console.log(`✅ ${modelName} saved successfully:`, item);
      
      await item.populate(getPopulateFields(modelName));

      // Send email notification if this is a Ticket
      if (modelName === 'Ticket' && item.customer_email) {
        await sendTicketCreatedEmail(item);
      }

      // Transform response data for frontend compatibility
      let responseData = item;
      if (modelName === 'Ticket') {
        const ticket = item.toObject();
        responseData = {
          ...ticket,
          id: ticket._id,
          created_date: ticket.created_date || ticket.createdAt,
          updated_date: ticket.updatedAt
        };
      }

      res.status(201).json({
        success: true,
        data: responseData,
        message: `${modelName} created successfully`
      });
    } catch (error) {
      console.error(`❌ Create ${modelName} error:`, error);
      console.error(`❌ Error details:`, error.message);
      if (error.errors) {
        console.error(`❌ Validation errors:`, error.errors);
      }
      
      // Handle MongoDB duplicate key error
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        console.error(`❌ Duplicate ${field} detected`);
        return res.status(400).json({ 
          error: `Duplicate entry for ${field}. This ${field} already exists.`,
          details: error.message
        });
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: error.message
        });
      }
      
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // PUT update entity
  router.put(`/${modelName.toLowerCase()}/:id`, authenticateToken, async (req, res) => {
    try {
      const updates = { ...req.body };
      
      // Add last updated by for models that track it
      if (Model.schema.paths.last_updated_by) {
        updates.last_updated_by = req.user.userId;
      }

      // Set resolved_at timestamp if ticket is being resolved
      if (modelName === 'Ticket' && updates.status === 'resolved' && !updates.resolved_at) {
        updates.resolved_at = new Date();
      }

      const item = await Model.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate(getPopulateFields(modelName));

      if (!item) {
        return res.status(404).json({ error: `${modelName} not found` });
      }

      // Send email notification if this is a Ticket with status change
      if (modelName === 'Ticket' && item.customer_email) {
        if (updates.status === 'resolved' || updates.status === 'closed') {
          await sendTicketResolvedEmail(item);
          
          // Auto-create KB article from resolved ticket
          try {
            console.log('📚 Attempting to auto-create KB article from resolved ticket...');
            const kbArticle = await createKBFromResolvedTicket(item);
            if (kbArticle) {
              console.log('✅ KB article auto-created:', kbArticle._id);
            }
          } catch (kbError) {
            console.error('⚠️ KB auto-update failed (non-blocking):', kbError.message);
            // Don't fail the ticket update if KB creation fails
          }
        } else if (Object.keys(updates).length > 0) {
          await sendTicketUpdateEmail(item, updates);
        }
      }

      res.json({
        success: true,
        data: item,
        message: `${modelName} updated successfully`
      });
    } catch (error) {
      console.error(`Update ${modelName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE entity
  router.delete(`/${modelName.toLowerCase()}/:id`, authenticateToken, async (req, res) => {
    try {
      const item = await Model.findByIdAndDelete(req.params.id);
      
      if (!item) {
        return res.status(404).json({ error: `${modelName} not found` });
      }

      res.json({
        success: true,
        message: `${modelName} deleted successfully`
      });
    } catch (error) {
      console.error(`Delete ${modelName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};

// Helper function to get populate fields based on model
const getPopulateFields = (modelName) => {
  const populateMap = {
    'Ticket': ['client_id', 'assigned_to', 'created_by'],
    'ChatConversation': ['client_id', 'assigned_to'],
    'ChatMessage': ['conversation_id', 'sender_id'],
    'KnowledgeBaseItem': ['author_id', 'last_updated_by'],
    'CannedResponse': ['author_id']
  };
  return populateMap[modelName] || [];
};

// Create CRUD routes for each model
createCRUDRoutes(Client, 'Client');
createCRUDRoutes(Ticket, 'Ticket');
createCRUDRoutes(ChatConversation, 'ChatConversation');
createCRUDRoutes(ChatMessage, 'ChatMessage');
createCRUDRoutes(KnowledgeBaseItem, 'KnowledgeBaseItem');
createCRUDRoutes(CannedResponse, 'CannedResponse');
createCRUDRoutes(User, 'User');

// Get conversation history for a customer
router.get('/chat/history', authenticateToken, async (req, res) => {
  try {
    const { email, clientId } = req.query;

    if (!email || !clientId) {
      return res.status(400).json({ error: 'Email and clientId are required' });
    }

    console.log(`📋 Fetching conversation history for ${email} in client ${clientId}`);

    // First, check all conversations with this email (for debugging)
    const allConvWithEmail = await ChatConversation.countDocuments({
      customer_email: email.toLowerCase()
    });
    console.log(`🔍 Total conversations with email "${email}": ${allConvWithEmail}`);

    // Now get filtered by clientId
    const conversations = await ChatConversation.find({
      customer_email: email.toLowerCase(),
      client_id: clientId
    })
      .sort({ createdAt: -1 })
      .select('_id session_id customer_name customer_email status createdAt last_message_at client_id')
      .lean();

    console.log(`✅ Found ${conversations.length} conversations for this email+clientId`);

    const history = [];

    for (let conv of conversations) {
      const messageCount = await ChatMessage.countDocuments({
        conversation_id: conv._id
      });

      console.log(`  - Conversation ${conv._id}: ${messageCount} messages`);

      history.push({
        conversation_id: conv._id,
        session_id: conv.session_id,
        customer_name: conv.customer_name,
        customer_email: conv.customer_email,
        status: conv.status,
        started_at: conv.createdAt,
        last_message_at: conv.last_message_at,
        message_count: messageCount
      });
    }

    console.log(`✅ Found ${history.length} conversations for ${email}`);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('❌ Error fetching conversation history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Additional custom endpoints

// Search knowledge base
router.get('/knowledgebaseitem/search', authenticateToken, async (req, res) => {
  try {
    const { q, category, status = 'published' } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchQuery = {
      $text: { $search: q },
      status: status
    };

    if (category) {
      searchQuery.category = category;
    }

    const items = await KnowledgeBaseItem.find(searchQuery)
      .select('title content category tags author_id createdAt')
      .populate('author_id', 'full_name')
      .sort({ score: { $meta: 'textScore' } })
      .limit(10);

    res.json({
      success: true,
      data: items,
      query: q
    });
  } catch (error) {
    console.error('Knowledge base search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const [
      totalTickets,
      openTickets,
      totalClients,
      totalConversations,
      activeConversations
    ] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      Client.countDocuments(),
      ChatConversation.countDocuments(),
      ChatConversation.countDocuments({ status: 'active' })
    ]);

    res.json({
      success: true,
      data: {
        tickets: {
          total: totalTickets,
          open: openTickets,
          closed: totalTickets - openTickets
        },
        clients: {
          total: totalClients
        },
        conversations: {
          total: totalConversations,
          active: activeConversations
        }
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation history for a customer
router.get('/chat/history', authenticateToken, async (req, res) => {
  try {
    const { email, clientId } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    console.log('📋 Fetching conversation history for', email, 'in client', clientId);

    // Find all conversations with this email
    const allConvWithEmail = await ChatConversation.countDocuments({
      customer_email: email.toLowerCase()
    });
    console.log(`🔍 Total conversations with email "${email}": ${allConvWithEmail}`);

    // Find conversations for this email and client
    const conversations = await ChatConversation.find({
      customer_email: email.toLowerCase(),
      client_id: clientId
    })
    .sort({ createdAt: -1 })
    .populate('assigned_to', 'full_name email');

    console.log(`✅ Found ${conversations.length} conversations for this email+clientId`);

    // For each conversation, get message count
    const conversationsWithMessageCount = await Promise.all(
      conversations.map(async (conv) => {
        const messageCount = await ChatMessage.countDocuments({
          conversation_id: conv._id
        });
        console.log(`- Conversation ${conv._id}: ${messageCount} messages`);
        return {
          conversation_id: conv._id,
          subject: conv.subject,
          customer_name: conv.customer_name,
          customer_email: conv.customer_email,
          status: conv.status,
          started_at: conv.createdAt,
          updated_at: conv.updatedAt,
          message_count: messageCount,
          assigned_to: conv.assigned_to,
          last_message_at: conv.last_message_at
        };
      })
    );

    res.json({
      success: true,
      data: conversationsWithMessageCount,
      message: conversationsWithMessageCount.length > 0 
        ? `Found ${conversationsWithMessageCount.length} previous conversation(s)` 
        : 'No previous conversations found'
    });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;