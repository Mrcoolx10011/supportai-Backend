const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticateToken } = require('./auth');
const User = require('../models/User');

const router = express.Router();

// Available Gemini models
const AVAILABLE_MODELS = {
  'gemini-2.5-flash': 'gemini-2.5-flash',      // Latest fast and efficient model
  'gemini-1.5-flash': 'gemini-1.5-flash',      // Fast and efficient for most use cases
  'gemini-1.5-pro': 'gemini-1.5-pro',          // More capable for complex tasks
  'gemini-1.0-pro': 'gemini-1.0-pro'           // Legacy model (still supported)
};

// Default model
const DEFAULT_MODEL = 'gemini-2.5-flash';

// Test AI with user's API key (simple text response)
router.post('/test-simple', authenticateToken, async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.5-flash' } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get user's API key
    const user = await User.findById(req.user.userId);
    if (!user || !user.ai_api_key) {
      return res.status(400).json({ 
        error: 'Google Gemini API key not found. Please configure your API key in settings.' 
      });
    }

    // Initialize Google Generative AI client with user's API key
    const genAI = new GoogleGenerativeAI(user.ai_api_key);
    const geminiModel = genAI.getGenerativeModel({ model: model });

    // Simple system prompt for clean text response
    const systemPrompt = `You are a helpful customer support assistant. 
    
    Provide a clear, helpful response to the customer's question. 
    Be professional, friendly, and concise.
    
    Do not include any JSON formatting, markdown, or special characters in your response.
    Just provide a clean, simple text answer.`;

    const fullPrompt = `${systemPrompt}\n\nCustomer question: ${prompt}`;

    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    let content = response.text();
    
    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    // Clean up any remaining formatting
    content = content.trim();

    res.json({
      success: true,
      data: {
        response: content,
        confidence: 0.9,
        model: model
      },
      usage: {
        prompt_tokens: fullPrompt.length,
        completion_tokens: content.length,
        total_tokens: fullPrompt.length + content.length
      }
    });

  } catch (error) {
    console.error('AI Test Simple error:', error);
    
    // Handle specific Gemini errors
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid API key')) {
      return res.status(400).json({ 
        error: 'Invalid Google Gemini API key. Please check your API key in settings.' 
      });
    }
    
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      return res.status(400).json({ 
        error: 'Gemini quota exceeded. Please check your Google Cloud billing.' 
      });
    }

    if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      });
    }

    res.status(500).json({ 
      error: error.message || 'AI service error' 
    });
  }
});

// Test AI with user's API key
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.5-flash' } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get user's API key
    const user = await User.findById(req.user.userId);
    if (!user || !user.ai_api_key) {
      return res.status(400).json({ 
        error: 'Google Gemini API key not found. Please configure your API key in settings.' 
      });
    }

    // Initialize Google Generative AI client with user's API key
    const genAI = new GoogleGenerativeAI(user.ai_api_key);
    const geminiModel = genAI.getGenerativeModel({ model: model });

    // Prepare system prompt for structured response
    const systemPrompt = `You are a helpful customer support assistant. 
    
    Respond with a JSON object containing exactly these fields:
    - "response": your helpful response as a string
    - "confidence": a number between 0 and 1 indicating your confidence in the response
    
    Return ONLY the JSON object, no markdown formatting, no backticks, no additional text.
    
    Example format:
    {"response": "Your answer here", "confidence": 0.9}`;

    const fullPrompt = `${systemPrompt}\n\nUser question: ${prompt}`;

    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    let content = response.text();
    
    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    // Clean up the response - remove markdown formatting if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Additional cleaning for common formatting issues
    content = content.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
    content = content.replace(/^json\s*/g, '');

    console.log('Cleaned AI content:', content);

    // Try to parse JSON response
    let aiResponse;
    try {
      aiResponse = JSON.parse(content);
    } catch (parseError) {
      console.log('JSON parsing failed, content:', content);
      // If JSON parsing fails, return raw content
      aiResponse = {
        response: content,
        confidence: 0.8
      };
    }

    // Ensure required fields exist
    if (!aiResponse.response) {
      aiResponse.response = content;
    }
    if (typeof aiResponse.confidence !== 'number') {
      aiResponse.confidence = 0.8;
    }

    res.json({
      success: true,
      data: aiResponse,
      model: model,
      usage: {
        prompt_tokens: prompt.length,
        completion_tokens: content.length,
        total_tokens: prompt.length + content.length
      }
    });

  } catch (error) {
    console.error('AI Test error:', error);
    
    // Handle specific Gemini errors
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid API key')) {
      return res.status(400).json({ 
        error: 'Invalid Google Gemini API key. Please check your API key in settings.' 
      });
    }
    
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      return res.status(400).json({ 
        error: 'Gemini quota exceeded. Please check your Google Cloud billing.' 
      });
    }

    if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      });
    }

    res.status(500).json({ 
      error: error.message || 'AI service error' 
    });
  }
});

// Generate AI response for customer support
router.post('/generate-response', authenticateToken, async (req, res) => {
  try {
    const { 
      customer_message, 
      context = '', 
      conversation_history = [],
      model = 'gemini-2.5-flash' 
    } = req.body;

    if (!customer_message || !customer_message.trim()) {
      return res.status(400).json({ error: 'Customer message is required' });
    }

    // Get user's API key or use default for demo
    const user = await User.findById(req.user.userId);
    let apiKey = user?.ai_api_key;
    
    // Use demo API key if user doesn't have one configured
    if (!apiKey) {
      // For demo purposes - in production this should be set in environment variables
      apiKey = process.env.GOOGLE_AI_API_KEY || 'AIzaSyDemoKeyForTesting'; // Replace with actual key
      
      if (!apiKey || apiKey === 'AIzaSyDemoKeyForTesting') {
        // Return a demo response when no real API key is available
        return res.json({
          success: true,
          data: {
            response: "Hello! I'm a demo AI assistant. I can help you with general questions about our services. How can I assist you today?",
            confidence: 0.8,
            model_used: 'demo-mode',
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        });
      }
    }

    // Initialize Google Generative AI client
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model });

    // Build conversation context
    let conversationContext = '';
    if (conversation_history.length > 0) {
      conversationContext = '\n\nConversation History:\n';
      conversation_history.forEach(msg => {
        const role = msg.role === 'customer' ? 'Customer' : 'Assistant';
        conversationContext += `${role}: ${msg.content}\n`;
      });
    }

    const systemPrompt = `You are a professional customer support assistant. 
    
    Guidelines:
    - Be helpful, polite, and professional
    - Provide clear and concise responses
    - If you're not sure about something, acknowledge it and offer to escalate
    - Always aim to resolve the customer's issue
    
    Context: ${context}
    ${conversationContext}
    
    Respond with a JSON object containing:
    - "response": your customer support response
    - "confidence": number 0-1 indicating confidence in your response
    - "escalate": boolean indicating if this should be escalated to human agent
    - "category": string categorizing the customer's inquiry (e.g., "billing", "technical", "general")
    
    Return ONLY the JSON object, no markdown formatting, no backticks, no additional text.
    
    Example format:
    {"response": "Your answer here", "confidence": 0.9, "escalate": false, "category": "general"}
    
    Current customer message: ${customer_message}`;

    const result = await geminiModel.generateContent(systemPrompt);
    const response = await result.response;
    let content = response.text();
    
    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    // Clean up the response - remove markdown formatting if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Additional cleaning for common formatting issues
    content = content.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
    content = content.replace(/^json\s*/g, '');

    console.log('Cleaned AI content (generate-response):', content);

    // Parse AI response
    let aiResponse;
    try {
      aiResponse = JSON.parse(content);
    } catch (parseError) {
      console.log('JSON parsing failed, content:', content);
      aiResponse = {
        response: content,
        confidence: 0.7,
        escalate: false,
        category: 'general'
      };
    }

    // Validate and set defaults
    aiResponse.response = aiResponse.response || content;
    aiResponse.confidence = typeof aiResponse.confidence === 'number' ? aiResponse.confidence : 0.7;
    aiResponse.escalate = typeof aiResponse.escalate === 'boolean' ? aiResponse.escalate : false;
    aiResponse.category = aiResponse.category || 'general';

    res.json({
      success: true,
      data: aiResponse,
      model: model,
      usage: {
        prompt_tokens: systemPrompt.length,
        completion_tokens: content.length,
        total_tokens: systemPrompt.length + content.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Generate Response error:', error);
    
    // Handle Gemini specific errors
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid API key')) {
      return res.status(400).json({ 
        error: 'Invalid Google Gemini API key. Please check your API key in settings.' 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'AI service error' 
    });
  }
});

// Get AI usage statistics
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    // This would typically track usage from your database
    // For now, return mock data
    res.json({
      success: true,
      data: {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        avg_confidence: 0,
        last_request: null,
        quota_remaining: null
      }
    });
  } catch (error) {
    console.error('AI Usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;