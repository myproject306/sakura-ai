// ══════════════════════════════════════════
// Sakura AI — Database Seed
// Run: node prisma/seed.js
// ══════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌸 Seeding Sakura AI database...');

  // ── Admin User ──
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@Sakura2025!', 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@sakura-ai.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@sakura-ai.com',
      name: 'Sakura Admin',
      firstName: 'Sakura',
      lastName: 'Admin',
      passwordHash: adminHash,
      role: 'admin',
      plan: 'team',
      credits: 99999,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // ── Templates ──
  const templates = [
    // Writing
    { title: 'Blog Post Writer', category: 'writing', emoji: '📝', description: 'Generate a full SEO-optimized blog post', prompt: 'Write a comprehensive, SEO-optimized blog post about {{topic}}. Target audience: {{audience}}. Tone: {{tone}}. Length: {{length}} words.', variables: '["topic","audience","tone","length"]' },
    { title: 'Professional Email', category: 'writing', emoji: '📧', description: 'Write a professional business email', prompt: 'Write a professional email to {{recipient}} regarding {{subject}}. Tone: {{tone}}. Key points to include: {{keyPoints}}.', variables: '["recipient","subject","tone","keyPoints"]' },
    { title: 'Social Media Post', category: 'writing', emoji: '📱', description: 'Create engaging social media content', prompt: 'Create an engaging {{platform}} post about {{topic}}. Include relevant hashtags. Tone: {{tone}}. Goal: {{goal}}.', variables: '["platform","topic","tone","goal"]' },
    { title: 'Product Description', category: 'writing', emoji: '🛒', description: 'Write compelling product descriptions', prompt: 'Write a compelling product description for {{productName}}. Key features: {{features}}. Target customer: {{targetCustomer}}. Tone: {{tone}}.', variables: '["productName","features","targetCustomer","tone"]' },
    { title: 'Marketing Copy', category: 'writing', emoji: '🎯', description: 'High-converting marketing copy', prompt: 'Write high-converting marketing copy for {{product}}. Target audience: {{audience}}. Main benefit: {{mainBenefit}}. Call to action: {{cta}}.', variables: '["product","audience","mainBenefit","cta"]' },
    // Code
    { title: 'Function Generator', category: 'code', emoji: '⚡', description: 'Generate a function in any language', prompt: 'Write a {{language}} function that {{description}}. Include error handling, comments, and a usage example. Follow best practices.', variables: '["language","description"]' },
    { title: 'Bug Fixer', category: 'code', emoji: '🐛', description: 'Fix bugs in your code', prompt: 'Fix the following {{language}} code. Identify all bugs, explain what was wrong, and provide the corrected version:\n\n{{code}}', variables: '["language","code"]' },
    { title: 'Code Explainer', category: 'code', emoji: '📖', description: 'Explain code in plain language', prompt: 'Explain the following {{language}} code in simple, clear language. Break down each section and explain what it does:\n\n{{code}}', variables: '["language","code"]' },
    // Business
    { title: 'Business Plan', category: 'business', emoji: '📊', description: 'Generate a comprehensive business plan', prompt: 'Create a comprehensive business plan for {{businessName}} in the {{industry}} industry. Target market: {{targetMarket}}. Initial investment: {{investment}}. Include executive summary, market analysis, and financial projections.', variables: '["businessName","industry","targetMarket","investment"]' },
    { title: 'CV / Resume', category: 'business', emoji: '📄', description: 'Create a professional CV', prompt: 'Create a professional CV for a {{jobTitle}} position. Experience: {{experience}}. Skills: {{skills}}. Education: {{education}}. Achievements: {{achievements}}.', variables: '["jobTitle","experience","skills","education","achievements"]' },
    { title: 'Presentation Outline', category: 'business', emoji: '🖥️', description: 'Create a presentation structure', prompt: 'Create a detailed presentation outline for {{topic}}. Audience: {{audience}}. Duration: {{duration}} minutes. Goal: {{goal}}. Include slide titles and key points for each slide.', variables: '["topic","audience","duration","goal"]' },
    // Study
    { title: 'Study Plan', category: 'study', emoji: '📅', description: 'Create a personalized study plan', prompt: 'Create a detailed study plan for {{subject}}. Exam date: {{examDate}}. Current level: {{currentLevel}}. Available hours per day: {{hoursPerDay}}. Include daily schedule and milestones.', variables: '["subject","examDate","currentLevel","hoursPerDay"]' },
    { title: 'Topic Explainer', category: 'study', emoji: '🎓', description: 'Simplify complex topics', prompt: 'Explain {{topic}} in simple, easy-to-understand language for a {{level}} student. Use analogies, examples, and break it down step by step.', variables: '["topic","level"]' },
    { title: 'Q&A Generator', category: 'study', emoji: '❓', description: 'Generate practice questions', prompt: 'Generate {{count}} practice questions with detailed answers for the topic: {{topic}}. Difficulty level: {{difficulty}}. Include multiple choice and open-ended questions.', variables: '["count","topic","difficulty"]' },
  ];

  for (const template of templates) {
    await prisma.template.upsert({
      where: { id: template.title.toLowerCase().replace(/\s+/g, '-') },
      update: { uses: { increment: 0 } },
      create: { id: template.title.toLowerCase().replace(/\s+/g, '-'), ...template },
    });
  }
  console.log(`✅ ${templates.length} templates seeded`);

  console.log('🌸 Database seeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
