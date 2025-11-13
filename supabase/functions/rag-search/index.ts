// ==============================================================================
// RAG Search Edge Function
// ==============================================================================
// Performs semantic search over document chunks using vector embeddings
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import OpenAI from "npm:openai@4.20.1";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

const openai = new OpenAI({ apiKey: openaiApiKey });

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ==============================================================================
// Main Handler
// ==============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with user's auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request payload
    const payload = await req.json();
    const {
      query,
      conversation_id,
      top_k = 8,
      attachment_ids = null,
    } = payload;

    // Validate required parameters
    if (!query || !conversation_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: query and conversation_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Searching for: "${query}" in conversation: ${conversation_id}`);

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Call the match_rag_chunks RPC function
    // This function enforces RLS and filters by auth.uid()
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_rag_chunks",
      {
        query_embedding: queryEmbedding,
        match_count: top_k,
        filter_conversation_id: conversation_id,
        filter_attachment_ids: attachment_ids,
        min_content_length: 20,
      }
    );

    if (matchError) {
      console.error("Match error:", matchError);
      throw new Error(`Search failed: ${matchError.message}`);
    }

    console.log(`Found ${matches?.length ?? 0} matching chunks`);

    return new Response(
      JSON.stringify({
        matches: matches || [],
        query,
        conversation_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Search error:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});