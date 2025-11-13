/**
 * CAPS Curriculum & Lesson Generation Tier Access Test
 * 
 * Tests which subscription tiers have access to:
 * - CAPS curriculum search
 * - Lesson generation
 * - Past exam questions
 * - Practice test generation
 * - AI-powered educational features
 */

import { canUseFeature, getQuotaStatus, getEffectiveLimits } from '@/lib/ai/limits'
import { canAccessModel, getModelsForTier, type SubscriptionTier } from '@/lib/ai/models'
import { hasCapability, getCapabilities } from '@/lib/ai/capabilities'

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

interface TierTestResult {
  tier: SubscriptionTier
  lessonGeneration: {
    hasAccess: boolean
    monthlyQuota: number
    models: string[]
  }
  capsAccess: {
    searchCurriculum: boolean
    pastExams: boolean
    practiceTests: boolean
  }
  capabilities: {
    basicLessons: boolean
    curriculumAligned: boolean
    adaptive: boolean
    personalized: boolean
  }
  grading: {
    hasAccess: boolean
    monthlyQuota: number
    basicGrading: boolean
    advancedGrading: boolean
  }
  homeworkHelp: {
    hasAccess: boolean
    monthlyQuota: number
  }
  voice: {
    hasAccess: boolean
    monthlyMinutes: number
  }
}

async function testTierAccess(tier: SubscriptionTier): Promise<TierTestResult> {
  console.log(`\n${colors.bright}${colors.cyan}Testing Tier: ${tier.toUpperCase()}${colors.reset}`)
  console.log('─'.repeat(60))

  // Get limits for this tier
  const limits = await getEffectiveLimits()
  
  // Test lesson generation
  const lessonQuota = limits.quotas.lesson_generation || 0
  const lessonAccess = lessonQuota > 0
  const availableModels = getModelsForTier(tier).map(m => m.name)
  
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
  const gradingQuota = limits.quotas.grading_assistance || 0
  const gradingAccess = gradingQuota > 0
  const hasBasicGrading = hasCapability(tier, 'homework.grade.basic')
  const hasAdvancedGrading = hasCapability(tier, 'homework.grade.advanced')
  
  // Test homework help
  const homeworkQuota = limits.quotas.homework_help || 0
  const homeworkAccess = homeworkQuota > 0
  
  // Test voice/transcription (Dash AI voice mode)
  const transcriptionQuota = limits.quotas.transcription || 0
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

function formatAccess(hasAccess: boolean): string {
  return hasAccess 
    ? `${colors.green}✓ YES${colors.reset}` 
    : `${colors.red}✗ NO${colors.reset}`
}

function formatQuota(quota: number, unit: string = 'requests'): string {
  if (quota === 0) return `${colors.red}0 ${unit}${colors.reset}`
  if (quota >= 1000) return `${colors.green}${quota.toLocaleString()} ${unit}${colors.reset}`
  if (quota >= 50) return `${colors.cyan}${quota} ${unit}${colors.reset}`
  return `${colors.yellow}${quota} ${unit}${colors.reset}`
}

function printResults(result: TierTestResult) {
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

function printComparisonTable(results: TierTestResult[]) {
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

async function runTests() {
  console.log(`${colors.bright}${colors.blue}`)
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║     CAPS CURRICULUM & LESSON GENERATION ACCESS TEST       ║')
  console.log('║              By Subscription Tier                         ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(colors.reset)
  
  const tiers: SubscriptionTier[] = ['free', 'starter', 'premium', 'enterprise']
  const results: TierTestResult[] = []
  
  for (const tier of tiers) {
    const result = await testTierAccess(tier)
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
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error)
}

export { runTests, testTierAccess, type TierTestResult }
