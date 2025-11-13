#!/usr/bin/env tsx
/**
 * CAPS Integration Verification Script
 * 
 * Quick test to verify CAPS tools are properly wired before user testing
 */

import { ToolRegistry } from '../services/modules/DashToolRegistry';
import DashCAPSKnowledge from '../services/DashCAPSKnowledge';

async function verifyToolRegistry() {
  console.log('🔧 1. Verifying Tool Registry...\n');
  
  const tools = ToolRegistry.getToolNames();
  const capsTools = tools.filter(t => t.includes('caps'));
  
  console.log(`   Total tools registered: ${tools.length}`);
  console.log(`   CAPS tools found: ${capsTools.length}`);
  console.log(`   CAPS tools: ${capsTools.join(', ')}\n`);
  
  if (capsTools.length < 3) {
    console.error('   ❌ Expected 3 CAPS tools, found', capsTools.length);
    return false;
  }
  
  console.log('   ✅ All CAPS tools registered\n');
  return true;
}

async function verifyDatabaseConnection() {
  console.log('🗄️  2. Verifying Database Connection...\n');
  
  try {
    // Test basic search
    const results = await DashCAPSKnowledge.searchCurriculum('Mathematics', {
      limit: 2
    });
    
    console.log(`   Search test returned ${results.length} results`);
    
    if (results.length > 0) {
      const doc = results[0].document;
      console.log(`   Sample document: ${doc.title}`);
      console.log(`   Grade: ${doc.grade}, Subject: ${doc.subject}`);
      console.log('   ✅ Database connection working\n');
      return true;
    } else {
      console.warn('   ⚠️  No documents found (database empty?)\n');
      return true; // Not a failure if DB is empty
    }
  } catch (error) {
    console.error('   ❌ Database connection failed:', error);
    return false;
  }
}

async function verifyToolExecution() {
  console.log('⚙️  3. Verifying Tool Execution...\n');
  
  try {
    // Test search_caps_curriculum tool
    const result = await ToolRegistry.execute('search_caps_curriculum', {
      query: 'English',
      limit: 2
    });
    
    if (result.success) {
      console.log(`   Tool executed successfully`);
      console.log(`   Found: ${result.found ? 'Yes' : 'No'}`);
      if (result.documents) {
        console.log(`   Documents: ${result.documents.length}`);
      }
      console.log('   ✅ Tool execution working\n');
      return true;
    } else {
      console.error('   ❌ Tool execution failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('   ❌ Tool execution threw error:', error);
    return false;
  }
}

async function verifyGradeSubjectQuery() {
  console.log('📚 4. Verifying Grade/Subject Query...\n');
  
  try {
    const result = await ToolRegistry.execute('get_caps_subjects', {
      grade: '10-12'
    });
    
    if (result.success) {
      console.log(`   Grade: ${result.grade}`);
      console.log(`   Subjects found: ${result.count}`);
      if (result.subjects && result.subjects.length > 0) {
        console.log(`   Sample subjects: ${result.subjects.slice(0, 3).join(', ')}`);
      }
      console.log('   ✅ Grade/subject queries working\n');
      return true;
    } else {
      console.error('   ❌ Query failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('   ❌ Query threw error:', error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('   CAPS Integration Verification');
  console.log('═══════════════════════════════════════════════\n');
  
  const results = {
    toolRegistry: await verifyToolRegistry(),
    database: await verifyDatabaseConnection(),
    toolExecution: await verifyToolExecution(),
    gradeQuery: await verifyGradeSubjectQuery(),
  };
  
  console.log('═══════════════════════════════════════════════');
  console.log('   RESULTS');
  console.log('═══════════════════════════════════════════════\n');
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}`);
  });
  
  const allPassed = Object.values(results).every(v => v);
  
  console.log('\n═══════════════════════════════════════════════');
  if (allPassed) {
    console.log('   🎉 ALL CHECKS PASSED - Ready for testing!');
    console.log('═══════════════════════════════════════════════\n');
    console.log('Try these test prompts in Dash chat:');
    console.log('  • "Show me Grade 10 Mathematics CAPS documents"');
    console.log('  • "What subjects are available for grades 7-9?"');
    console.log('  • "Search CAPS for Physical Sciences"\n');
  } else {
    console.log('   ❌ SOME CHECKS FAILED - Fix issues before testing');
    console.log('═══════════════════════════════════════════════\n');
  }
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
