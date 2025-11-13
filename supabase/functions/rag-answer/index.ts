// ==============================================================================
// RAG Answer Edge Function
// ==============================================================================
// Orchestrates RAG search and LLM response with citations
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
    const { conversation_id, message, top_k = 8, attachment_ids = null } = payload;

    // Validate required parameters
    if (!conversation_id || !message) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: conversation_id and message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`RAG Answer for: "${message}"`);

    // Step 1: Search for relevant chunks
    const searchUrl = new URL(
      "/functions/v1/rag-search",
      supabaseUrl
    );

    const searchResponse = await fetch(searchUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: message,
        conversation_id,
        top_k,
        attachment_ids,
      }),
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      throw new Error(
        `RAG search failed: ${errorData.error || searchResponse.statusText}`
      );
    }

    const { matches } = await searchResponse.json();

    // If no matches found, return a message indicating no relevant context
    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "I don't have any relevant information from your uploaded documents to answer this question. Please upload relevant documents or ask a different question.",
          citations: [],
          has_context: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Build context from matches
    const contextBlocks = matches.map(
      (m: any, i: number) =>
        `Source [${i + 1}] (attachment_id: ${m.attachment_id}, page: ${
          m.page ?? "?"
        }, chunk: ${m.chunk_index}):\n${m.content}`
    );
    const contextText = contextBlocks.join("\n\n");

    console.log(`Using ${matches.length} chunks for context`);

    // Step 3: Generate answer using LLM
    const systemPrompt = `You are Dash AI, an educational assistant that helps students understand their study materials.

Your task is to answer the student's question using ONLY the information provided in the source documents below. Follow these rules:

1. Answer based ONLY on the provided sources
2. Cite sources using [S#] notation (e.g., [S1], [S2])
3. If the sources don't contain enough information, say so clearly
4. Be concise but thorough
5. Format your response clearly with proper paragraphs
6. When referencing specific information, always cite the source
7. If math or formulas are involved, explain them clearly

Remember: You must not use any external knowledge. Only use information from the provided sources.`;

    const userPrompt = `Student's Question: ${message}

Sources:
${contextText}

Please answer the student's question based on the sources above. Remember to cite sources using [S#] notation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const answer = completion.choices[0]?.message?.content ?? "";

    // Step 4: Build citations array
    const citations = matches.map((m: any) => ({
      attachmentId: m.attachment_id,
      page: m.page || undefined,
      snippet: m.content.substring(0, 200) + (m.content.length > 200 ? "..." : ""),
      score: m.similarity,
      chunkIndex: m.chunk_index,
    }));

    console.log(`✅ Generated answer with ${citations.length} citations`);

    return new Response(
      JSON.stringify({
        answer,
        citations,
        has_context: true,
        chunks_used: matches.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ RAG Answer error:", error);

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