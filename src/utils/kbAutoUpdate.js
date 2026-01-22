const KnowledgeBaseItem = require('../models/KnowledgeBaseItem');
const KBVersion = require('../models/KBVersion');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Extract and generate KB article from resolved ticket
async function createKBFromResolvedTicket(ticket) {
  try {
    // Check if ticket is valid and resolved
    if (!ticket || (ticket.status !== 'resolved' && !ticket.resolved_at)) {
      console.log('⚠️ Ticket validation failed. Status:', ticket?.status, 'Resolved_at:', ticket?.resolved_at);
      throw new Error('Invalid ticket or ticket not resolved');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Generate FAQ content from ticket
    const contentPrompt = `
      Based on this customer support ticket, generate a clear and professional FAQ article.
      
      Title: ${ticket.title}
      Description: ${ticket.description}
      Category: ${ticket.category}
      Tags: ${ticket.tags?.join(', ') || 'general'}
      
      Generate a comprehensive FAQ article that explains the issue and solution clearly.
      Format it with:
      1. Problem Statement
      2. Root Cause
      3. Solution Steps
      4. Prevention Tips
      5. Related Resources
    `;

    let content = ticket.description;
    let ai_summary = ticket.title;
    let search_keywords = ticket.tags || [];

    try {
      const contentResult = await model.generateContent(contentPrompt);
      content = contentResult.response.text();

      // Generate summary
      const summaryResult = await model.generateContent(
        `Summarize this KB article in 2-3 sentences:\n\n${content}`
      );
      ai_summary = summaryResult.response.text();

      // Generate keywords
      const keywordResult = await model.generateContent(
        `Extract 5-10 keywords for searching this KB article about "${ticket.title}". Return only comma-separated keywords.`
      );
      const keywordText = keywordResult.response.text();
      search_keywords = keywordText.split(',').map(k => k.trim()).filter(k => k);
    } catch (aiError) {
      console.log('⚠️ AI content generation failed, using ticket content as fallback:', aiError.message);
      // Use ticket data as fallback if AI fails
      content = ticket.description;
      ai_summary = ticket.title;
      search_keywords = [ticket.category, ...(ticket.tags || [])];
    }

    // Create KB item
    const kbItem = new KnowledgeBaseItem({
      title: `${ticket.title} - FAQ`,
      content,
      category: ticket.category || 'general',
      tags: ticket.tags || [],
      search_keywords,
      status: 'published', // Published for immediate availability
      author_id: ticket.assigned_to || ticket.created_by,
      ai_summary,
      related_items: []
    });

    await kbItem.save();

    // Create version entry
    const version = new KBVersion({
      kb_item_id: kbItem._id,
      version_number: 1,
      title: kbItem.title,
      content,
      changes_summary: `Auto-generated from resolved ticket: ${ticket.ticket_number}`,
      changed_by: ticket.assigned_to || ticket.created_by,
      change_type: 'created',
      is_published: true
    });

    await version.save();

    return {
      success: true,
      kb_item: kbItem,
      auto_generated: true
    };
  } catch (error) {
    console.error('KB auto-generation error:', error);
    throw error;
  }
}

// Bulk create KB articles from resolved tickets
async function bulkCreateKBFromTickets(tickets) {
  const results = {
    success: [],
    failed: []
  };

  for (const ticket of tickets) {
    try {
      const result = await createKBFromResolvedTicket(ticket);
      results.success.push(result);
    } catch (error) {
      results.failed.push({
        ticket_id: ticket._id,
        error: error.message
      });
    }
  }

  return results;
}

// Suggest KB suggestions based on ticket
async function suggestKBForTicket(ticket) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Generate search keywords from ticket
    const keywordPrompt = `
      Generate 5 search keywords for finding KB articles related to this support ticket:
      Title: ${ticket.title}
      Description: ${ticket.description}
      Return only comma-separated keywords.
    `;

    let keywords = [];
    try {
      const keywordResult = await model.generateContent(keywordPrompt);
      keywords = keywordResult.response.text()
        .split(',')
        .map(k => k.trim())
        .filter(k => k);
    } catch (aiError) {
      console.log('⚠️ Keyword generation failed, using category as fallback');
      keywords = [ticket.category];
    }

    // Find matching KB articles
    const matchedArticles = await KnowledgeBaseItem.find({
      status: 'published',
      $or: [
        { tags: { $in: keywords } },
        { search_keywords: { $in: keywords } },
        { category: ticket.category }
      ]
    })
      .limit(5)
      .select('title content category ai_summary');

    return {
      suggested_keywords: keywords,
      relevant_articles: matchedArticles
    };
  } catch (error) {
    console.error('KB suggestion error:', error);
    return {
      suggested_keywords: [],
      relevant_articles: []
    };
  }
}

// Link KB article to tickets
async function linkKBToTickets(kb_id, ticket_ids) {
  try {
    await KnowledgeBaseItem.findByIdAndUpdate(
      kb_id,
      { $addToSet: { related_items: { $each: ticket_ids } } }
    );

    return { success: true };
  } catch (error) {
    console.error('KB linking error:', error);
    throw error;
  }
}

module.exports = {
  createKBFromResolvedTicket,
  bulkCreateKBFromTickets,
  suggestKBForTicket,
  linkKBToTickets
};
