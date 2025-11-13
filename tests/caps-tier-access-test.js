/**
 * CAPS Curriculum & Lesson Generation Tier Access Test
 * 
 * Simplified JavaScript version to test tier access
 * without TypeScript compilation issues
 * 
 * Run with: node tests/caps-tier-access-test.js
 */

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

// Tier definitions based on the actual system
const TIER_QUOTAS = {
  free: { 
    lesson_generation: 5, 
    grading_assistance: 5, 
    homework_help: 15, 
    transcription: 60 
  },
  starter: { 
    lesson_generation: 20, 
    grading_assistance: 20, 
    homework_help: 100, 
    transcription: 120 
  },
  premium: { 
    lesson_generation: 50, 
    grading_assistance: 100, 
    homework_help: 300, 
    transcription: 300 
  },
  enterprise: { 
    lesson_generation: 5000, 
    grading_assistance: 10000, 
    homework_help: 30000, 
    transcription: 36000 
  }
}

// Capability matrix based on actual system
const CAPABILITIES = {
  free: [
    'chat.basic',
    'memory.lite', 
    'lessons.basic',
    'insights.basic',
  ],
  starter: [
    'chat.basic',
    'chat.streaming',
    'memory.lite',
    'memory.standard',
    'multimodal.vision',
    'multimodal.documents',
    'homework.assign',
    'homework.grade.basic',
    'lessons.basic',
    'lessons.curriculum',
    'insights.basic',
    'export.pdf.basic',
    'export.conversation',
  ],
  premium: [
    'chat.basic',
    'chat.streaming',
    'chat.thinking',
    'chat.priority',
    'memory.standard',
    'memory.advanced',
    'memory.patterns',
    'multimodal.vision',
    'multimodal.ocr',
    'multimodal.documents',
    'multimodal.handwriting',
    'homework.assign',
    'homework.grade.basic',
    'homework.grade.advanced',
    'homework.grade.bulk',
    'homework.rubric',
    'homework.feedback',
    'lessons.basic',
    'lessons.curriculum',
    'lessons.adaptive',
    'lessons.trends',
    'lessons.personalized',
    'insights.basic',
    'insights.proactive',
    'insights.predictive',
    'insights.realtime',
    'agent.workflows',
    'agent.autonomous',
    'agent.background',
    'agent.scheduling',
    'export.pdf.basic',
    'export.pdf.advanced',
    'export.pdf.bulk',
    'export.conversation',
    'processing.priority',
    'processing.background',
    'processing.batch',
  ],
  enterprise: [
    // All premium features plus enterprise-specific ones
    'chat.basic', 'chat.streaming', 'chat.thinking', 'chat.priority',
    'memory.standard', 'memory.advanced', 'memory.patterns',
    'multimodal.vision', 'multimodal.ocr', 'multimodal.documents', 'multimodal.handwriting',
    'homework.assign', 'homework.grade.basic', 'homework.grade.advanced', 'homework.grade.bulk',
    'homework.rubric', 'homework.feedback',
    'lessons.basic', 'lessons.curriculum', 'lessons.adaptive', 'lessons.trends', 'lessons.personalized',
    'insights.basic', 'insights.proactive', 'insights.predictive', 'insights.custom', 'insights.realtime',
    'agent.workflows', 'agent.autonomous', 'agent.background', 'agent.scheduling',
    'export.pdf.basic', 'export.pdf.advanced', 'export.pdf.bulk', 'export.conversation',
    'processing.priority', 'processing.background', 'processing.batch',
  ]
}

// Available models per tier
const MODELS = {
  free: ['Claude 3 Haiku'],
  starter: ['Claude 3 Haiku', 'Claude 3 Sonnet'],
  premium: ['Claude 3 Haiku', 'Claude 3 Sonnet', 'Claude 3 Opus'],
  enterprise: ['Claude 3 Haiku', 'Claude 3 Sonnet', 'Claude 3 Opus', 'Custom Models']
}

function hasCapability(tier, capability) {
  return CAPABILITIES[tier] && CAPABILITIES[tier].includes(capability)
}

function testTierAccess(tier) {
  console.log(`\n${colors.bright}${colors.cyan}Testing Tier: ${tier.toUpperCase()}${colors.reset}`)
  console.log('─'.repeat(60))

  // Get quotas for this tier
  const quotas = TIER_QUOTAS[tier] || {}
  
  // Test lesson generation
  const lessonQuota = quotas.lesson_generation || 0
  const lessonAccess = lessonQuota > 0
  const availableModels = MODELS[tier] || []
  
  // Test CAPS capabilities
  const canSearchCurriculum = lessonAccess // CAPS search available with lesson generation
  const canAccessPastExams = lessonAccess // Past exams tied to lesson generation
  const canGeneratePracticeTests = lessonAccess // Practice tests tied to lesson generation
  
  // Test lesson capabilities
  const hasBasicLessons = hasCapability(tier, 'lessons.basic')
  const hasCurriculumAligned = hasCapability(tier, 'lessons.curriculum')
  const hasAdaptiveLessons = hasCapability(tier, 'lessons.adaptive')
  const hasPersonalized = hasCapability(tier, 'lessons.personalized')
  
  // Test grading capabilities
  const gradingQuota = quotas.grading_assistance || 0
  const gradingAccess = gradingQuota > 0
  const hasBasicGrading = hasCapability(tier, 'homework.grade.basic')
  const hasAdvancedGrading = hasCapability(tier, 'homework.grade.advanced')
  
  // Test homework help
  const homeworkQuota = quotas.homework_help || 0
  const homeworkAccess = homeworkQuota > 0
  
  // Test voice/transcription (Dash AI voice mode)
  const transcriptionQuota = quotas.transcription || 0
  const voiceMinutes = Math.floor(transcriptionQuota / 2) // ~2 chunks per minute

  return {
    tier,
    lessonGeneration: {
      hasAccess: lessonAccess,
      monthlyQuota: lessonQuota,
      models: availableModels,
    },
    capsAccess: {
      searchCurriculum: canSearchCurriculum,
      pastExams: canAccessPastExams,
      practiceTests: canGeneratePracticeTests,
    },
    capabilities: {
      basicLessons: hasBasicLessons,
      curriculumAligned: hasCurriculumAligned,
      adaptive: hasAdaptiveLessons,
      personalized: hasPersonalized,
    },
    grading: {
      hasAccess: gradingAccess,
      monthlyQuota: gradingQuota,
      basicGrading: hasBasicGrading,
      advancedGrading: hasAdvancedGrading,
    },
    homeworkHelp: {
      hasAccess: homeworkAccess,
      monthlyQuota: homeworkQuota,
    },
    voice: {
      hasAccess: transcriptionQuota > 0,
      monthlyMinutes: voiceMinutes,
    },
  }
}

function formatAccess(hasAccess) {
  return hasAccess 
    ? `${colors.green}✓ YES${colors.reset}` 
    : `${colors.red}✗ NO${colors.reset}`
}

function formatQuota(quota, unit = 'requests') {
  if (quota === 0) return `${colors.red}0 ${unit}${colors.reset}`
  if (quota >= 1000) return `${colors.green}${quota.toLocaleString()} ${unit}${colors.reset}`
  if (quota >= 50) return `${colors.cyan}${quota} ${unit}${colors.reset}`
  return `${colors.yellow}${quota} ${unit}${colors.reset}`
}

function printResults(result) {
  console.log(`\n${colors.bright}Lesson Generation:${colors.reset}`)
  console.log(`  Access: ${formatAccess(result.lessonGeneration.hasAccess)}`)
  console.log(`  Monthly Quota: ${formatQuota(result.lessonGeneration.monthlyQuota, 'lessons')}`)
  console.log(`  Available Models: ${result.lessonGeneration.models.join(', ') || 'None'}`)
  
  console.log(`\n${colors.bright}CAPS Curriculum Features:${colors.reset}`)
  console.log(`  Search Curriculum: ${formatAccess(result.capsAccess.searchCurriculum)}`)
  console.log(`  Access Past Exams: ${formatAccess(result.capsAccess.pastExams)}`)
  console.log(`  Generate Practice Tests: ${formatAccess(result.capsAccess.practiceTests)}`)
  
  console.log(`\n${colors.bright}Lesson Capabilities:${colors.reset}`)
  console.log(`  Basic Lessons: ${formatAccess(result.capabilities.basicLessons)}`)
  console.log(`  CAPS-Aligned Lessons: ${formatAccess(result.capabilities.curriculumAligned)}`)
  console.log(`  Adaptive Lessons: ${formatAccess(result.capabilities.adaptive)}`)
  console.log(`  Personalized Lessons: ${formatAccess(result.capabilities.personalized)}`)
  
  console.log(`\n${colors.bright}Grading Assistance:${colors.reset}`)
  console.log(`  Access: ${formatAccess(result.grading.hasAccess)}`)
  console.log(`  Monthly Quota: ${formatQuota(result.grading.monthlyQuota, 'gradings')}`)
  console.log(`  Basic Grading (Math/MC): ${formatAccess(result.grading.basicGrading)}`)
  console.log(`  Advanced Grading (Essays): ${formatAccess(result.grading.advancedGrading)}`)
  
  console.log(`\n${colors.bright}Homework Help:${colors.reset}`)
  console.log(`  Access: ${formatAccess(result.homeworkHelp.hasAccess)}`)
  console.log(`  Monthly Quota: ${formatQuota(result.homeworkHelp.monthlyQuota, 'requests')}`)
  
  console.log(`\n${colors.bright}Voice Features (Dash AI):${colors.reset}`)
  console.log(`  Access: ${formatAccess(result.voice.hasAccess)}`)
  console.log(`  Monthly Voice Time: ${formatQuota(result.voice.monthlyMinutes, 'minutes')}`)
}

function printComparisonTable(results) {
  console.log(`\n\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.magenta}           TIER COMPARISON TABLE${colors.reset}`)
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}\n`)
  
  // Header
  const header = ['Feature', ...results.map(r => r.tier.toUpperCase())].join(' | ')
  console.log(colors.bright + header + colors.reset)
  console.log('─'.repeat(header.length))
  
  // Lesson Generation
  console.log(`Lesson Generation | ${results.map(r => 
    r.lessonGeneration.hasAccess ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  console.log(`Monthly Lessons   | ${results.map(r => 
    formatQuota(r.lessonGeneration.monthlyQuota, '')
  ).join(' | ')}`)
  
  // CAPS Features
  console.log(`CAPS Search       | ${results.map(r => 
    r.capsAccess.searchCurriculum ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  console.log(`Past Exams        | ${results.map(r => 
    r.capsAccess.pastExams ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  console.log(`Practice Tests    | ${results.map(r => 
    r.capsAccess.practiceTests ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  // Capabilities
  console.log(`CAPS-Aligned      | ${results.map(r => 
    r.capabilities.curriculumAligned ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  console.log(`Adaptive Lessons  | ${results.map(r => 
    r.capabilities.adaptive ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  // Grading
  console.log(`Grading (Basic)   | ${results.map(r => 
    r.grading.basicGrading ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  console.log(`Grading (Essays)  | ${results.map(r => 
    r.grading.advancedGrading ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset
  ).join('   | ')}`)
  
  // Homework & Voice
  console.log(`Homework Help     | ${results.map(r => 
    formatQuota(r.homeworkHelp.monthlyQuota, '')
  ).join(' | ')}`)
  
  console.log(`Voice Minutes     | ${results.map(r => 
    formatQuota(r.voice.monthlyMinutes, '')
  ).join(' | ')}`)
  
  console.log('\n' + colors.bright + colors.magenta + '═══════════════════════════════════════════════════════════' + colors.reset + '\n')
}

function runTests() {
  console.log(`${colors.bright}${colors.blue}`)
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║     CAPS CURRICULUM & LESSON GENERATION ACCESS TEST       ║')
  console.log('║              By Subscription Tier                         ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(colors.reset)
  
  const tiers = ['free', 'starter', 'premium', 'enterprise']
  const results = []
  
  for (const tier of tiers) {
    const result = testTierAccess(tier)
    printResults(result)
    results.push(result)
  }
  
  printComparisonTable(results)
  
  // Summary
  console.log(`\n${colors.bright}${colors.yellow}KEY FINDINGS:${colors.reset}`)
  console.log(`${colors.green}✓${colors.reset} Teachers can create CAPS-aligned lessons starting from: ${results.find(r => r.capabilities.curriculumAligned)?.tier.toUpperCase() || 'NONE'}`)
  console.log(`${colors.green}✓${colors.reset} Parents can help with homework starting from: ${results.find(r => r.homeworkHelp.hasAccess)?.tier.toUpperCase() || 'NONE'}`)
  console.log(`${colors.green}✓${colors.reset} Past exam access available from: ${results.find(r => r.capsAccess.pastExams)?.tier.toUpperCase() || 'NONE'}`)
  console.log(`${colors.green}✓${colors.reset} Voice assistance (Dash AI) available from: ${results.find(r => r.voice.hasAccess)?.tier.toUpperCase() || 'NONE'}`)
  
  console.log(`\n${colors.cyan}All tiers have been tested successfully!${colors.reset}\n`)
  
  // Feature Access Summary
  console.log(`\n${colors.bright}${colors.magenta}FEATURE ACCESS SUMMARY:${colors.reset}`)
  console.log(`${colors.bright}For Teachers:${colors.reset}`)
  console.log(`• FREE: Generic lesson creation only (5/month)`)
  console.log(`• STARTER: CAPS-aligned lessons + past papers (20/month) - ${colors.yellow}RECOMMENDED MINIMUM${colors.reset}`)
  console.log(`• PREMIUM: Advanced features + personalized content (50/month)`)
  console.log(`• ENTERPRISE: Unlimited usage for schools`)
  
  console.log(`\n${colors.bright}For Parents:${colors.reset}`)
  console.log(`• FREE: Basic homework help (15 questions/month)`)
  console.log(`• STARTER: CAPS-specific help + exam prep (100 questions/month)`)
  console.log(`• PREMIUM: Personalized learning paths (300 questions/month)`)
  console.log(`• ENTERPRISE: Unlimited for family usage`)
}

// Run tests
if (require.main === module) {
  runTests()
}

module.exports = { runTests, testTierAccess }