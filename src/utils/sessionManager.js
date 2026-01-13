/**
 * Chat Session Management
 * Handles creating new sessions for returning customers
 * Shows agents all sessions, shows customers only current session
 */

const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');

const generateSessionId = () => {
  return `SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Find or create a session for a customer
 * If customer is returning with same email, create new session but track old ones
 */
const getOrCreateSession = async (customerEmail, customerName, clientId) => {
  try {
    console.log(`🔍 Looking for existing conversations: ${customerEmail}`);
    
    // Find if this customer has previous conversations
    const existingConversations = await ChatConversation.find({
      customer_email: customerEmail.toLowerCase(),
      client_id: clientId
    }).sort({ createdAt: -1 });

    console.log(`📊 Found ${existingConversations.length} existing conversations for this customer`);

    if (existingConversations.length === 0) {
      // First time customer - create new session
      console.log(`✨ New customer: ${customerEmail}`);
      return {
        isNewSession: true,
        isNewCustomer: true,
        sessionId: generateSessionId(),
        previousSessions: []
      };
    }

    // Returning customer - check if we need new session
    const lastConversation = existingConversations[0];
    const timeSinceLastMessage = Date.now() - (lastConversation.last_message_at?.getTime() || 0);
    const hoursInactive = timeSinceLastMessage / (1000 * 60 * 60);

    console.log(`⏱️ Last message was ${hoursInactive.toFixed(1)} hours ago`);

    // If more than 24 hours inactive, create new session
    if (hoursInactive > 24) {
      console.log(`🔄 Creating new session (inactive >24hrs)`);
      
      // Archive previous session
      const sessionData = {
        session_id: generateSessionId(),
        isNewSession: true,
        isReturningCustomer: true,
        previousSessions: existingConversations.map(conv => ({
          session_id: conv.session_id || `OLD-${conv._id}`,
          conversation_id: conv._id,
          started_at: conv.createdAt,
          ended_at: lastConversation.createdAt,
          message_count: 0 // Will be calculated
        }))
      };

      // Get message counts for previous sessions
      for (let prevSession of sessionData.previousSessions) {
        const msgCount = await ChatMessage.countDocuments({
          conversation_id: prevSession.conversation_id
        });
        prevSession.message_count = msgCount;
      }

      return sessionData;
    } else {
      // Customer is still active in same session
      console.log(`📝 Returning to existing session`);
      return {
        isNewSession: false,
        isReturningCustomer: true,
        sessionId: lastConversation.session_id || `SESSION-${lastConversation._id}`,
        conversationId: lastConversation._id,
        previousSessions: []
      };
    }
  } catch (error) {
    console.error('❌ Error in session management:', error);
    // Fallback: create new session
    return {
      isNewSession: true,
      sessionId: generateSessionId(),
      previousSessions: []
    };
  }
};

/**
 * Get messages based on user role
 * Agents see: ALL messages (all sessions)
 * Customers see: ONLY current session
 */
const getMessagesForUser = async (conversationId, isAgent = false, sessionId = null) => {
  try {
    let query = { conversation_id: conversationId };

    // If customer, filter by current session only
    if (!isAgent && sessionId) {
      query.session_id = sessionId;
      console.log(`👤 Customer view - filtering by session: ${sessionId}`);
    } else if (!isAgent && !sessionId) {
      // Customer with no session - show only recent messages (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: oneDayAgo };
      console.log(`👤 Customer view - showing last 24 hours`);
    } else {
      // Agent - show ALL messages for context
      console.log(`👨‍💼 Agent view - showing all messages`);
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: 1 })
      .populate('sender_id', 'full_name email')
      .lean();

    return messages;
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    return [];
  }
};

/**
 * Get conversation history for agent view
 * Shows all sessions for this customer
 */
const getConversationHistory = async (customerEmail, clientId) => {
  try {
    const conversations = await ChatConversation.find({
      customer_email: customerEmail.toLowerCase(),
      client_id: clientId
    })
      .sort({ createdAt: -1 })
      .select('_id session_id customer_name customer_email status createdAt last_message_at')
      .lean();

    const history = [];

    for (let conv of conversations) {
      const messageCount = await ChatMessage.countDocuments({
        conversation_id: conv._id
      });

      history.push({
        conversation_id: conv._id,
        session_id: conv.session_id,
        customer_name: conv.customer_name,
        customer_email: conv.customer_email,
        status: conv.status,
        started_at: conv.createdAt,
        last_message_at: conv.last_message_at,
        message_count: messageCount,
        is_current: false // Will be set based on current context
      });
    }

    return history;
  } catch (error) {
    console.error('❌ Error fetching conversation history:', error);
    return [];
  }
};

/**
 * Create conversation session summary for agent
 * Shows comparison of old vs new messages
 */
const getSessionSummary = async (conversationId) => {
  try {
    const conversation = await ChatConversation.findById(conversationId)
      .select('session_id previous_sessions customer_name customer_email')
      .lean();

    if (!conversation) return null;

    const currentSessionMessages = await ChatMessage.countDocuments({
      conversation_id: conversationId,
      session_id: conversation.session_id
    });

    const previousSessionStats = [];

    for (let prevSession of conversation.previous_sessions || []) {
      const messages = await ChatMessage.countDocuments({
        conversation_id: prevSession.conversation_id
      });

      previousSessionStats.push({
        session_id: prevSession.session_id,
        message_count: messages,
        started_at: prevSession.started_at,
        ended_at: prevSession.ended_at
      });
    }

    return {
      customer_name: conversation.customer_name,
      customer_email: conversation.customer_email,
      current_session: {
        session_id: conversation.session_id,
        message_count: currentSessionMessages
      },
      previous_sessions: previousSessionStats,
      total_messages: currentSessionMessages + previousSessionStats.reduce((sum, s) => sum + s.message_count, 0),
      total_sessions: 1 + (conversation.previous_sessions?.length || 0)
    };
  } catch (error) {
    console.error('❌ Error generating session summary:', error);
    return null;
  }
};

module.exports = {
  generateSessionId,
  getOrCreateSession,
  getMessagesForUser,
  getConversationHistory,
  getSessionSummary
};
