// SERVICE HEALTH MONITOR
// Purpose: Check health of all external services every 5 minutes
// Security: Service role only, no client access
// Docs: https://supabase.com/docs/guides/functions
//       https://deno.land/manual

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHECK_TIMEOUT_MS = 4000;
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 300000; // 5 minutes

interface HealthCheckResult {
  service_name: string;
  service_category: string;
  status: "healthy" | "degraded" | "down" | "maintenance" | "unknown";
  response_time_ms: number | null;
  error_rate_percent: number;
  metadata: Record<string, unknown>;
  error?: string;
}

// PII scrubbing utility
function scrubPII(message: string): string {
  return message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{10,15}\b/g, "[PHONE_REDACTED]")
    .replace(/\b(?:sk|pk)_[a-zA-Z0-9]{20,}\b/g, "[API_KEY_REDACTED]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[UUID_REDACTED]");
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("Max retries exceeded");
}

// HTTP fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = CHECK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ============================================================================
// SERVICE HEALTH CHECKS
// ============================================================================

async function checkAnthropicHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!apiKey) {
    return {
      service_name: "Anthropic Claude",
      service_category: "ai",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "API key not configured" },
    };
  }

  try {
    const response = await retryWithBackoff(() =>
      fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      })
    );

    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok || response.status === 429; // 429 = rate limited but service up

    return {
      service_name: "Anthropic Claude",
      service_category: "ai",
      status: isHealthy ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: isHealthy ? 0 : 100,
      metadata: {
        status_code: response.status,
        rate_limited: response.status === 429,
      },
    };
  } catch (error) {
    return {
      service_name: "Anthropic Claude",
      service_category: "ai",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkAzureSpeechHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("AZURE_SPEECH_KEY");
  const region = Deno.env.get("AZURE_SPEECH_REGION") || "southafricanorth";

  if (!apiKey) {
    return {
      service_name: "Azure Speech",
      service_category: "voice",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "API key not configured" },
    };
  }

  try {
    const response = await retryWithBackoff(() =>
      fetchWithTimeout(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
        },
      })
    );

    const responseTime = Date.now() - startTime;

    return {
      service_name: "Azure Speech",
      service_category: "voice",
      status: response.ok ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: response.ok ? 0 : 100,
      metadata: {
        status_code: response.status,
        region,
      },
    };
  } catch (error) {
    return {
      service_name: "Azure Speech",
      service_category: "voice",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkTwilioHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!accountSid || !authToken) {
    return {
      service_name: "Twilio SMS",
      service_category: "communication",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "Credentials not configured" },
    };
  }

  try {
    const auth = btoa(`${accountSid}:${authToken}`);
    const response = await retryWithBackoff(() =>
      fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      })
    );

    const responseTime = Date.now() - startTime;

    return {
      service_name: "Twilio SMS",
      service_category: "communication",
      status: response.ok ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: response.ok ? 0 : 100,
      metadata: {
        status_code: response.status,
      },
    };
  } catch (error) {
    return {
      service_name: "Twilio SMS",
      service_category: "communication",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkWhatsAppHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const token = Deno.env.get("META_WHATSAPP_TOKEN");

  if (!token) {
    return {
      service_name: "WhatsApp Business",
      service_category: "communication",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "Access token not configured" },
    };
  }

  try {
    const response = await retryWithBackoff(() =>
      fetchWithTimeout("https://graph.facebook.com/v20.0/me?fields=id", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    const responseTime = Date.now() - startTime;

    return {
      service_name: "WhatsApp Business",
      service_category: "communication",
      status: response.ok ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: response.ok ? 0 : 100,
      metadata: {
        status_code: response.status,
      },
    };
  } catch (error) {
    return {
      service_name: "WhatsApp Business",
      service_category: "communication",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkRevenueCatHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("REVENUECAT_API_KEY");

  if (!apiKey) {
    return {
      service_name: "RevenueCat",
      service_category: "payment",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "API key not configured" },
    };
  }

  try {
    // Health check: try to fetch a non-existent subscriber (404 expected but proves API works)
    const response = await retryWithBackoff(() =>
      fetchWithTimeout("https://api.revenuecat.com/v1/subscribers/health_check_test", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
    );

    const responseTime = Date.now() - startTime;
    const isHealthy = response.status === 404 || response.ok; // 404 means API is responding

    return {
      service_name: "RevenueCat",
      service_category: "payment",
      status: isHealthy ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: isHealthy ? 0 : 100,
      metadata: {
        status_code: response.status,
      },
    };
  } catch (error) {
    return {
      service_name: "RevenueCat",
      service_category: "payment",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.rpc("get_current_timestamp");

    const responseTime = Date.now() - startTime;

    return {
      service_name: "Supabase",
      service_category: "infrastructure",
      status: error ? "degraded" : "healthy",
      response_time_ms: responseTime,
      error_rate_percent: error ? 100 : 0,
      metadata: error ? { error: scrubPII(String(error)) } : {},
    };
  } catch (error) {
    return {
      service_name: "Supabase",
      service_category: "infrastructure",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkOpenAIHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    return {
      service_name: "OpenAI",
      service_category: "ai",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "API key not configured" },
    };
  }

  try {
    const response = await retryWithBackoff(() =>
      fetchWithTimeout("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
    );

    const responseTime = Date.now() - startTime;

    return {
      service_name: "OpenAI",
      service_category: "ai",
      status: response.ok ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: response.ok ? 0 : 100,
      metadata: {
        status_code: response.status,
      },
    };
  } catch (error) {
    return {
      service_name: "OpenAI",
      service_category: "ai",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkSentryHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const authToken = Deno.env.get("SENTRY_AUTH_TOKEN");
  const orgSlug = Deno.env.get("SENTRY_ORG_SLUG");

  if (!authToken || !orgSlug) {
    return {
      service_name: "Sentry",
      service_category: "monitoring",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "Credentials not configured" },
    };
  }

  try {
    const response = await retryWithBackoff(() =>
      fetchWithTimeout(`https://sentry.io/api/0/organizations/${orgSlug}/projects/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
    );

    const responseTime = Date.now() - startTime;

    return {
      service_name: "Sentry",
      service_category: "monitoring",
      status: response.ok ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: response.ok ? 0 : 100,
      metadata: {
        status_code: response.status,
      },
    };
  } catch (error) {
    return {
      service_name: "Sentry",
      service_category: "monitoring",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

async function checkPostHogHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("POSTHOG_API_KEY");
  const host = Deno.env.get("POSTHOG_HOST") || "https://app.posthog.com";

  if (!apiKey) {
    return {
      service_name: "PostHog",
      service_category: "monitoring",
      status: "unknown",
      response_time_ms: null,
      error_rate_percent: 0,
      metadata: { error: "API key not configured" },
    };
  }

  try {
    const response = await retryWithBackoff(() =>
      fetchWithTimeout(`${host}/api/projects/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
    );

    const responseTime = Date.now() - startTime;

    return {
      service_name: "PostHog",
      service_category: "monitoring",
      status: response.ok ? "healthy" : "degraded",
      response_time_ms: responseTime,
      error_rate_percent: response.ok ? 0 : 100,
      metadata: {
        status_code: response.status,
      },
    };
  } catch (error) {
    return {
      service_name: "PostHog",
      service_category: "monitoring",
      status: "down",
      response_time_ms: Date.now() - startTime,
      error_rate_percent: 100,
      metadata: { error: scrubPII(String(error)) },
      error: scrubPII(String(error)),
    };
  }
}

// Lightweight health checks (no billable operations)
const lightweightChecks: Array<() => Promise<HealthCheckResult>> = [
  async () => ({
    service_name: "Google AdMob",
    service_category: "development",
    status: "healthy",
    response_time_ms: 0,
    error_rate_percent: 0,
    metadata: { note: "Client-side SDK, no server health check available" },
  }),
  async () => ({
    service_name: "Expo Push",
    service_category: "development",
    status: "healthy",
    response_time_ms: 0,
    error_rate_percent: 0,
    metadata: { note: "Checked via Expo CLI, assumed healthy" },
  }),
  async () => ({
    service_name: "Picovoice",
    service_category: "voice",
    status: "healthy",
    response_time_ms: 0,
    error_rate_percent: 0,
    metadata: { note: "On-device SDK, no server health check" },
  }),
];

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Run all health checks in parallel
    const healthChecks = [
      checkAnthropicHealth(),
      checkAzureSpeechHealth(),
      checkTwilioHealth(),
      checkWhatsAppHealth(),
      checkRevenueCatHealth(),
      checkSupabaseHealth(),
      checkOpenAIHealth(),
      checkSentryHealth(),
      checkPostHogHealth(),
      ...lightweightChecks.map((fn) => fn()),
    ];

    const results = await Promise.allSettled(healthChecks);

    // Process results and update database
    const healthRecords: HealthCheckResult[] = [];
    const incidents: Array<{
      service_name: string;
      severity: string;
      summary: string;
      pii_scrubbed_message: string;
    }> = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        const record = result.value;
        healthRecords.push(record);

        // Create incident if service is down
        if (record.status === "down" && record.error) {
          incidents.push({
            service_name: record.service_name,
            severity: "high",
            summary: `${record.service_name} health check failed`,
            pii_scrubbed_message: record.error,
          });
        }

        // Update health status
        await supabase.from("service_health_status").upsert(
          {
            service_name: record.service_name,
            service_category: record.service_category,
            status: record.status,
            response_time_ms: record.response_time_ms,
            error_rate_percent: record.error_rate_percent,
            last_checked_at: new Date().toISOString(),
            last_success_at: record.status === "healthy" ? new Date().toISOString() : undefined,
            last_failure_at: record.status === "down" ? new Date().toISOString() : undefined,
            consecutive_failures: record.status === "down" ? 1 : 0,
            metadata: record.metadata,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "service_name" }
        );
      }
    }

    // Create incidents for failures
    if (incidents.length > 0) {
      await supabase.from("service_incidents").insert(incidents);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: healthRecords.length,
        incidents: incidents.length,
        results: healthRecords,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Health monitor error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: scrubPII(String(error)),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
