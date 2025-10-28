const mongoose = require('mongoose');
const CannedResponse = require('../src/models/CannedResponse');
const User = require('../src/models/User');
require('dotenv').config();

const sampleCannedResponses = [
  {
    title: "Welcome Message",
    shortcut: "/welcome",
    content: "Hello! Welcome to our support team. I'm here to help you with any questions or issues you may have. How can I assist you today?",
    category: "Greetings",
    tags: ["welcome", "greeting", "intro"]
  },
  {
    title: "Thank You for Contact",
    shortcut: "/thanks",
    content: "Thank you for contacting us! We appreciate you reaching out and we'll do our best to help resolve your issue quickly.",
    category: "Greetings",
    tags: ["thanks", "appreciation"]
  },
  {
    title: "Account Information Request",
    shortcut: "/account",
    content: "I'd be happy to help you with your account. For security purposes, could you please provide me with:\n\n• Your registered email address\n• The last 4 digits of your phone number\n• Your account username\n\nThis will help me locate your account safely.",
    category: "Security",
    tags: ["account", "verification", "security"]
  },
  {
    title: "Password Reset Instructions",
    shortcut: "/password",
    content: "To reset your password, please follow these steps:\n\n1. Go to our login page\n2. Click on 'Forgot Password?'\n3. Enter your registered email address\n4. Check your email for reset instructions\n5. Follow the link and create a new password\n\nIf you don't receive the email within 5 minutes, please check your spam folder.",
    category: "Technical",
    tags: ["password", "reset", "login", "technical"]
  },
  {
    title: "Billing Inquiry",
    shortcut: "/billing",
    content: "I understand you have questions about your billing. I'd be happy to review your account and help clarify any charges. Could you please tell me:\n\n• What specific charge you're asking about?\n• The approximate date of the transaction?\n• Any reference number you might have?\n\nThis will help me provide you with accurate information.",
    category: "Billing",
    tags: ["billing", "payment", "charges", "invoice"]
  },
  {
    title: "Technical Issue Troubleshooting",
    shortcut: "/tech",
    content: "I'm sorry to hear you're experiencing technical difficulties. To help troubleshoot this issue, could you please provide:\n\n• A detailed description of the problem\n• What device/browser you're using\n• When the issue first occurred\n• Any error messages you've seen\n• Steps you've already tried\n\nThis information will help me assist you more effectively.",
    category: "Technical",
    tags: ["technical", "troubleshooting", "bug", "issue"]
  },
  {
    title: "Order Status Inquiry",
    shortcut: "/order",
    content: "I'd be happy to check on your order status for you. Could you please provide:\n\n• Your order number (usually starts with #)\n• The email address used for the order\n• Approximate order date\n\nOnce I have this information, I can give you a detailed update on your order.",
    category: "Orders",
    tags: ["order", "status", "shipping", "delivery"]
  },
  {
    title: "Refund Request",
    shortcut: "/refund",
    content: "I understand you'd like to request a refund. I'll be happy to help you with this process. To get started, I'll need:\n\n• Your order number\n• Reason for the refund request\n• Whether you'd prefer store credit or original payment method\n\nPlease note that refunds typically take 3-5 business days to process once approved.",
    category: "Billing",
    tags: ["refund", "return", "money-back", "billing"]
  },
  {
    title: "Escalation to Specialist",
    shortcut: "/escalate",
    content: "I understand this issue requires specialized attention. I'm going to transfer you to one of our technical specialists who will be better equipped to help you with this specific matter.\n\nPlease hold for just a moment while I connect you. Thank you for your patience!",
    category: "Escalation",
    tags: ["escalate", "transfer", "specialist", "advanced"]
  },
  {
    title: "Closing Message",
    shortcut: "/close",
    content: "Is there anything else I can help you with today? If your issue has been resolved, you can close this chat. \n\nWe'd love to hear about your experience! Please take a moment to rate our service when the chat ends.\n\nThank you for choosing our support team!",
    category: "Closing",
    tags: ["closing", "goodbye", "feedback", "rating"]
  },
  {
    title: "Business Hours",
    shortcut: "/hours",
    content: "Our customer support team is available:\n\n📞 Phone Support: Monday - Friday, 9 AM - 6 PM EST\n💬 Live Chat: 24/7\n📧 Email Support: We respond within 24 hours\n\nFor urgent issues outside business hours, please use our live chat or email support.",
    category: "Information",
    tags: ["hours", "availability", "contact", "schedule"]
  },
  {
    title: "Feature Request",
    shortcut: "/feature",
    content: "Thank you for your feature suggestion! We really appreciate customer feedback as it helps us improve our product.\n\nI'll make sure to forward your request to our product development team. While I can't guarantee if or when this feature will be implemented, all suggestions are carefully considered.\n\nIs there anything else I can help you with in the meantime?",
    category: "Feedback",
    tags: ["feature", "suggestion", "feedback", "development"]
  },
  {
    title: "System Maintenance",
    shortcut: "/maintenance",
    content: "We're currently performing scheduled system maintenance to improve our services. This may cause:\n\n• Temporary service interruptions\n• Slower response times\n• Limited access to certain features\n\nWe expect to complete maintenance by [TIME]. We apologize for any inconvenience and appreciate your patience.",
    category: "Information",
    tags: ["maintenance", "downtime", "system", "scheduled"]
  },
  {
    title: "Privacy and Data",
    shortcut: "/privacy",
    content: "We take your privacy and data security very seriously. Here's what you should know:\n\n• We never share your personal information with third parties\n• All data is encrypted and stored securely\n• You can request data deletion at any time\n• Our privacy policy is available on our website\n\nIf you have specific privacy concerns, I'd be happy to address them or connect you with our privacy team.",
    category: "Security",
    tags: ["privacy", "data", "security", "gdpr"]
  },
  {
    title: "Product Demo Request",
    shortcut: "/demo",
    content: "I'd be happy to arrange a product demonstration for you! Our demos are a great way to see our features in action.\n\nTo schedule your personalized demo:\n• Let me know your preferred date and time\n• Tell me which features you're most interested in\n• Provide your contact information\n\nOur demo sessions typically last 30-45 minutes and can be customized to your specific needs.",
    category: "Sales",
    tags: ["demo", "demonstration", "sales", "features"]
  }
];

async function createSampleCannedResponses() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/supportai';
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find or create a demo user
    let demoUser = await User.findOne({ email: 'demo@supportai.com' });
    if (!demoUser) {
      console.log('Creating demo user...');
      demoUser = await User.create({
        name: 'Demo User',
        email: 'demo@supportai.com',
        password: 'demo123', // This will be hashed by the model
        role: 'admin'
      });
    }

    // Clear existing canned responses (optional - comment out if you want to keep existing ones)
    console.log('Clearing existing canned responses...');
    await CannedResponse.deleteMany({});

    // Create sample canned responses
    console.log('Creating sample canned responses...');
    for (const responseData of sampleCannedResponses) {
      await CannedResponse.create({
        ...responseData,
        author_id: demoUser._id,
        usage_count: Math.floor(Math.random() * 50), // Random usage count for demo
        last_used: Math.random() > 0.5 ? new Date() : null
      });
    }

    console.log(`✅ Successfully created ${sampleCannedResponses.length} sample canned responses!`);
    
    // Display summary
    const categories = [...new Set(sampleCannedResponses.map(r => r.category))];
    console.log('\n📊 Categories created:');
    categories.forEach(category => {
      const count = sampleCannedResponses.filter(r => r.category === category).length;
      console.log(`  • ${category}: ${count} responses`);
    });

    console.log('\n🔧 Shortcuts created:');
    sampleCannedResponses.forEach(r => {
      if (r.shortcut) {
        console.log(`  • ${r.shortcut} - ${r.title}`);
      }
    });

  } catch (error) {
    console.error('❌ Error creating sample canned responses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createSampleCannedResponses();
}

module.exports = { sampleCannedResponses, createSampleCannedResponses };