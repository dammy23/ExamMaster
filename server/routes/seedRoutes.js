const express = require('express');
const SeedService = require('../services/seedService.js');
const AIPlatform = require('../models/AIPlatform');
const { AIAgent } = require('../models/AIConfig');

const router = express.Router();

// Create initial admin user - NO AUTH REQUIRED
router.post('/admin', async (req, res) => {
  try {
    console.log('=== SEEDING ADMIN USER REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    const result = await SeedService.createAdminUser();

    console.log('Admin user seeded successfully:', result);
    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user
    });
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
    console.error('Error stack:', error.stack);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create sample student users - NO AUTH REQUIRED
router.post('/students', async (req, res) => {
  try {
    console.log('=== SEEDING STUDENT USERS REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    const result = await SeedService.createSampleStudents();

    console.log('Student users seeded successfully:', result);
    return res.status(201).json({
      success: true,
      message: result.message,
      users: result.users
    });
  } catch (error) {
    console.error('Error seeding student users:', error.message);
    console.error('Error stack:', error.stack);

    if (error.message.includes('already exist')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize AI platforms and agents - NO AUTH REQUIRED
router.post('/ai-data', async (req, res) => {
  try {
    console.log('=== SEEDING AI PLATFORMS AND AGENTS REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    // Initialize AI platforms
    console.log('Creating default AI platforms...');
    await AIPlatform.createDefaults();

    // Create default AI agents
    console.log('Creating default AI agents...');
    await createDefaultAIAgents();

    console.log('AI data seeded successfully');
    return res.status(201).json({
      success: true,
      message: 'AI platforms and agents initialized successfully'
    });
  } catch (error) {
    console.error('Error seeding AI data:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to create default AI agents
async function createDefaultAIAgents() {
  const defaultAgents = [
    {
      agentId: 'exam-assistant',
      name: 'Exam Assistant',
      description: 'Specialized in exam creation, management, and configuration',
      capabilities: [
        'Exam Creation',
        'Question Management',
        'Grading Configuration',
        'Student Assignment',
        'Security Settings'
      ],
      systemPrompt: `You are an Exam Assistant specializing in Computer-Based Examination systems. You help administrators create, manage, and configure exams effectively. You have deep knowledge of:

- Exam creation workflows and best practices
- Question bank management and question types (MCQ, True/False, Short Answer)
- Grading schemes and automated marking
- Student assignment and group management
- Exam security and proctoring features
- Performance analytics and reporting

Provide clear, step-by-step guidance and practical advice for exam administrators.`,
      welcomeMessage: "Hello! I'm your Exam Assistant. I can help you create exams, manage questions, configure grading, and set up everything you need for successful computer-based examinations. What would you like to work on today?",
      category: 'exam-management',
      priority: 10
    },
    {
      agentId: 'student-support',
      name: 'Student Support Agent',
      description: 'Focused on student performance analysis and academic support',
      capabilities: [
        'Performance Analytics',
        'Progress Tracking',
        'Learning Insights',
        'Student Management',
        'Academic Support'
      ],
      systemPrompt: `You are a Student Support Agent specializing in educational analytics and student success. You help administrators understand and improve student performance through:

- Individual and group performance analysis
- Learning outcome assessment
- Progress tracking and trend identification
- At-risk student identification
- Remediation recommendations
- Comparative analytics and benchmarking

Focus on actionable insights that help improve educational outcomes.`,
      welcomeMessage: "Hi! I'm here to help you understand and support student performance. I can analyze learning data, identify trends, and suggest ways to help students succeed. What student support task can I assist with?",
      category: 'student-support',
      priority: 9
    },
    {
      agentId: 'content-creator',
      name: 'Content Creator',
      description: 'Assists with educational content creation and curriculum development',
      capabilities: [
        'Question Generation',
        'Content Development',
        'Curriculum Planning',
        'Assessment Design',
        'Educational Resources'
      ],
      systemPrompt: `You are a Content Creator specializing in educational material development. You help create high-quality educational content including:

- Exam questions across various subjects and difficulty levels
- Learning objectives and curriculum mapping
- Assessment rubrics and marking schemes
- Study materials and educational resources
- Content alignment with educational standards

Focus on pedagogically sound, engaging, and effective educational content.`,
      welcomeMessage: "Hello! I'm your Content Creator assistant. I can help you develop exam questions, create educational materials, design assessments, and plan curriculum content. What type of content would you like to create?",
      category: 'content-creation',
      priority: 8
    },
    {
      agentId: 'data-analyst',
      name: 'Data Analyst',
      description: 'Specializes in educational data analysis and reporting',
      capabilities: [
        'Statistical Analysis',
        'Report Generation',
        'Data Visualization',
        'Trend Analysis',
        'Predictive Analytics'
      ],
      systemPrompt: `You are a Data Analyst specializing in educational analytics. You help interpret examination and learning data through:

- Statistical analysis of exam results and student performance
- Trend identification and pattern recognition
- Predictive modeling for student success
- Custom report generation and data visualization
- Comparative analysis across different cohorts and time periods
- Quality assurance for assessment data

Provide data-driven insights that support educational decision-making.`,
      welcomeMessage: "Hi there! I'm your Data Analyst. I can help you analyze exam results, generate reports, identify trends, and extract meaningful insights from your educational data. What analysis would you like me to help with?",
      category: 'data-analysis',
      priority: 7
    }
  ];

  for (const agentData of defaultAgents) {
    try {
      const existing = await AIAgent.findOne({ agentId: agentData.agentId });
      if (!existing) {
        const agent = new AIAgent(agentData);
        await agent.save();
        console.log(`Created default AI agent: ${agentData.agentId}`);
      } else {
        console.log(`AI agent already exists: ${agentData.agentId}`);
      }
    } catch (error) {
      console.error(`Error creating default agent ${agentData.agentId}:`, error);
    }
  }

  console.log('Default AI agents creation completed');
}

module.exports = router;