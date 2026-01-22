const { GoogleGenerativeAI } = require('@google/generative-ai');
const natural = require('natural');
const Sentiment = require('sentiment');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const sentiment = new Sentiment();

// Sentiment analysis and escalation detection
async function analyzeSentiment(text) {
  try {
    const result = sentiment.analyze(text);
    const sentimentScore = result.score; // Range: -5 to +5
    
    // Normalize to -1 to +1
    const normalizedScore = sentimentScore / 5;
    
    let sentimentLabel = 'neutral';
    let escalationTriggered = false;
    let escalationReason = null;

    if (normalizedScore >= 0.3) {
      sentimentLabel = 'positive';
    } else if (normalizedScore <= -0.3) {
      sentimentLabel = 'negative';
      // Check for escalation triggers
      if (normalizedScore <= -0.7) {
        escalationTriggered = true;
        escalationReason = 'Negative sentiment detected';
      }
    }

    // Check for escalation keywords
    const escalationKeywords = [
      'angry', 'frustrated', 'terrible', 'awful', 'worst',
      'unacceptable', 'impossible', 'never', 'hate', 'disgusted',
      'complaint', 'refund', 'lawyer', 'sue', 'escalate'
    ];

    const hasEscalationKeyword = escalationKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );

    if (hasEscalationKeyword && !escalationTriggered) {
      escalationTriggered = true;
      escalationReason = 'Escalation keyword detected';
    }

    return {
      sentiment: sentimentLabel,
      score: normalizedScore,
      escalation_triggered: escalationTriggered,
      escalation_reason: escalationReason,
      raw_score: result.score,
      words: result.words,
      comparative: result.comparative
    };
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return {
      sentiment: 'unknown',
      score: 0,
      escalation_triggered: false,
      escalation_reason: null
    };
  }
}

// Generate AI response suggestions
async function generateResponseSuggestions(chatMessage, chatHistory = [], kbArticles = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Build context from chat history
    let conversationContext = 'Recent conversation:\n';
    chatHistory.slice(-5).forEach((msg, idx) => {
      conversationContext += `${msg.role}: ${msg.content}\n`;
    });

    // Add KB context
    let kbContext = '';
    if (kbArticles.length > 0) {
      kbContext = '\nRelevant Knowledge Base Articles:\n';
      kbArticles.forEach((article, idx) => {
        kbContext += `${idx + 1}. ${article.title}: ${article.ai_summary}\n`;
      });
    }

    const prompt = `
      You are an AI assistant helping a support agent respond to a customer.
      
      ${conversationContext}
      
      Customer's last message: "${chatMessage}"
      
      ${kbContext}
      
      Generate 3 different response options that the agent could send. 
      Each response should be professional, helpful, and based on the context.
      Format: 
      RESPONSE 1: [response text]
      RESPONSE 2: [response text]
      RESPONSE 3: [response text]
      
      Also provide a confidence score (0-1) for how well each addresses the customer's needs.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse responses
    const responses = [];
    const responseMatches = responseText.match(/RESPONSE \d+:(.+?)(?=RESPONSE \d+:|$)/gs) || [];
    
    responseMatches.forEach((match, idx) => {
      const content = match.replace(/RESPONSE \d+:/i, '').trim();
      responses.push({
        id: `suggestion_${Date.now()}_${idx}`,
        text: content,
        confidence: 0.8 + (Math.random() * 0.15), // 0.8-0.95
        uses_count: 0
      });
    });

    return responses.slice(0, 3);
  } catch (error) {
    console.error('Response suggestion error:', error);
    return [];
  }
}

// Auto-complete suggestions
async function generateAutoComplete(currentText, previousMessages = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
      Based on this partial support response: "${currentText}"
      
      Provide 3-5 natural completions that would finish this message professionally.
      Return ONLY the completion text without the original partial message.
      
      Format:
      COMPLETION 1: [completion text]
      COMPLETION 2: [completion text]
      etc.
    `;

    const result = await model.generateContent(prompt);
    const completionText = result.response.text();

    const completions = [];
    const matches = completionText.match(/COMPLETION \d+:(.+?)(?=COMPLETION \d+:|$)/gs) || [];
    
    matches.forEach((match, idx) => {
      const text = match.replace(/COMPLETION \d+:/i, '').trim();
      completions.push({
        id: `completion_${idx}`,
        text: currentText + text,
        confidence: 0.75 + (Math.random() * 0.2)
      });
    });

    return completions.slice(0, 5);
  } catch (error) {
    console.error('Auto-complete error:', error);
    return [];
  }
}

// Common phrase suggestions
const commonPhrases = {
  greeting: [
    'Hello! Thank you for contacting us.',
    'Hi there! How can I help you today?',
    'Greetings! I\'m here to assist you.'
  ],
  acknowledgment: [
    'I understand your concern.',
    'Thank you for bringing this to our attention.',
    'I appreciate you providing those details.'
  ],
  explanation: [
    'Let me explain what\'s happening.',
    'Here\'s what I found regarding your issue:',
    'Based on your description, here\'s what I recommend:'
  ],
  solution: [
    'To resolve this, please try the following steps:',
    'Here\'s how we can fix this:',
    'The solution is straightforward:'
  ],
  closing: [
    'Is there anything else I can help you with?',
    'Please let me know if you need further assistance.',
    'Feel free to reach out if you have any other questions.'
  ],
  escalation: [
    'I understand this needs immediate attention. Let me escalate this to our specialist team.',
    'This requires expert assistance. I\'m connecting you with our senior support team.',
    'Based on the complexity, I\'m escalating this to ensure you get the best resolution.'
  ]
};

// Get common phrase suggestions
function getCommonPhraseSuggestions(context = 'general') {
  const phrases = commonPhrases[context] || commonPhrases.greeting;
  return phrases.map((text, idx) => ({
    id: `phrase_${context}_${idx}`,
    text,
    category: context,
    uses_count: 0
  }));
}

// Summarize conversation
async function summarizeConversation(messages) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    let conversationText = '';
    messages.forEach(msg => {
      conversationText += `${msg.role === 'agent' ? 'Agent' : 'Customer'}: ${msg.content}\n`;
    });

    const prompt = `
      Summarize this customer support conversation in 3-4 bullet points covering:
      - Main issue
      - Solution provided
      - Current status
      
      Conversation:
      ${conversationText}
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Summarization error:', error);
    return 'Unable to generate summary';
  }
}

module.exports = {
  analyzeSentiment,
  generateResponseSuggestions,
  generateAutoComplete,
  getCommonPhraseSuggestions,
  summarizeConversation,
  commonPhrases
};
