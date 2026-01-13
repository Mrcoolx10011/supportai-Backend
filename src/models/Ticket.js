const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticket_number: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    default: 'general'
  },
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  conversation_id: {
    type: String,
    default: null
  },
  customer_name: {
    type: String,
    default: null
  },
  customer_email: {
    type: String,
    default: null
  },
  tags: [{
    type: String
  }],
  due_date: {
    type: Date,
    default: null
  },
  resolved_at: {
    type: Date,
    default: null
  },
  first_response_at: {
    type: Date,
    default: null
  },
  last_activity: {
    type: Date,
    default: Date.now
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    uploaded_at: { type: Date, default: Date.now }
  }],
  ai_generated: {
    type: Boolean,
    default: false
  },
  satisfaction_rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  created_date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate unique ticket number before saving
ticketSchema.pre('save', async function(next) {
  if (!this.ticket_number) {
    try {
      let ticketNum;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      // Keep trying to generate a unique ticket number
      while (!isUnique && attempts < maxAttempts) {
        const Ticket = mongoose.model('Ticket');
        const count = await Ticket.countDocuments();
        const randomSuffix = Math.floor(Math.random() * 100); // Add randomness to prevent collisions
        ticketNum = String(count + 1 + randomSuffix).padStart(5, '0');
        const candidateTicket = `TKT-${ticketNum}`;
        
        // Check if this ticket number already exists
        const existing = await Ticket.findOne({ ticket_number: candidateTicket });
        if (!existing) {
          isUnique = true;
          this.ticket_number = candidateTicket;
          console.log('🎫 Generated unique ticket number:', this.ticket_number);
        }
        
        attempts++;
      }
      
      if (!isUnique) {
        // Fallback: use timestamp-based ticket number
        this.ticket_number = `TKT-${Date.now().toString().slice(-8)}`;
        console.warn('⚠️ Could not generate sequential ticket number, using timestamp:', this.ticket_number);
      }
    } catch (error) {
      console.error('❌ Error generating ticket number:', error.message);
      // Fallback to timestamp-based ticket number
      this.ticket_number = `TKT-${Date.now().toString().slice(-8)}`;
      console.log('⚠️ Using fallback ticket number:', this.ticket_number);
    }
  }
  return next();
});

module.exports = mongoose.model('Ticket', ticketSchema);