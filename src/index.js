const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { router: authRoutes } = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const entityRoutes = require('./routes/entities');
const integrationRoutes = require('./routes/integrations');
const widgetRoutes = require('./routes/widget');
const kbRoutes = require('./routes/knowledgebase');
const chatRoutes = require('./routes/chat');
const collaborationRoutes = require('./routes/collaboration');
const leaderboardRoutes = require('./routes/leaderboard');
const kbAutoUpdateRoutes = require('./routes/kb-auto-update');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS Configuration - Updated for production
const corsOptions = {
  origin: [
    'https://supportai-frontend.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// More lenient rate limiting for entities endpoint (for polling)
const entitiesLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for entities
  message: { error: 'Too many requests to entities endpoint, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/entities', entitiesLimiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/supportai';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/kb-auto-update', kbAutoUpdateRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'SupportAI MCP Server is running!',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/auth',
      '/api/ai',
      '/api/entities',
      '/api/integrations',
      '/api/widget',
      '/api/kb',
      '/api/chat',
      '/api/collaboration',
      '/api/leaderboard',
      '/api/kb-auto-update'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`SupportAI MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Base: http://localhost:${PORT}/api`);
});

module.exports = app;