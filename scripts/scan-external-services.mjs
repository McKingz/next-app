#!/usr/bin/env node

/**
 * External Services Scanner
 * 
 * Scans the EduDash Pro codebase to identify all external APIs and third-party services.
 * Produces EXTERNAL_SERVICES_INVENTORY.md with categorized service information.
 * 
 * Documentation Sources:
 * - Node.js fs/promises: https://nodejs.org/api/fs.html#promises-api
 * - Node.js child_process: https://nodejs.org/api/child_process.html
 * 
 * @module scan-external-services
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ============================================================================
// Service Definitions (from official documentation)
// ============================================================================

const SERVICE_PATTERNS = {
  anthropic: {
    name: 'Anthropic Claude',
    category: 'ai',
    criticality: 'critical',
    docs: 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api',
    patterns: ['anthropic', 'claude'],
    envVars: ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'],
    domains: ['api.anthropic.com']
  },
  azure_speech: {
    name: 'Microsoft Azure Cognitive Services Speech',
    category: 'voice',
    criticality: 'critical',
    docs: 'https://learn.microsoft.com/azure/ai-services/speech-service/',
    patterns: ['azure.*speech', 'cognitiveservices.*speech', 'microsoft-cognitiveservices-speech-sdk'],
    envVars: ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'],
    domains: ['*.stt.speech.microsoft.com', '*.tts.speech.microsoft.com']
  },
  supabase: {
    name: 'Supabase',
    category: 'infrastructure',
    criticality: 'critical',
    docs: 'https://supabase.com/docs',
    patterns: ['@supabase/supabase-js', 'supabase'],
    envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    domains: ['*.supabase.co']
  },
  revenuecat: {
    name: 'RevenueCat',
    category: 'payment',
    criticality: 'high',
    docs: 'https://www.revenuecat.com/docs/api-v1',
    patterns: ['react-native-purchases', 'revenuecat'],
    envVars: ['REVENUECAT_ANDROID_SDK_KEY', 'REVENUECAT_IOS_SDK_KEY', 'REVENUECAT_API_KEY'],
    domains: ['api.revenuecat.com']
  },
  admob: {
    name: 'Google AdMob',
    category: 'payment',
    criticality: 'medium',
    docs: 'https://developers.google.com/admob',
    patterns: ['react-native-google-mobile-ads', 'admob'],
    envVars: ['ADMOB_ANDROID_APP_ID', 'ADMOB_IOS_APP_ID', 'ADMOB_ANDROID_BANNER_UNIT_ID'],
    domains: ['admob.googleapis.com']
  },
  twilio: {
    name: 'Twilio',
    category: 'communication',
    criticality: 'high',
    docs: 'https://www.twilio.com/docs/usage/api',
    patterns: ['twilio'],
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    domains: ['api.twilio.com']
  },
  whatsapp: {
    name: 'WhatsApp Cloud API (Meta)',
    category: 'communication',
    criticality: 'high',
    docs: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    patterns: ['whatsapp', 'graph.facebook.com'],
    envVars: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'META_API_VERSION'],
    domains: ['graph.facebook.com']
  },
  payfast: {
    name: 'PayFast',
    category: 'payment',
    criticality: 'medium',
    docs: 'https://developers.payfast.co.za/',
    patterns: ['payfast'],
    envVars: ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE'],
    domains: ['api.payfast.co.za', 'www.payfast.co.za']
  },
  paypal: {
    name: 'PayPal',
    category: 'payment',
    criticality: 'medium',
    docs: 'https://developer.paypal.com/docs/api/overview/',
    patterns: ['paypal'],
    envVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    domains: ['api-m.paypal.com', 'api.paypal.com']
  },
  google_calendar: {
    name: 'Google Calendar API',
    category: 'communication',
    criticality: 'low',
    docs: 'https://developers.google.com/calendar/api',
    patterns: ['calendar'],
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALENDAR_WEBHOOK_TOKEN'],
    domains: ['www.googleapis.com/calendar']
  },
  sentry: {
    name: 'Sentry',
    category: 'monitoring',
    criticality: 'low',
    docs: 'https://docs.sentry.io/platforms/react-native/',
    patterns: ['sentry-expo', '@sentry', 'sentry'],
    envVars: ['SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'SENTRY_ORG_SLUG'],
    domains: ['sentry.io', '*.ingest.sentry.io']
  },
  posthog: {
    name: 'PostHog',
    category: 'monitoring',
    criticality: 'low',
    docs: 'https://posthog.com/docs/libraries/react-native',
    patterns: ['posthog-react-native', 'posthog'],
    envVars: ['POSTHOG_KEY', 'POSTHOG_HOST'],
    domains: ['app.posthog.com', 'us.i.posthog.com']
  },
  openai: {
    name: 'OpenAI',
    category: 'ai',
    criticality: 'medium',
    docs: 'https://platform.openai.com/docs/api-reference',
    patterns: ['openai'],
    envVars: ['OPENAI_API_KEY', 'OPENAI_TRANSCRIPTION_MODEL'],
    domains: ['api.openai.com']
  },
  deepgram: {
    name: 'Deepgram',
    category: 'voice',
    criticality: 'low',
    docs: 'https://developers.deepgram.com/docs',
    patterns: ['deepgram'],
    envVars: ['DEEPGRAM_API_KEY'],
    domains: ['api.deepgram.com']
  },
  google_tts: {
    name: 'Google Cloud Text-to-Speech',
    category: 'voice',
    criticality: 'low',
    docs: 'https://cloud.google.com/text-to-speech/docs/reference/rest',
    patterns: ['texttospeech.googleapis.com', 'google.*tts'],
    envVars: ['GOOGLE_CLOUD_TTS_API_KEY'],
    domains: ['texttospeech.googleapis.com']
  },
  expo: {
    name: 'Expo (EAS)',
    category: 'development',
    criticality: 'medium',
    docs: 'https://docs.expo.dev/',
    patterns: ['expo', 'eas'],
    envVars: ['EXPO_ACCESS_TOKEN', 'EXPO_PUBLIC_'],
    domains: ['expo.dev', 'api.expo.dev']
  },
  picovoice: {
    name: 'Picovoice',
    category: 'voice',
    criticality: 'low',
    docs: 'https://picovoice.ai/docs/',
    patterns: ['@picovoice', 'porcupine'],
    envVars: ['PICOVOICE_ACCESS_KEY'],
    domains: ['api.picovoice.ai']
  }
};

// ============================================================================
// Scanner Functions
// ============================================================================

/**
 * Scan package.json for external service dependencies
 * @returns {Promise<Object>} Service detection results
 */
async function scanPackageDependencies() {
  const packagePath = join(projectRoot, 'package.json');
  const packageContent = await readFile(packagePath, 'utf-8');
  const packageData = JSON.parse(packageContent);
  
  const allDeps = {
    ...packageData.dependencies,
    ...packageData.devDependencies
  };
  
  const detectedServices = {};
  
  for (const [serviceKey, serviceConfig] of Object.entries(SERVICE_PATTERNS)) {
    for (const pattern of serviceConfig.patterns) {
      const regex = new RegExp(pattern, 'i');
      const matches = Object.keys(allDeps).filter(dep => regex.test(dep));
      
      if (matches.length > 0) {
        if (!detectedServices[serviceKey]) {
          detectedServices[serviceKey] = { ...serviceConfig, packages: [], envVarsFound: [] };
        }
        detectedServices[serviceKey].packages.push(...matches.map(pkg => `${pkg}@${allDeps[pkg]}`));
      }
    }
  }
  
  return detectedServices;
}

/**
 * Scan environment variable files for service configuration
 * @returns {Promise<Set<string>>} Set of found environment variables
 */
async function scanEnvironmentVariables() {
  const envFiles = ['.env.example', '.env.template'];
  const foundEnvVars = new Set();
  
  for (const envFile of envFiles) {
    try {
      const envPath = join(projectRoot, envFile);
      const envContent = await readFile(envPath, 'utf-8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^([A-Z_]+)=/);
        if (match) {
          foundEnvVars.add(match[1]);
        }
      }
    } catch (error) {
      // File might not exist, continue
    }
  }
  
  return foundEnvVars;
}

/**
 * Scan Edge Functions for external API calls
 * @returns {Promise<Object>} Map of services to Edge Functions using them
 */
async function scanEdgeFunctions() {
  const functionsUsage = {};
  
  try {
    const { stdout } = await execAsync('find supabase/functions -name "index.ts" -type f', { cwd: projectRoot });
    const functionFiles = stdout.trim().split('\n').filter(Boolean);
    
    for (const functionFile of functionFiles) {
      const functionPath = join(projectRoot, functionFile);
      const content = await readFile(functionPath, 'utf-8');
      const functionName = functionFile.split('/')[2]; // Extract function name
      
      for (const [serviceKey, serviceConfig] of Object.entries(SERVICE_PATTERNS)) {
        for (const pattern of serviceConfig.patterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(content)) {
            if (!functionsUsage[serviceKey]) {
              functionsUsage[serviceKey] = [];
            }
            if (!functionsUsage[serviceKey].includes(functionName)) {
              functionsUsage[serviceKey].push(functionName);
            }
          }
        }
        
        // Check for domain usage
        for (const domain of serviceConfig.domains) {
          const domainPattern = domain.replace('*', '[a-zA-Z0-9-]+');
          const regex = new RegExp(domainPattern, 'i');
          if (regex.test(content)) {
            if (!functionsUsage[serviceKey]) {
              functionsUsage[serviceKey] = [];
            }
            if (!functionsUsage[serviceKey].includes(functionName)) {
              functionsUsage[serviceKey].push(functionName);
            }
          }
        }
      }
    }
  } catch (error) {
    // Continue if edge functions scan fails
  }
  
  return functionsUsage;
}

/**
 * Generate markdown inventory document
 * @param {Object} detectedServices - Services with package info
 * @param {Set<string>} envVars - Found environment variables
 * @param {Object} functionsUsage - Edge Functions using services
 * @returns {string} Markdown content
 */
function generateInventoryMarkdown(detectedServices, envVars, functionsUsage) {
  const categories = {
    infrastructure: [],
    ai: [],
    voice: [],
    payment: [],
    communication: [],
    monitoring: [],
    development: []
  };
  
  // Categorize services
  for (const [serviceKey, serviceData] of Object.entries(detectedServices)) {
    const category = serviceData.category;
    if (categories[category]) {
      categories[category].push({ key: serviceKey, ...serviceData });
    }
  }
  
  let markdown = `# External Services Inventory

**Generated**: ${new Date().toISOString()}  
**Project**: EduDash Pro  
**Purpose**: Track all external APIs and third-party services for monitoring and cost management

---

## Summary

`;
  
  // Summary table
  markdown += `| Category | Services | Criticality |\n`;
  markdown += `|----------|----------|-------------|\n`;
  
  for (const [category, services] of Object.entries(categories)) {
    if (services.length > 0) {
      const critical = services.filter(s => s.criticality === 'critical').length;
      const high = services.filter(s => s.criticality === 'high').length;
      const medium = services.filter(s => s.criticality === 'medium').length;
      const low = services.filter(s => s.criticality === 'low').length;
      
      markdown += `| ${category.charAt(0).toUpperCase() + category.slice(1)} | ${services.length} | `;
      markdown += `${critical ? `🔴 ${critical}` : ''} ${high ? `🟠 ${high}` : ''} ${medium ? `🟡 ${medium}` : ''} ${low ? `⚪ ${low}` : ''} |\n`;
    }
  }
  
  markdown += `\n**Legend**: 🔴 Critical | 🟠 High | 🟡 Medium | ⚪ Low\n\n---\n\n`;
  
  // Detailed service information
  for (const [categoryName, services] of Object.entries(categories)) {
    if (services.length === 0) continue;
    
    markdown += `## ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Services\n\n`;
    
    for (const service of services) {
      const criticalityIcon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '⚪'
      }[service.criticality];
      
      markdown += `### ${criticalityIcon} ${service.name}\n\n`;
      markdown += `- **Category**: ${service.category}\n`;
      markdown += `- **Criticality**: ${service.criticality}\n`;
      markdown += `- **Official Docs**: ${service.docs}\n\n`;
      
      if (service.packages && service.packages.length > 0) {
        markdown += `**NPM Packages**:\n`;
        service.packages.forEach(pkg => {
          markdown += `- \`${pkg}\`\n`;
        });
        markdown += `\n`;
      }
      
      if (service.envVars && service.envVars.length > 0) {
        markdown += `**Environment Variables**:\n`;
        service.envVars.forEach(envVar => {
          const found = envVars.has(envVar) || envVars.has(`EXPO_PUBLIC_${envVar}`);
          markdown += `- \`${envVar}\` ${found ? '✅' : '⚠️'}\n`;
        });
        markdown += `\n`;
      }
      
      if (service.domains && service.domains.length > 0) {
        markdown += `**API Domains**:\n`;
        service.domains.forEach(domain => {
          markdown += `- \`${domain}\`\n`;
        });
        markdown += `\n`;
      }
      
      if (functionsUsage[service.key] && functionsUsage[service.key].length > 0) {
        markdown += `**Used in Edge Functions**:\n`;
        functionsUsage[service.key].forEach(func => {
          markdown += `- \`${func}\`\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    }
  }
  
  // Footer
  markdown += `## Documentation Sources\n\n`;
  markdown += `This inventory was generated using the following official documentation:\n\n`;
  
  for (const [, serviceData] of Object.entries(detectedServices)) {
    markdown += `- **${serviceData.name}**: ${serviceData.docs}\n`;
  }
  
  markdown += `\n---\n\n`;
  markdown += `**Maintenance**: This inventory should be regenerated monthly or when new external services are added.\n`;
  markdown += `**Command**: \`npm run scan:services\` or \`node scripts/scan-external-services.mjs\`\n`;
  
  return markdown;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  try {
    // Run scans
    const detectedServices = await scanPackageDependencies();
    const envVars = await scanEnvironmentVariables();
    const functionsUsage = await scanEdgeFunctions();
    
    // Merge environment variable findings
    for (const [serviceKey, serviceData] of Object.entries(detectedServices)) {
      serviceData.envVarsFound = serviceData.envVars.filter(v => 
        envVars.has(v) || envVars.has(`EXPO_PUBLIC_${v}`)
      );
    }
    
    // Generate markdown
    const markdown = generateInventoryMarkdown(detectedServices, envVars, functionsUsage);
    
    // Write to file
    const outputDir = join(projectRoot, 'docs/features/service-monitoring');
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'EXTERNAL_SERVICES_INVENTORY.md');
    await writeFile(outputPath, markdown, 'utf-8');
    
    // Success output (stderr to avoid polluting stdout)
    process.stderr.write(`✅ External services inventory generated: ${outputPath}\n`);
    process.stderr.write(`📊 Found ${Object.keys(detectedServices).length} services\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(`❌ Error scanning services: ${error.message}\n`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scanPackageDependencies, scanEnvironmentVariables, scanEdgeFunctions, generateInventoryMarkdown };
