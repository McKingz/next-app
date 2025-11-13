/**
 * Server-side AI Proxy Example
 * 
 * This demonstrates how to implement a secure server-side proxy for Claude API calls.
 * API keys are stored server-side and never exposed to clients.
 * 
 * Deploy this to your backend service (Vercel, Netlify, Railway, etc.)
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors());

// Server-side environment variables (NEVER expose these to client)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // Server-only!
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Server-only!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Middleware to authenticate user requests
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Add user info to request for downstream use
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Check user permissions for AI features
 */
async function checkAIPermissions(req, res, next) {
  try {
    const userId = req.user.id;
    
    // Check if user has AI access permissions
    const { data: profile } = await supabase
      .from('users')
      .select('capabilities, subscription_status, ai_credits_remaining, organization_id, preschool_id')
      .eq('auth_user_id', userId)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'User profile not found' });
    }

    // Check AI access capability
    const capabilities = profile.capabilities || [];
    if (!capabilities.includes('access_ai_features')) {
      return res.status(403).json({ error: 'AI access not enabled for this user' });
    }

    // Check subscription status
    if (profile.subscription_status !== 'active') {
      return res.status(403).json({ error: 'Active subscription required for AI features' });
    }

    // Check remaining credits
    if (profile.ai_credits_remaining <= 0) {
      return res.status(403).json({ error: 'No AI credits remaining' });
    }

    req.userProfile = profile;
    next();
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
}

/**
 * Log AI usage for billing and monitoring
 */
async function logAIUsage(userId, organizationId, preschoolId, aiServiceId, serviceType, inputTokens, outputTokens, responseTimeMs, inputCost, outputCost, totalCost, status = 'success', errorMessage = null) {
  try {
    await supabase.from('ai_usage_logs').insert({
      user_id: userId,
      organization_id: organizationId,
      preschool_id: preschoolId,
      ai_service_id: aiServiceId,
      service_type: serviceType,
      input_tokens: inputTokens || 0,
      output_tokens: outputTokens || 0,
      response_time_ms: responseTimeMs || 0,
      status: status,
      input_cost: inputCost || 0,
      output_cost: outputCost || 0,
      total_cost: totalCost || 0,
      ai_model_used: 'claude-3-sonnet-20240229',
      error_message: errorMessage,
    });

    // Only update user's remaining credits on successful requests
    if (status === 'success' && totalCost > 0) {
      await supabase
        .from('users')
        .update({ 
          ai_credits_remaining: supabase.rpc('decrement_ai_credits', { 
            user_id: userId, 
            amount: Math.ceil(totalCost * 100) // Convert to cents
          })
        })
        .eq('auth_user_id', userId);
    }
  } catch (error) {
    console.error('Failed to log AI usage:', error);
  }
}

/**
 * Secure Claude API Proxy Endpoint
 */
app.post('/ai/claude/messages', authenticateUser, checkAIPermissions, async (req, res) => {
  try {
    const { model, max_tokens, temperature, system, messages, userId } = req.body;
    const requestStartTime = Date.now();

    // Validate request
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Get user profile data for logging
    const userProfile = req.userProfile;
    if (!userProfile || !userProfile.organization_id || !userProfile.preschool_id) {
      return res.status(400).json({ error: 'User profile incomplete for AI logging' });
    }

    // Get AI service ID for Claude
    const { data: aiService } = await supabase
      .from('ai_services')
      .select('id')
      .eq('name', 'Claude')
      .eq('provider', 'anthropic')
      .single();

    if (!aiService) {
      return res.status(500).json({ error: 'AI service configuration not found' });
    }

    // Add rate limiting per user
    const rateLimitKey = `ai_requests:${userId}`;
    // Implementation depends on your rate limiting strategy

    // Make secure call to Claude API (server-side only)
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY, // Server-side only!
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-sonnet-20240229',
        max_tokens: Math.min(max_tokens || 4000, 8000), // Cap max tokens
        temperature: Math.max(0, Math.min(temperature || 0.7, 1)), // Cap temperature
        system,
        messages,
      }),
    });

    const responseTime = Date.now() - requestStartTime;

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      
      // Log failed usage
      await logAIUsage(
        userId,
        userProfile.organization_id,
        userProfile.preschool_id,
        aiService.id,
        'claude_message',
        0, // input_tokens
        0, // output_tokens
        responseTime,
        0, // input_cost
        0, // output_cost
        0, // total_cost
        'error',
        errorText
      );
      
      return res.status(claudeResponse.status).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await claudeResponse.json();

    // Calculate cost and log usage
    const inputCost = (data.usage.input_tokens / 1000) * 0.003; // $0.003 per 1K input tokens
    const outputCost = (data.usage.output_tokens / 1000) * 0.015; // $0.015 per 1K output tokens
    const totalCost = inputCost + outputCost;

    // Log successful usage
    await logAIUsage(
      userId,
      userProfile.organization_id,
      userProfile.preschool_id,
      aiService.id,
      'claude_message',
      data.usage.input_tokens,
      data.usage.output_tokens,
      responseTime,
      inputCost,
      outputCost,
      totalCost
    );

    // Return response to client
    res.json(data);

  } catch (error) {
    console.error('AI proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Get user's AI usage stats
 */
app.get('/ai/usage', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: usage } = await supabase
      .from('ai_usage_logs')
      .select('service_type, input_tokens, output_tokens, total_cost, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false });

    const { data: profile } = await supabase
      .from('users')
      .select('ai_credits_remaining')
      .eq('auth_user_id', userId)
      .single();

    res.json({
      usage: usage || [],
      credits_remaining: profile?.ai_credits_remaining || 0,
      period: 'last_30_days',
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Proxy server running on port ${PORT}`);
  console.log('Security features enabled:');
  console.log('- API keys stored server-side only');
  console.log('- User authentication required');
  console.log('- Permission checks enabled');
  console.log('- Usage logging and billing');
  console.log('- Rate limiting (implement as needed)');
});

module.exports = app;
