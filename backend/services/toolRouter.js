// ══════════════════════════════════════════
// Sakura AI — Tool Router Service
// Routes each tool request to the correct
// AI provider (OpenAI, Stability, ElevenLabs)
// ══════════════════════════════════════════

const OpenAI  = require('openai');
const axios   = require('axios');
const FormData = require('form-data');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ══════════════════════════════════════════
// TEXT & WRITING TOOLS
// ══════════════════════════════════════════

async function runTextTool(toolName, params) {
  const systemPrompts = {
    'article-writer': `You are an expert content writer. Write comprehensive, SEO-optimized articles that are engaging, well-structured with proper headings (H2, H3), and provide real value. Always include an introduction, body sections, and conclusion.`,
    'email-writer': `You are a professional email writer. Write clear, concise, and professional emails with proper greeting, body, and sign-off. Match the requested tone exactly.`,
    'social-media-posts': `You are a social media expert. Create engaging, platform-optimized posts with relevant hashtags, emojis where appropriate, and compelling calls-to-action.`,
    'text-summarizer': `You are an expert at summarizing content. Create clear, concise summaries that capture all key points without losing important information. Use bullet points for clarity.`,
    'text-rewriter': `You are an expert editor and rewriter. Improve the given text while preserving its meaning. Enhance clarity, flow, and engagement. Fix grammar and style issues.`,
    'marketing-copy': `You are a world-class copywriter. Write persuasive, conversion-focused marketing copy that speaks directly to the target audience's pain points and desires.`,
    'product-description': `You are an e-commerce copywriting expert. Write compelling product descriptions that highlight benefits, features, and create desire. Optimize for both humans and search engines.`,
    'ad-copy': `You are a performance marketing expert. Write high-converting ad copy for the specified platform. Focus on the hook, benefit, and clear call-to-action.`,
    'customer-support': `You are a professional customer support specialist. Write empathetic, helpful, and solution-focused responses that resolve issues and maintain customer satisfaction.`,
  };

  const userPrompt = buildTextPrompt(toolName, params);
  const systemPrompt = systemPrompts[toolName] || `You are a helpful AI assistant specialized in ${toolName.replace(/-/g, ' ')}.`;

  const response = await openai.chat.completions.create({
    model:       process.env.OPENAI_MODEL_TEXT || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    max_tokens:   2000,
    temperature:  0.7,
  });

  const output     = response.choices[0].message.content;
  const tokensUsed = response.usage.total_tokens;

  return { output, tokensUsed, outputType: 'text' };
}

// ══════════════════════════════════════════
// CODE TOOLS
// ══════════════════════════════════════════

async function runCodeTool(toolName, params) {
  const systemPrompts = {
    'code-generator': `You are an expert software engineer. Generate clean, well-commented, production-ready code. Always include: 1) The complete code, 2) Brief explanation of how it works, 3) Usage example. Format code in proper markdown code blocks.`,
    'bug-fixer': `You are an expert debugger. Analyze the provided code, identify ALL bugs and issues, explain what each bug is and why it's a problem, then provide the complete fixed version. Be thorough.`,
    'code-explainer': `You are a programming teacher. Explain code in clear, simple language that a beginner can understand. Break down each section, explain the logic, and highlight important concepts.`,
    'documentation-writer': `You are a technical documentation expert. Generate comprehensive, clear documentation including: function descriptions, parameters, return values, examples, and edge cases. Use proper documentation format.`,
    'automation-scripts': `You are a DevOps and automation expert. Generate robust, well-commented automation scripts. Include error handling, logging, and clear instructions for setup and usage.`,
  };

  const userPrompt = buildCodePrompt(toolName, params);
  const systemPrompt = systemPrompts[toolName] || `You are an expert programmer specializing in ${toolName.replace(/-/g, ' ')}.`;

  const response = await openai.chat.completions.create({
    model:       process.env.OPENAI_MODEL_CODE || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    max_tokens:   3000,
    temperature:  0.2, // Lower temp for code accuracy
  });

  const output     = response.choices[0].message.content;
  const tokensUsed = response.usage.total_tokens;

  return { output, tokensUsed, outputType: 'code' };
}

// ══════════════════════════════════════════
// BUSINESS & STUDY TOOLS
// ══════════════════════════════════════════

async function runBusinessTool(toolName, params) {
  const systemPrompts = {
    'business-plan': `You are a seasoned business consultant and MBA. Create comprehensive, realistic business plans with executive summary, market analysis, competitive landscape, financial projections, and actionable strategies.`,
    'cv-resume': `You are a professional career coach and resume expert. Create ATS-optimized, compelling CVs that highlight achievements with quantifiable results. Use strong action verbs and industry keywords.`,
    'presentation-builder': `You are a presentation design expert. Create clear, compelling presentation outlines with logical flow, engaging slide titles, and concise bullet points. Each slide should have a clear purpose.`,
    'sop-workflow': `You are a business process expert. Create detailed, clear Standard Operating Procedures with step-by-step instructions, decision points, roles and responsibilities, and quality checkpoints.`,
    'formal-email': `You are a business communication expert. Write formal, professional emails that are clear, respectful, and achieve their intended purpose. Follow proper business email etiquette.`,
  };

  const systemPrompt = systemPrompts[toolName] || `You are an expert business consultant specializing in ${toolName.replace(/-/g, ' ')}.`;
  const userPrompt   = buildBusinessPrompt(toolName, params);

  const response = await openai.chat.completions.create({
    model:       process.env.OPENAI_MODEL_TEXT || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    max_tokens:   3000,
    temperature:  0.6,
  });

  const output     = response.choices[0].message.content;
  const tokensUsed = response.usage.total_tokens;

  return { output, tokensUsed, outputType: 'text' };
}

async function runStudyTool(toolName, params) {
  const systemPrompts = {
    'lesson-simplifier': `You are an expert educator. Simplify complex topics using analogies, real-world examples, and step-by-step explanations. Make learning accessible and engaging for the specified level.`,
    'qa-generator': `You are an expert educator and assessment designer. Generate diverse, high-quality practice questions (multiple choice, short answer, essay) with detailed answer explanations.`,
    'study-plan': `You are an academic coach. Create detailed, realistic study plans with daily schedules, milestones, review sessions, and practice tests. Adapt to the student's available time and current level.`,
    'step-by-step-solver': `You are a patient tutor. Solve problems step-by-step with clear explanations at each step. Show all work, explain the reasoning, and highlight key concepts and formulas used.`,
  };

  const systemPrompt = systemPrompts[toolName] || `You are an expert educator specializing in ${toolName.replace(/-/g, ' ')}.`;
  const userPrompt   = buildStudyPrompt(toolName, params);

  const response = await openai.chat.completions.create({
    model:       process.env.OPENAI_MODEL_TEXT || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    max_tokens:   2500,
    temperature:  0.5,
  });

  const output     = response.choices[0].message.content;
  const tokensUsed = response.usage.total_tokens;

  return { output, tokensUsed, outputType: 'text' };
}

// ══════════════════════════════════════════
// IMAGE TOOLS — Stability AI
// ══════════════════════════════════════════

async function runImageTool(toolName, params) {
  const { prompt, negativePrompt = '', width = 1024, height = 1024, style = 'photographic' } = params;

  if (!prompt) throw new Error('Image prompt is required');

  const engineId = 'stable-diffusion-xl-1024-v1-0';
  const apiHost  = process.env.STABILITY_API_HOST || 'https://api.stability.ai';
  const apiKey   = process.env.STABILITY_API_KEY;

  if (!apiKey) throw new Error('Stability AI API key not configured');

  const enhancedPrompt = enhanceImagePrompt(toolName, prompt, style);

  const response = await axios.post(
    `${apiHost}/v1/generation/${engineId}/text-to-image`,
    {
      text_prompts: [
        { text: enhancedPrompt, weight: 1 },
        { text: negativePrompt || 'blurry, low quality, distorted, ugly, bad anatomy', weight: -1 },
      ],
      cfg_scale:   7,
      height:      Math.min(height, 1024),
      width:       Math.min(width, 1024),
      samples:     1,
      steps:       30,
      style_preset: style,
    },
    {
      headers: {
        'Content-Type':  'application/json',
        Accept:          'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
    }
  );

  const imageBase64 = response.data.artifacts[0].base64;
  const imageUrl    = `data:image/png;base64,${imageBase64}`;

  return { output: imageUrl, tokensUsed: 0, creditsUsed: 1, outputType: 'image' };
}

// ══════════════════════════════════════════
// AUDIO TOOLS — ElevenLabs
// ══════════════════════════════════════════

async function runTTSTool(params) {
  const { text, voiceId, language = 'en', stability = 0.5, similarityBoost = 0.75 } = params;

  if (!text) throw new Error('Text is required for TTS');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ElevenLabs API key not configured');

  const selectedVoiceId = voiceId ||
    (language === 'ar'
      ? process.env.ELEVENLABS_VOICE_ID_AR
      : process.env.ELEVENLABS_VOICE_ID_EN) ||
    '21m00Tcm4TlvDq8ikWAM';

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability, similarity_boost: similarityBoost },
    },
    {
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
        Accept:         'audio/mpeg',
      },
      responseType: 'arraybuffer',
    }
  );

  const audioBase64 = Buffer.from(response.data).toString('base64');
  const audioUrl    = `data:audio/mpeg;base64,${audioBase64}`;

  return { output: audioUrl, tokensUsed: 0, creditsUsed: 1, outputType: 'audio' };
}

async function runSTTTool(audioBuffer, mimeType = 'audio/mp3') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const { Readable } = require('stream');
  const stream = Readable.from(audioBuffer);
  stream.path = 'audio.mp3';

  const transcription = await openai.audio.transcriptions.create({
    file:  stream,
    model: 'whisper-1',
  });

  return { output: transcription.text, tokensUsed: 0, creditsUsed: 1, outputType: 'text' };
}

// ══════════════════════════════════════════
// DATA TOOLS
// ══════════════════════════════════════════

async function runDataTool(toolName, params) {
  const { data, question, format = 'detailed' } = params;

  const systemPrompt = `You are a data analyst and business intelligence expert. Analyze the provided data thoroughly and provide:
1. Key insights and patterns
2. Statistical summaries where relevant
3. Actionable recommendations
4. Clear visualizable findings
Format your response in a clear, structured way with sections and bullet points.`;

  const userPrompt = `Analyze the following data and ${question || 'provide comprehensive insights'}:\n\n${data}\n\nFormat: ${format}`;

  const response = await openai.chat.completions.create({
    model:       process.env.OPENAI_MODEL_TEXT || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    max_tokens:   2500,
    temperature:  0.3,
  });

  const output     = response.choices[0].message.content;
  const tokensUsed = response.usage.total_tokens;

  return { output, tokensUsed, outputType: 'text' };
}

// ══════════════════════════════════════════
// PROMPT BUILDERS
// ══════════════════════════════════════════

function buildTextPrompt(toolName, params) {
  const { topic, audience, tone = 'professional', length, platform, subject, keyPoints, text, product, features, targetCustomer, cta } = params;

  const prompts = {
    'article-writer':    `Write a comprehensive, SEO-optimized article about: "${topic}"\nTarget audience: ${audience || 'general readers'}\nTone: ${tone}\nLength: approximately ${length || 800} words\nInclude: introduction, 3-5 main sections with H2 headings, conclusion, and key takeaways.`,
    'email-writer':      `Write a professional email to: ${audience || 'recipient'}\nSubject: ${subject || topic}\nTone: ${tone}\nKey points to cover: ${keyPoints || topic}\nInclude proper greeting and sign-off.`,
    'social-media-posts':`Create 3 engaging ${platform || 'social media'} posts about: "${topic}"\nTone: ${tone}\nGoal: ${params.goal || 'engagement'}\nInclude relevant hashtags and emojis.`,
    'text-summarizer':   `Summarize the following text concisely, capturing all key points:\n\n${text || topic}`,
    'text-rewriter':     `Rewrite and improve the following text. Make it clearer, more engaging, and better structured:\n\n${text || topic}`,
    'marketing-copy':    `Write high-converting marketing copy for: ${product || topic}\nTarget audience: ${audience || targetCustomer}\nMain benefit: ${params.mainBenefit || features}\nCall to action: ${cta || 'Learn More'}\nTone: ${tone}`,
    'product-description': `Write a compelling product description for: ${product || topic}\nKey features: ${features || params.keyFeatures}\nTarget customer: ${targetCustomer || audience}\nTone: ${tone}`,
    'ad-copy':           `Write high-converting ad copy for ${platform || 'Facebook/Instagram'}\nProduct/Service: ${product || topic}\nTarget audience: ${audience}\nMain benefit: ${params.mainBenefit}\nCall to action: ${cta}`,
    'customer-support':  `Write a professional customer support response to:\n"${params.customerMessage || topic}"\nIssue type: ${params.issueType || 'general'}\nTone: empathetic and solution-focused`,
  };

  return prompts[toolName] || `Please help with: ${JSON.stringify(params)}`;
}

function buildCodePrompt(toolName, params) {
  const { language = 'JavaScript', description, code, framework } = params;

  const prompts = {
    'code-generator':       `Generate ${language} code that: ${description}\n${framework ? `Framework/Library: ${framework}` : ''}\nRequirements:\n- Clean, readable code with comments\n- Error handling\n- Usage example`,
    'bug-fixer':            `Fix all bugs in this ${language} code:\n\`\`\`${language.toLowerCase()}\n${code}\n\`\`\`\nExplain each bug found and provide the complete fixed version.`,
    'code-explainer':       `Explain this ${language} code in simple terms:\n\`\`\`${language.toLowerCase()}\n${code}\n\`\`\`\nBreak down each section and explain what it does.`,
    'documentation-writer': `Generate comprehensive documentation for this ${language} code:\n\`\`\`${language.toLowerCase()}\n${code}\n\`\`\`\nInclude: description, parameters, return values, examples, edge cases.`,
    'automation-scripts':   `Create a ${language} automation script that: ${description}\nInclude: error handling, logging, setup instructions, and usage examples.`,
  };

  return prompts[toolName] || `${toolName}: ${JSON.stringify(params)}`;
}

function buildBusinessPrompt(toolName, params) {
  const { businessName, industry, targetMarket, investment, jobTitle, experience, skills, education, achievements, topic, audience, duration, goal } = params;

  const prompts = {
    'business-plan':       `Create a comprehensive business plan for:\nBusiness: ${businessName}\nIndustry: ${industry}\nTarget Market: ${targetMarket}\nInitial Investment: ${investment || 'TBD'}\nInclude: Executive Summary, Market Analysis, Competitive Analysis, Marketing Strategy, Operations Plan, Financial Projections (3 years).`,
    'cv-resume':           `Create a professional, ATS-optimized CV for a ${jobTitle} position.\nExperience: ${experience}\nSkills: ${skills}\nEducation: ${education}\nAchievements: ${achievements}\nFormat with clear sections and strong action verbs.`,
    'presentation-builder':`Create a detailed presentation outline for: "${topic}"\nAudience: ${audience}\nDuration: ${duration || 15} minutes\nGoal: ${goal}\nInclude: slide titles, key points for each slide, speaker notes suggestions.`,
    'sop-workflow':        `Create a detailed Standard Operating Procedure for: ${topic}\nDepartment/Team: ${audience || 'Operations'}\nInclude: purpose, scope, responsibilities, step-by-step procedure, quality checks, revision history.`,
    'formal-email':        `Write a formal business email about: ${topic}\nRecipient: ${audience || 'Business Contact'}\nPurpose: ${goal || params.purpose}\nTone: formal and professional`,
  };

  return prompts[toolName] || `${toolName}: ${JSON.stringify(params)}`;
}

function buildStudyPrompt(toolName, params) {
  const { subject, topic, level = 'intermediate', examDate, currentLevel, hoursPerDay, count = 10, difficulty = 'medium', problem } = params;

  const prompts = {
    'lesson-simplifier':  `Explain "${topic || subject}" in simple, easy-to-understand language for a ${level} student.\nUse: analogies, real-world examples, step-by-step breakdown.\nMake it engaging and memorable.`,
    'qa-generator':       `Generate ${count} practice questions for: "${topic || subject}"\nDifficulty: ${difficulty}\nInclude: multiple choice (with 4 options), short answer, and open-ended questions.\nProvide detailed answers for each.`,
    'study-plan':         `Create a detailed study plan for: ${subject}\nExam/Goal date: ${examDate || '4 weeks from now'}\nCurrent level: ${currentLevel || 'beginner'}\nAvailable hours per day: ${hoursPerDay || 2}\nInclude: daily schedule, weekly milestones, review sessions, practice tests.`,
    'step-by-step-solver':`Solve this problem step-by-step with clear explanations:\n${problem || topic}\nShow all work, explain each step, and highlight key concepts/formulas used.`,
  };

  return prompts[toolName] || `${toolName}: ${JSON.stringify(params)}`;
}

function enhanceImagePrompt(toolName, prompt, style) {
  const enhancements = {
    'text-to-image':        `${prompt}, high quality, detailed, professional`,
    'logo-generator':       `professional logo design, ${prompt}, clean, minimal, vector style, white background`,
    'social-media-designer':`social media graphic, ${prompt}, modern design, vibrant colors, professional`,
    'poster-maker':         `professional poster design, ${prompt}, high resolution, print quality`,
    'photo-enhancer':       `enhanced photo, ${prompt}, high resolution, sharp details, professional quality`,
  };

  return enhancements[toolName] || `${prompt}, high quality, professional`;
}

// ══════════════════════════════════════════
// MAIN ROUTER FUNCTION
// ══════════════════════════════════════════

async function routeTool(toolName, category, params) {
  const startTime = Date.now();

  try {
    let result;

    switch (category) {
      case 'writing':
      case 'specialized':
        result = await runTextTool(toolName, params);
        break;
      case 'code':
        result = await runCodeTool(toolName, params);
        break;
      case 'business':
        result = await runBusinessTool(toolName, params);
        break;
      case 'study':
        result = await runStudyTool(toolName, params);
        break;
      case 'image':
        result = await runImageTool(toolName, params);
        break;
      case 'audio':
        if (toolName === 'text-to-speech' || toolName === 'voice-over-generator') {
          result = await runTTSTool(params);
        } else if (toolName === 'speech-to-text') {
          result = await runSTTTool(params.audioBuffer, params.mimeType);
        } else {
          throw new Error(`Audio tool "${toolName}" not yet implemented`);
        }
        break;
      case 'data':
        result = await runDataTool(toolName, params);
        break;
      default:
        throw new Error(`Unknown tool category: ${category}`);
    }

    result.durationMs = Date.now() - startTime;
    return result;

  } catch (err) {
    const durationMs = Date.now() - startTime;
    throw Object.assign(err, { durationMs });
  }
}

module.exports = { routeTool };
