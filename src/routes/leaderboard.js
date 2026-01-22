const express = require('express');
const router = express.Router();
const { param, validationResult, query } = require('express-validator');
const TeamPerformance = require('../models/TeamPerformance');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const ChatSession = require('../models/ChatSession');
const KnowledgeBaseItem = require('../models/KnowledgeBaseItem');
const TicketNote = require('../models/TicketNote');

// Calculate and update team member performance metrics
async function calculatePerformanceMetrics(userId, period = 'weekly') {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    // Determine date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all_time':
        startDate = new Date('2020-01-01');
        break;
    }

    // Fetch metrics
    const [
      ticketsResolved,
      ticketsAssigned,
      ticketsInProgress,
      chatSessions,
      kbArticles,
      internalNotes,
      mentions
    ] = await Promise.all([
      Ticket.countDocuments({
        assigned_to: userId,
        status: 'resolved',
        resolved_at: { $gte: startDate }
      }),
      Ticket.countDocuments({
        assigned_to: userId,
        created_at: { $gte: startDate }
      }),
      Ticket.countDocuments({
        assigned_to: userId,
        status: 'in_progress'
      }),
      ChatSession.find({
        agent_id: userId,
        created_at: { $gte: startDate }
      }),
      KnowledgeBaseItem.countDocuments({
        author_id: userId,
        created_at: { $gte: startDate }
      }),
      TicketNote.countDocuments({
        author_id: userId,
        created_at: { $gte: startDate }
      }),
      TicketNote.countDocuments({
        'mentions.user_id': userId,
        created_at: { $gte: startDate }
      })
    ]);

    // Calculate averages
    const resolvedTickets = await Ticket.find({
      assigned_to: userId,
      status: 'resolved',
      resolved_at: { $gte: startDate }
    });

    let averageResolutionTime = 0;
    let firstResponseTime = 0;

    if (resolvedTickets.length > 0) {
      const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
        const resolution = (ticket.resolved_at - ticket.createdAt) / (1000 * 60 * 60);
        return sum + resolution;
      }, 0);
      averageResolutionTime = totalResolutionTime / resolvedTickets.length;

      const responseTimeSum = resolvedTickets.reduce((sum, ticket) => {
        if (ticket.first_response_at) {
          const time = (ticket.first_response_at - ticket.createdAt) / (1000 * 60);
          return sum + time;
        }
        return sum;
      }, 0);
      firstResponseTime = responseTimeSum / resolvedTickets.length;
    }

    // Calculate AI response acceptance rate
    let aiAcceptanceRate = 0;
    const totalMessages = chatSessions.reduce((sum, session) => sum + session.total_messages, 0);
    if (totalMessages > 0) {
      const acceptedSuggestions = chatSessions.reduce((sum, session) => {
        return sum + (session.suggested_responses || []).length;
      }, 0);
      aiAcceptanceRate = (acceptedSuggestions / totalMessages) * 100;
    }

    // Calculate average satisfaction score
    let satisfactionScore = 0;
    if (resolvedTickets.length > 0) {
      // This would normally come from customer surveys
      // For now, use a derived metric
      satisfactionScore = Math.min(5, (averageResolutionTime > 0 ? 24 / averageResolutionTime : 0) * 5);
    }

    // Calculate composite score
    const score = (
      (ticketsResolved * 10) +
      (firstResponseTime > 0 ? (60 / firstResponseTime) * 5 : 0) +
      (satisfactionScore * 15) +
      (aiAcceptanceRate / 10) +
      (kbArticles * 5) +
      (internalNotes * 2) +
      (mentions * 1)
    );

    return {
      team_member_id: userId,
      period,
      tickets_resolved: ticketsResolved,
      tickets_assigned: ticketsAssigned,
      tickets_in_progress: ticketsInProgress,
      average_resolution_time: Math.round(averageResolutionTime * 10) / 10,
      first_response_time: Math.round(firstResponseTime * 10) / 10,
      customer_satisfaction_score: Math.round(satisfactionScore * 10) / 10,
      total_messages_sent: totalMessages,
      ai_response_acceptance_rate: Math.round(aiAcceptanceRate * 10) / 10,
      kb_articles_created: kbArticles,
      internal_notes_created: internalNotes,
      team_mentions_received: mentions,
      score: Math.round(score * 100) / 100,
      last_updated: new Date()
    };
  } catch (error) {
    console.error('Performance calculation error:', error);
    return null;
  }
}

// Get team leaderboard
router.get('/', [
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'all_time']),
  query('metric').optional().isIn([
    'score', 'tickets_resolved', 'satisfaction_score',
    'response_time', 'ai_acceptance', 'kb_contribution'
  ]),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('team_id').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      period = 'weekly',
      metric = 'score',
      limit = 20,
      team_id = null
    } = req.query;

    const filter = { period };
    if (team_id) filter.team_id = team_id;

    // Determine sort field
    let sortField = 'score';
    switch (metric) {
      case 'tickets_resolved':
        sortField = 'tickets_resolved';
        break;
      case 'satisfaction_score':
        sortField = 'customer_satisfaction_score';
        break;
      case 'response_time':
        sortField = 'first_response_time';
        break;
      case 'ai_acceptance':
        sortField = 'ai_response_acceptance_rate';
        break;
      case 'kb_contribution':
        sortField = 'kb_articles_created';
        break;
    }

    const leaderboard = await TeamPerformance.find(filter)
      .populate('team_member_id', 'name email avatar username')
      .sort({ [sortField]: metric === 'response_time' ? 1 : -1 })
      .limit(parseInt(limit));

    // Add rank
    const ranked = leaderboard.map((entry, index) => ({
      ...entry.toObject(),
      rank: index + 1
    }));

    res.json({
      period,
      metric,
      leaderboard: ranked,
      count: ranked.length
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get individual performance metrics
router.get('/member/:userId', [
  param('userId').isMongoId(),
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'all_time'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { period = 'weekly' } = req.query;

    // Recalculate metrics
    const metrics = await calculatePerformanceMetrics(userId, period);

    if (!metrics) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Save to database
    const saved = await TeamPerformance.findOneAndUpdate(
      { team_member_id: userId, period },
      metrics,
      { upsert: true, new: true }
    ).populate('team_member_id', 'name email avatar username');

    res.json({
      period,
      performance: saved
    });
  } catch (error) {
    console.error('Performance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Bulk update team performance
router.post('/update-all', async (req, res) => {
  try {
    const { period = 'weekly' } = req.body;

    const users = await User.find({ is_active: true });
    const results = [];

    for (const user of users) {
      const metrics = await calculatePerformanceMetrics(user._id, period);
      if (metrics) {
        const saved = await TeamPerformance.findOneAndUpdate(
          { team_member_id: user._id, period },
          metrics,
          { upsert: true, new: true }
        );
        results.push(saved);
      }
    }

    res.json({
      success: true,
      updated: results.length,
      period
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to update performance metrics' });
  }
});

// Get performance comparison
router.get('/compare/:userId/:compareUserId', [
  param('userId').isMongoId(),
  param('compareUserId').isMongoId(),
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'all_time'])
], async (req, res) => {
  try {
    const { userId, compareUserId } = req.params;
    const { period = 'weekly' } = req.query;

    const [user1Performance, user2Performance] = await Promise.all([
      TeamPerformance.findOne({ team_member_id: userId, period })
        .populate('team_member_id', 'name email avatar'),
      TeamPerformance.findOne({ team_member_id: compareUserId, period })
        .populate('team_member_id', 'name email avatar')
    ]);

    if (!user1Performance || !user2Performance) {
      return res.status(404).json({ error: 'Performance data not found' });
    }

    // Calculate differences
    const comparison = {
      user1: user1Performance,
      user2: user2Performance,
      differences: {
        score_diff: user1Performance.score - user2Performance.score,
        resolution_time_diff: user1Performance.average_resolution_time - user2Performance.average_resolution_time,
        satisfaction_diff: user1Performance.customer_satisfaction_score - user2Performance.customer_satisfaction_score,
        tickets_diff: user1Performance.tickets_resolved - user2Performance.tickets_resolved
      }
    };

    res.json(comparison);
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Failed to compare performance' });
  }
});

// Award achievement
router.post('/achievements/:userId/award', [
  param('userId').isMongoId()
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, description, badge } = req.body;

    const periods = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];
    const results = [];

    for (const period of periods) {
      const performance = await TeamPerformance.findOneAndUpdate(
        { team_member_id: userId, period },
        {
          $push: {
            achievements: {
              title,
              description,
              badge,
              earned_at: new Date()
            }
          }
        },
        { new: true }
      );

      if (performance) results.push(performance);
    }

    res.json({
      success: true,
      updated_periods: results.length,
      achievement: { title, description, badge }
    });
  } catch (error) {
    console.error('Achievement award error:', error);
    res.status(500).json({ error: 'Failed to award achievement' });
  }
});

module.exports = router;
