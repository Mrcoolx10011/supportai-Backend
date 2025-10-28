const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
const Client = require('../models/Client');
const Ticket = require('../models/Ticket');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const KnowledgeBaseItem = require('../models/KnowledgeBaseItem');
const CannedResponse = require('../models/CannedResponse');

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
      if (Model.schema.paths.author_id) {
        // Convert string userId to ObjectId for proper matching
        const mongoose = require('mongoose');
        const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
        filterQuery.author_id = userObjectId;
      } else if (Model.schema.paths.created_by) {
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
            created_date: kbItem.createdAt,
            updated_date: kbItem.updatedAt
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
          created_date: kbItem.createdAt,
          updated_date: kbItem.updatedAt
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
      
      if (Model.schema.paths.author_id) {
        data.author_id = req.user.userId;
      }
      if (Model.schema.paths.created_by) {
        data.created_by = req.user.userId;
      }

      const item = new Model(data);
      await item.save();
      
      await item.populate(getPopulateFields(modelName));

      res.status(201).json({
        success: true,
        data: item,
        message: `${modelName} created successfully`
      });
    } catch (error) {
      console.error(`Create ${modelName} error:`, error);
      if (error.code === 11000) {
        return res.status(400).json({ error: 'Duplicate entry' });
      }
      res.status(500).json({ error: 'Internal server error' });
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

      const item = await Model.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate(getPopulateFields(modelName));

      if (!item) {
        return res.status(404).json({ error: `${modelName} not found` });
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

module.exports = router;