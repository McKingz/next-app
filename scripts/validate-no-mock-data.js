#!/usr/bin/env node
/**
 * Mock Data Validation Script
 * 
 * This script scans the superadmin dashboard for any remaining hardcoded mock data
 * to ensure compliance with WARP.md requirement that superadmin dashboard
 * uses only real data from the database.
 */

const fs = require('fs');
const path = require('path');

const SUPERADMIN_DASHBOARD_PATH = path.join(__dirname, '../app/screens/super-admin-dashboard.tsx');

// Patterns that indicate mock data (excluding legitimate constants)
const MOCK_DATA_PATTERNS = [
  // Hardcoded dollar amounts (but allow formatting patterns)
  /\$\d{1,3}(,\d{3})*(?!\{|\s*Math|\s*dashboardStats|\s*\()/g,
  
  // Hardcoded percentages not from variables (but exclude CSS properties)
  /(?<!percentage|flag\.percentage|utilization|width:\s*['"`]|height:\s*['"`])\d+%(?!\s*buffer|\s*opacity|['"`])/g,
  
  // Common mock values
  /15,513/g,  // The old AI cost
  /\b(mock|dummy|fake|placeholder)[\s_]*data\b/gi,
  
  // Hardcoded user counts (but allow variable references)
  /(?<!stats\.|dashboardStats\.)\b\d{3,}\s*(users?|students?|teachers?)\b/gi,
  
  // Hardcoded status strings not from variables
  /status:\s*['"`](active|pending|completed)['"`]/g,
];

// Legitimate patterns that should be ignored
const ALLOWED_PATTERNS = [
  'Math.round',
  'dashboardStats',
  'toLocaleString',
  'process.env',
  'theme.',
  'styles.',
  'flag.percentage',
  'aiUsageCost',
  'monthlyRevenue',
  'totalOrgs',
  'activeSeats',
];

function validateSuperadminDashboard() {
  console.log('🔍 Validating Superadmin Dashboard for mock data...\n');
  
  if (!fs.existsSync(SUPERADMIN_DASHBOARD_PATH)) {
    console.error(`❌ Dashboard file not found: ${SUPERADMIN_DASHBOARD_PATH}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(SUPERADMIN_DASHBOARD_PATH, 'utf8');
  const lines = content.split('\n');
  
  let issuesFound = 0;
  
  MOCK_DATA_PATTERNS.forEach((pattern, patternIndex) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;
      
      // Find the line number
      let lineNumber = 1;
      let currentIndex = 0;
      for (let i = 0; i < matchIndex; i++) {
        if (content[i] === '\n') {
          lineNumber++;
          currentIndex = i + 1;
        }
      }
      
      const lineContent = lines[lineNumber - 1];
      
      // Check if this match is in an allowed context
      const isAllowed = ALLOWED_PATTERNS.some(allowed => 
        lineContent.includes(allowed)
      );
      
      if (!isAllowed) {
        console.log(`⚠️  Potential mock data found:`);
        console.log(`   Line ${lineNumber}: ${matchText}`);
        console.log(`   Context: ${lineContent.trim()}`);
        console.log(`   Pattern: ${pattern.source}\n`);
        issuesFound++;
      }
    }
  });
  
  // Check for specific RPC function calls that should exist
  const requiredRPCCalls = [
    'get_superadmin_ai_usage_cost',
    'get_superadmin_dashboard_data',
    'get_system_health_metrics',
  ];
  
  const missingRPCs = requiredRPCCalls.filter(rpc => !content.includes(rpc));
  
  if (missingRPCs.length > 0) {
    console.log(`❌ Missing required RPC calls:`);
    missingRPCs.forEach(rpc => {
      console.log(`   - ${rpc}`);
    });
    issuesFound += missingRPCs.length;
  }
  
  // Summary
  if (issuesFound === 0) {
    console.log('✅ Validation PASSED: No mock data found in superadmin dashboard');
    console.log('✅ All data appears to come from database via RPC functions');
    
    // Additional checks
    const hasAIUsageCostRPC = content.includes('get_superadmin_ai_usage_cost');
    const hasDynamicFeatureFlags = content.includes('featureFlags.map');
    const hasPersonalizedWelcome = content.includes('profile?.first_name');
    
    console.log('\n📊 Feature Compliance:');
    console.log(`   Real AI Usage Cost: ${hasAIUsageCostRPC ? '✅' : '❌'}`);
    console.log(`   Dynamic Feature Flags: ${hasDynamicFeatureFlags ? '✅' : '❌'}`);
    console.log(`   Personalized Welcome: ${hasPersonalizedWelcome ? '✅' : '❌'}`);
    
  } else {
    console.log(`❌ Validation FAILED: ${issuesFound} potential issues found`);
    console.log('\n🔧 Recommended actions:');
    console.log('   1. Replace hardcoded values with database queries');
    console.log('   2. Use RPC functions for all data');
    console.log('   3. Make feature flags dynamic based on config');
    console.log('   4. Ensure all costs come from ai_usage_logs table');
    
    process.exit(1);
  }
}

// Check for command line usage
if (require.main === module) {
  validateSuperadminDashboard();
}

module.exports = { validateSuperadminDashboard };