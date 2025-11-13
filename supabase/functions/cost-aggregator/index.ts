// COST AGGREGATOR
// Purpose: Aggregate usage logs and calculate monthly costs per service
// Security: Service role only, no client access
// Docs: https://supabase.com/docs/guides/functions
//       https://deno.land/manual

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Pricing constants (USD) - configurable per service
const PRICING = {
  anthropic: {
    sonnet_input: 3.0 / 1_000_000, // $3 per 1M input tokens
    sonnet_output: 15.0 / 1_000_000, // $15 per 1M output tokens
    haiku_input: 0.25 / 1_000_000, // $0.25 per 1M input tokens
    haiku_output: 1.25 / 1_000_000, // $1.25 per 1M output tokens
  },
  openai: {
    gpt4_input: 30.0 / 1_000_000, // $30 per 1M input tokens
    gpt4_output: 60.0 / 1_000_000, // $60 per 1M output tokens
    gpt35_input: 0.5 / 1_000_000, // $0.50 per 1M input tokens
    gpt35_output: 1.5 / 1_000_000, // $1.50 per 1M output tokens
  },
  azure_speech: {
    tts: 16.0 / 1_000_000, // $16 per 1M characters
    stt: 1.0 / 3600, // $1 per hour
  },
  twilio: {
    sms_za: 0.0075, // ~$0.0075 per SMS in South Africa
  },
  whatsapp: {
    template: 0.02, // $0.02 per template message
    user_initiated: 0.005, // $0.005 per user-initiated message
  },
  deepgram: {
    nova: 0.0043 / 60, // $0.0043 per minute
  },
  google_tts: {
    standard: 4.0 / 1_000_000, // $4 per 1M characters
    wavenet: 16.0 / 1_000_000, // $16 per 1M characters
  },
};

// USD to ZAR exchange rate (static; could be fetched from API)
const USD_TO_ZAR = 18.5;

interface CostRecord {
  preschool_id: string | null;
  service_name: string;
  period_month: string;
  cost_usd: number;
  cost_zar: number;
  usage_units: Record<string, number>;
}

// Aggregate AI usage (Anthropic/OpenAI)
async function aggregateAICosts(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<CostRecord[]> {
  const { data: logs, error } = await supabase
    .from("ai_usage_logs")
    .select("preschool_id, provider, model, input_tokens, output_tokens, created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  if (error) throw error;

  const costsByPreschool = new Map<string, CostRecord>();

  for (const log of logs || []) {
    const key = `${log.preschool_id || "global"}_${log.provider}`;
    
    if (!costsByPreschool.has(key)) {
      costsByPreschool.set(key, {
        preschool_id: log.preschool_id,
        service_name: log.provider === "anthropic" ? "Anthropic Claude" : "OpenAI",
        period_month: startDate,
        cost_usd: 0,
        cost_zar: 0,
        usage_units: { input_tokens: 0, output_tokens: 0, requests: 0 },
      });
    }

    const record = costsByPreschool.get(key)!;
    record.usage_units.input_tokens += log.input_tokens || 0;
    record.usage_units.output_tokens += log.output_tokens || 0;
    record.usage_units.requests += 1;

    // Calculate cost based on provider and model
    if (log.provider === "anthropic") {
      const isHaiku = log.model?.includes("haiku");
      const inputRate = isHaiku ? PRICING.anthropic.haiku_input : PRICING.anthropic.sonnet_input;
      const outputRate = isHaiku ? PRICING.anthropic.haiku_output : PRICING.anthropic.sonnet_output;
      
      record.cost_usd += (log.input_tokens || 0) * inputRate;
      record.cost_usd += (log.output_tokens || 0) * outputRate;
    } else if (log.provider === "openai") {
      const isGpt4 = log.model?.includes("gpt-4");
      const inputRate = isGpt4 ? PRICING.openai.gpt4_input : PRICING.openai.gpt35_input;
      const outputRate = isGpt4 ? PRICING.openai.gpt4_output : PRICING.openai.gpt35_output;
      
      record.cost_usd += (log.input_tokens || 0) * inputRate;
      record.cost_usd += (log.output_tokens || 0) * outputRate;
    }
  }

  return Array.from(costsByPreschool.values()).map((record) => ({
    ...record,
    cost_zar: record.cost_usd * USD_TO_ZAR,
  }));
}

// Aggregate voice usage (Azure Speech/Deepgram/Google TTS)
async function aggregateVoiceCosts(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<CostRecord[]> {
  const { data: logs, error } = await supabase
    .from("voice_usage_logs")
    .select("preschool_id, service, operation, characters, duration_seconds, created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  if (error) throw error;

  const costsByPreschool = new Map<string, CostRecord>();

  for (const log of logs || []) {
    const key = `${log.preschool_id || "global"}_${log.service}`;
    
    if (!costsByPreschool.has(key)) {
      costsByPreschool.set(key, {
        preschool_id: log.preschool_id,
        service_name: log.service === "azure" ? "Azure Speech" : log.service === "deepgram" ? "Deepgram" : "Google TTS",
        period_month: startDate,
        cost_usd: 0,
        cost_zar: 0,
        usage_units: { characters: 0, minutes: 0, requests: 0 },
      });
    }

    const record = costsByPreschool.get(key)!;
    record.usage_units.characters += log.characters || 0;
    record.usage_units.minutes += (log.duration_seconds || 0) / 60;
    record.usage_units.requests += 1;

    // Calculate cost based on service
    if (log.service === "azure") {
      if (log.operation === "tts") {
        record.cost_usd += (log.characters || 0) * PRICING.azure_speech.tts;
      } else if (log.operation === "stt") {
        record.cost_usd += (log.duration_seconds || 0) * PRICING.azure_speech.stt;
      }
    } else if (log.service === "deepgram") {
      record.cost_usd += ((log.duration_seconds || 0) / 60) * PRICING.deepgram.nova;
    } else if (log.service === "google") {
      const isWavenet = log.operation?.includes("wavenet");
      const rate = isWavenet ? PRICING.google_tts.wavenet : PRICING.google_tts.standard;
      record.cost_usd += (log.characters || 0) * rate;
    }
  }

  return Array.from(costsByPreschool.values()).map((record) => ({
    ...record,
    cost_zar: record.cost_usd * USD_TO_ZAR,
  }));
}

// Aggregate SMS costs (Twilio)
async function aggregateSMSCosts(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<CostRecord[]> {
  const { data: messages, error } = await supabase
    .from("sms_messages")
    .select("preschool_id, status, created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .eq("status", "sent");

  if (error) throw error;

  const costsByPreschool = new Map<string, CostRecord>();

  for (const msg of messages || []) {
    const key = `${msg.preschool_id || "global"}_twilio`;
    
    if (!costsByPreschool.has(key)) {
      costsByPreschool.set(key, {
        preschool_id: msg.preschool_id,
        service_name: "Twilio SMS",
        period_month: startDate,
        cost_usd: 0,
        cost_zar: 0,
        usage_units: { messages: 0 },
      });
    }

    const record = costsByPreschool.get(key)!;
    record.usage_units.messages += 1;
    record.cost_usd += PRICING.twilio.sms_za;
  }

  return Array.from(costsByPreschool.values()).map((record) => ({
    ...record,
    cost_zar: record.cost_usd * USD_TO_ZAR,
  }));
}

// Aggregate WhatsApp costs
async function aggregateWhatsAppCosts(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<CostRecord[]> {
  const { data: logs, error } = await supabase
    .from("integration_audit_log")
    .select("preschool_id, integration_type, metadata, created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .eq("integration_type", "whatsapp");

  if (error) throw error;

  const costsByPreschool = new Map<string, CostRecord>();

  for (const log of logs || []) {
    const key = `${log.preschool_id || "global"}_whatsapp`;
    
    if (!costsByPreschool.has(key)) {
      costsByPreschool.set(key, {
        preschool_id: log.preschool_id,
        service_name: "WhatsApp Business",
        period_month: startDate,
        cost_usd: 0,
        cost_zar: 0,
        usage_units: { messages: 0, template: 0, user_initiated: 0 },
      });
    }

    const record = costsByPreschool.get(key)!;
    const isTemplate = log.metadata?.message_type === "template";
    
    record.usage_units.messages += 1;
    if (isTemplate) {
      record.usage_units.template += 1;
      record.cost_usd += PRICING.whatsapp.template;
    } else {
      record.usage_units.user_initiated += 1;
      record.cost_usd += PRICING.whatsapp.user_initiated;
    }
  }

  return Array.from(costsByPreschool.values()).map((record) => ({
    ...record,
    cost_zar: record.cost_usd * USD_TO_ZAR,
  }));
}

// Main handler
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get date range (default: current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    const startDate = startOfMonth.toISOString().split("T")[0];
    const endDate = endOfMonth.toISOString().split("T")[0];

    // Aggregate costs from all sources
    const [aiCosts, voiceCosts, smsCosts, whatsappCosts] = await Promise.all([
      aggregateAICosts(supabase, startDate, endDate),
      aggregateVoiceCosts(supabase, startDate, endDate),
      aggregateSMSCosts(supabase, startDate, endDate),
      aggregateWhatsAppCosts(supabase, startDate, endDate),
    ]);

    const allCosts = [...aiCosts, ...voiceCosts, ...smsCosts, ...whatsappCosts];

    // Upsert cost records
    if (allCosts.length > 0) {
      const { error: upsertError } = await supabase
        .from("service_cost_tracking")
        .upsert(allCosts, {
          onConflict: "preschool_id,service_name,period_month",
        });

      if (upsertError) throw upsertError;
    }

    // Calculate totals
    const totalUSD = allCosts.reduce((sum, c) => sum + c.cost_usd, 0);
    const totalZAR = allCosts.reduce((sum, c) => sum + c.cost_zar, 0);

    // Get top 3 services by cost
    const costsByService = new Map<string, number>();
    for (const cost of allCosts) {
      costsByService.set(
        cost.service_name,
        (costsByService.get(cost.service_name) || 0) + cost.cost_usd
      );
    }

    const top3 = Array.from(costsByService.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([service, cost]) => ({ service, cost_usd: cost, cost_zar: cost * USD_TO_ZAR }));

    return new Response(
      JSON.stringify({
        success: true,
        period: { start: startDate, end: endDate },
        records: allCosts.length,
        total_usd: totalUSD.toFixed(2),
        total_zar: totalZAR.toFixed(2),
        top_3_services: top3,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Cost aggregator error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
