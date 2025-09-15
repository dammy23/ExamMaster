const { AIModel, AIAgent } = require('../models/AIConfig');

console.log('Loading AI Data Seeder...');

async function seedAIModels() {
  console.log('Seeding AI Models...');
  
  const models = [
    {
      modelId: 'gpt-4',
      name: 'GPT-4',
      description: 'Most capable model for complex reasoning and analysis',
      provider: 'openai',
      configuration: {
        maxTokens: 8192,
        temperature: 0.7,
        topP: 1
      },
      pricing: {
        inputTokenPrice: 0.03,
        outputTokenPrice: 0.06
      },
      isActive: true
    },
    {
      modelId: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient model for general purpose tasks',
      provider: 'openai',
      configuration: {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1
      },
      pricing: {
        inputTokenPrice: 0.001,
        outputTokenPrice: 0.002
      },
      isActive: true
    },
    {
      modelId: 'claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Powerful model for detailed analysis and creative tasks',
      provider: 'anthropic',
      configuration: {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1
      },
      pricing: {
        inputTokenPrice: 0.015,
        outputTokenPrice: 0.075
      },
      isActive: false
    },
    {
      modelId: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      description: 'Balanced model for various educational tasks',
      provider: 'anthropic',
      configuration: {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1
      },
      pricing: {
        inputTokenPrice: 0.003,
        outputTokenPrice: 0.015
      },
      isActive: true
    }
  ];
  
  try {
    // Remove existing models
    await AIModel.deleteMany({});
    console.log('Cleared existing AI models');
    
    // Insert new models
    const createdModels = await AIModel.insertMany(models);
    console.log(`Successfully seeded ${createdModels.length} AI models`);
    
    return createdModels;
  } catch (error) {
    console.error('Error seeding AI models:', error);
    throw error;
  }
}

async function seedAIAgents() {
  console.log('Seeding AI Agents...');
  
  const agents = [
    {
      agentId: 'exam-assistant',
      name: 'Exam Assistant',
      description: 'Specialized in creating and managing exams, questions, and assessment strategies',
      capabilities: ['Exam Creation', 'Question Generation', 'Assessment Planning', 'Grading Strategies'],
      systemPrompt: 'You are an expert exam and assessment assistant for ExamMaster. You help administrators create effective exams, manage questions, and implement best practices in educational assessment. Focus on practical, actionable advice for exam creation, question writing, and assessment strategies.',
      welcomeMessage: 'Hello! I\'m your Exam Assistant. I can help you create exams, write questions, and optimize your assessment strategies. How can I assist you today?',
      category: 'exam-management',
      priority: 10,
      isActive: true
    },
    {
      agentId: 'student-support',
      name: 'Student Support Agent',
      description: 'Helps with student management, performance analysis, and learning recommendations',
      capabilities: ['Student Analytics', 'Performance Tracking', 'Learning Recommendations', 'Study Plans'],
      systemPrompt: 'You are a student support specialist for ExamMaster. You help administrators understand student performance, identify learning gaps, and provide recommendations for student success. Focus on data-driven insights and actionable support strategies.',
      welcomeMessage: 'Hi! I\'m here to help you support your students. I can analyze performance data, suggest interventions, and help you track student progress. What would you like to explore?',
      category: 'student-support',
      priority: 9,
      isActive: true
    },
    {
      agentId: 'content-creator',
      name: 'Content Creator',
      description: 'Assists in creating educational content, questions, and study materials',
      capabilities: ['Content Generation', 'Question Writing', 'Study Material Creation', 'Curriculum Planning'],
      systemPrompt: 'You are an educational content creation expert for ExamMaster. You help create high-quality questions, develop study materials, and plan curriculum content. Focus on pedagogically sound content that aligns with learning objectives and best practices in education.',
      welcomeMessage: 'Welcome! I\'m your Content Creator assistant. I can help you write questions, create study materials, and develop educational content. What type of content are you working on?',
      category: 'content-creation',
      priority: 8,
      isActive: true
    },
    {
      agentId: 'data-analyst',
      name: 'Data Analyst',
      description: 'Analyzes exam data, generates reports, and provides insights',
      capabilities: ['Data Analysis', 'Report Generation', 'Trend Identification', 'Performance Insights'],
      systemPrompt: 'You are a data analysis expert for ExamMaster. You help interpret exam results, identify patterns in student performance, and generate actionable insights from educational data. Focus on statistical analysis, trend identification, and practical recommendations based on data.',
      welcomeMessage: 'Hello! I\'m your Data Analyst. I can help you understand your exam data, identify trends, and generate insights for decision-making. What data would you like to analyze?',
      category: 'data-analysis',
      priority: 7,
      isActive: false
    }
  ];
  
  try {
    // Remove existing agents
    await AIAgent.deleteMany({});
    console.log('Cleared existing AI agents');
    
    // Insert new agents
    const createdAgents = await AIAgent.insertMany(agents);
    console.log(`Successfully seeded ${createdAgents.length} AI agents`);
    
    return createdAgents;
  } catch (error) {
    console.error('Error seeding AI agents:', error);
    throw error;
  }
}

async function seedAIData() {
  console.log('Starting AI data seeding process...');
  
  try {
    const [models, agents] = await Promise.all([
      seedAIModels(),
      seedAIAgents()
    ]);
    
    console.log('AI data seeding completed successfully:');
    console.log(`- ${models.length} AI models seeded`);
    console.log(`- ${agents.length} AI agents seeded`);
    
    return {
      models,
      agents,
      success: true
    };
  } catch (error) {
    console.error('AI data seeding failed:', error);
    throw error;
  }
}

module.exports = {
  seedAIData,
  seedAIModels,
  seedAIAgents
};