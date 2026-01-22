const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult, param } = require('express-validator');
const KnowledgeBaseItem = require('../models/KnowledgeBaseItem');
const KBVersion = require('../models/KBVersion');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticateToken } = require('./auth');

// Multer config for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf', 'text/html'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Helper function to generate embeddings for RAG
async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return null;
  }
}

// Helper function for similarity scoring
function calculateSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

// Create KB article
router.post('/', authenticateToken, [
  body('title').notEmpty().trim().escape(),
  body('content').notEmpty(),
  body('category').optional().trim(),
  body('tags').optional().isArray(),
  body('search_keywords').optional().isArray(),
  body('status').optional().isIn(['draft', 'published', 'archived'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, category, tags, search_keywords, status } = req.body;
    const author_id = req.user?.userId || req.user?.id;

    if (!author_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate AI summary
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const aiSummaryPrompt = `Summarize this knowledge base article in 2-3 sentences:\n\n${content}`;
    const summaryResult = await model.generateContent(aiSummaryPrompt);
    const ai_summary = summaryResult.response.text();

    // Generate embedding for RAG
    const embedding = await generateEmbedding(content);

    const kbItem = new KnowledgeBaseItem({
      title,
      content,
      category: category || 'general',
      tags: tags || [],
      search_keywords: search_keywords || [],
      status: status || 'published',
      author_id,
      ai_summary,
      embedding
    });

    await kbItem.save();

    // Create version 1
    const version = new KBVersion({
      kb_item_id: kbItem._id,
      version_number: 1,
      title,
      content,
      changes_summary: 'Initial creation',
      changed_by: author_id,
      change_type: 'created',
      is_published: status === 'published'
    });

    await version.save();

    res.status(201).json({ 
      success: true, 
      kb_item: kbItem,
      version_info: {
        version_number: 1,
        created_at: version.createdAt
      }
    });
  } catch (error) {
    console.error('KB create error:', error);
    res.status(500).json({ error: 'Failed to create KB article' });
  }
});

// Upload KB article from file
router.post('/upload', authenticateToken, upload.single('file'), [
  body('title').notEmpty().trim().escape(),
  body('category').optional().trim(),
  body('tags').optional().isArray()
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, category, tags } = req.body;
    const author_id = req.user?.userId || req.user?.id;

    if (!author_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const content = req.file.buffer.toString('utf-8');

    // Generate AI summary and embedding
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const summaryResult = await model.generateContent(
      `Summarize this knowledge base article in 2-3 sentences:\n\n${content}`
    );
    const ai_summary = summaryResult.response.text();

    const embedding = await generateEmbedding(content);

    const kbItem = new KnowledgeBaseItem({
      title: title || req.file.originalname,
      content,
      category: category || 'general',
      tags: tags || [],
      status: 'published',
      author_id,
      ai_summary,
      embedding,
      attachments: [{
        filename: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        uploaded_at: new Date()
      }]
    });

    await kbItem.save();

    const version = new KBVersion({
      kb_item_id: kbItem._id,
      version_number: 1,
      title: kbItem.title,
      content,
      changes_summary: `Uploaded from file: ${req.file.originalname}`,
      changed_by: author_id,
      change_type: 'created',
      is_published: false
    });

    await version.save();

    res.status(201).json({ 
      success: true, 
      kb_item: kbItem,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Update KB article with version control
router.put('/:id', [
  param('id').isMongoId(),
  body('title').optional().notEmpty().trim().escape(),
  body('content').optional().notEmpty(),
  body('category').optional().trim(),
  body('tags').optional().isArray(),
  body('changes_summary').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, content, category, tags, changes_summary, status } = req.body;
    const user_id = req.user?.userId || req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const kbItem = await KnowledgeBaseItem.findById(id);
    if (!kbItem) {
      return res.status(404).json({ error: 'KB item not found' });
    }

    // Get latest version
    const latestVersion = await KBVersion.findOne({ kb_item_id: id })
      .sort({ version_number: -1 });

    const newVersionNumber = (latestVersion?.version_number || 0) + 1;

    // Update KB item
    if (title) kbItem.title = title;
    if (content) {
      kbItem.content = content;
      // Regenerate summary and embedding
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const summaryResult = await model.generateContent(
        `Summarize this knowledge base article in 2-3 sentences:\n\n${content}`
      );
      kbItem.ai_summary = summaryResult.response.text();
      kbItem.embedding = await generateEmbedding(content);
    }
    if (category) kbItem.category = category;
    if (tags) kbItem.tags = tags;
    if (status) kbItem.status = status;
    
    kbItem.last_updated_by = user_id;
    await kbItem.save();

    // Create new version
    const version = new KBVersion({
      kb_item_id: id,
      version_number: newVersionNumber,
      title: kbItem.title,
      content: kbItem.content,
      changes_summary,
      changed_by: user_id,
      change_type: status ? 'published' : 'updated',
      previous_version: latestVersion?.version_number || null,
      is_published: status === 'published'
    });

    await version.save();

    res.json({ 
      success: true, 
      kb_item: kbItem,
      version_info: {
        version_number: newVersionNumber,
        updated_at: version.createdAt
      }
    });
  } catch (error) {
    console.error('KB update error:', error);
    res.status(500).json({ error: 'Failed to update KB article' });
  }
});

// Get KB article with version history
router.get('/:id', [param('id').isMongoId()], async (req, res) => {
  try {
    const { id } = req.params;
    const { include_versions } = req.query;

    const kbItem = await KnowledgeBaseItem.findById(id)
      .populate('author_id', 'name email')
      .populate('last_updated_by', 'name email');

    if (!kbItem) {
      return res.status(404).json({ error: 'KB item not found' });
    }

    kbItem.view_count += 1;
    await kbItem.save();

    const response = { kb_item: kbItem };

    if (include_versions === 'true') {
      const versions = await KBVersion.find({ kb_item_id: id })
        .populate('changed_by', 'name email')
        .sort({ version_number: -1 });
      response.versions = versions;
    }

    res.json(response);
  } catch (error) {
    console.error('KB get error:', error);
    res.status(500).json({ error: 'Failed to retrieve KB article' });
  }
});

// Get version history
router.get('/:id/versions', [param('id').isMongoId()], async (req, res) => {
  try {
    const { id } = req.params;
    
    const versions = await KBVersion.find({ kb_item_id: id })
      .populate('changed_by', 'name email')
      .sort({ version_number: -1 });

    res.json({ versions });
  } catch (error) {
    console.error('Version history error:', error);
    res.status(500).json({ error: 'Failed to retrieve version history' });
  }
});

// Restore to previous version
router.post('/:id/restore/:versionNumber', [
  param('id').isMongoId(),
  param('versionNumber').isInt({ min: 1 })
], async (req, res) => {
  try {
    const { id, versionNumber } = req.params;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const versionToRestore = await KBVersion.findOne({
      kb_item_id: id,
      version_number: parseInt(versionNumber)
    });

    if (!versionToRestore || !versionToRestore.restore_enabled) {
      return res.status(404).json({ error: 'Version not found or cannot be restored' });
    }

    const kbItem = await KnowledgeBaseItem.findById(id);
    if (!kbItem) {
      return res.status(404).json({ error: 'KB item not found' });
    }

    // Get current version number
    const latestVersion = await KBVersion.findOne({ kb_item_id: id })
      .sort({ version_number: -1 });

    // Update content
    kbItem.content = versionToRestore.content;
    kbItem.title = versionToRestore.title;
    kbItem.last_updated_by = user_id;
    await kbItem.save();

    // Create restore version entry
    const newVersion = new KBVersion({
      kb_item_id: id,
      version_number: (latestVersion?.version_number || 0) + 1,
      title: versionToRestore.title,
      content: versionToRestore.content,
      changes_summary: `Restored to version ${versionNumber}`,
      changed_by: user_id,
      change_type: 'restored',
      previous_version: latestVersion?.version_number || null,
      is_published: kbItem.status === 'published'
    });

    await newVersion.save();

    res.json({ 
      success: true,
      message: `Restored to version ${versionNumber}`,
      kb_item: kbItem
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Search KB with similarity matching
router.post('/search/similarity', [
  body('query').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query, limit = 10, threshold = 0.6 } = req.body;

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      return res.status(500).json({ error: 'Failed to process search query' });
    }

    // Get all published KB items
    const kbItems = await KnowledgeBaseItem.find({ 
      status: 'published',
      embedding: { $exists: true }
    }).select('title content category ai_summary embedding status');

    // Calculate similarity scores
    const results = kbItems
      .map(item => ({
        ...item.toObject(),
        similarity_score: calculateSimilarity(queryEmbedding, item.embedding)
      }))
      .filter(item => item.similarity_score >= threshold)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    res.json({ 
      query,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search KB' });
  }
});

// Text search in KB
router.get('/search/text', async (req, res) => {
  try {
    const { q, category, status = 'published', limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const filter = { status: status || 'published' };
    if (category) filter.category = category;

    const results = await KnowledgeBaseItem.find(
      { ...filter, $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .select('title content category ai_summary view_count helpful_count');

    res.json({ 
      query: q,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Text search error:', error);
    res.status(500).json({ error: 'Failed to search KB' });
  }
});

// Get related KB items
router.get('/:id/related', [param('id').isMongoId()], async (req, res) => {
  try {
    const { id } = req.params;

    const kbItem = await KnowledgeBaseItem.findById(id);
    if (!kbItem) {
      return res.status(404).json({ error: 'KB item not found' });
    }

    // Find related items by tags and category
    const related = await KnowledgeBaseItem.find({
      _id: { $ne: id },
      status: 'published',
      $or: [
        { tags: { $in: kbItem.tags } },
        { category: kbItem.category }
      ]
    })
      .limit(5)
      .select('title category tags view_count helpful_count');

    res.json({ related });
  } catch (error) {
    console.error('Related items error:', error);
    res.status(500).json({ error: 'Failed to retrieve related items' });
  }
});

// List KB articles
router.get('/', async (req, res) => {
  try {
    const { status = 'published', category, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { status };
    if (category) filter.category = category;

    const [items, total] = await Promise.all([
      KnowledgeBaseItem.find(filter)
        .populate('author_id', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      KnowledgeBaseItem.countDocuments(filter)
    ]);

    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('KB list error:', error);
    res.status(500).json({ error: 'Failed to list KB articles' });
  }
});

module.exports = router;
