// ==============================================================================
// Ingest File Edge Function
// ==============================================================================
// Processes uploaded files for RAG: extracts text, chunks, embeds, and stores
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import OpenAI from "npm:openai@4.20.1";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

const openai = new OpenAI({ apiKey: openaiApiKey });

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Chunk text into overlapping segments
 */
function textChunks(
  text: string,
  chunkSize = 1200,
  overlap = 200
): string[] {
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));

    // Move to next chunk with overlap
    i = end - overlap;
    if (i < 0) i = 0;
    if (i >= text.length) break;
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Fetch file from Supabase Storage
 */
async function fetchFileArrayBuffer(
  bucket: string,
  path: string
): Promise<ArrayBuffer> {
  const storage = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await storage.storage
    .from(bucket)
    .createSignedUrl(path, 60);

  if (error) {
    throw new Error(`Signed URL failed: ${error.message}`);
  }

  const res = await fetch(data.signedUrl);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.statusText}`);
  }

  return await res.arrayBuffer();
}

/**
 * Extract text from PDF using pdfjs (Deno-compatible version)
 */
async function extractTextFromPDF(
  buf: ArrayBuffer
): Promise<{ text: string; pages: number }> {
  // For Deno, we'll use a simpler approach or external service
  // This is a placeholder - in production, consider using:
  // 1. PDF.js compiled for Deno
  // 2. External service like pdf-extract.com
  // 3. Cloud Vision API
  
  // Simple fallback for now
  console.warn("PDF extraction not fully implemented in Deno");
  return { text: "[PDF content - extraction pending]", pages: 1 };
}

/**
 * Extract text from DOCX using mammoth (Node Buffer compatible)
 */
async function extractTextFromDOCX(
  buf: ArrayBuffer
): Promise<{ text: string }> {
  // Mammoth requires Node.js Buffer
  // For Deno, we need to use a different approach
  // Consider using docx library or external service
  
  console.warn("DOCX extraction not fully implemented in Deno");
  return { text: "[DOCX content - extraction pending]" };
}

/**
 * Extract text from image using OpenAI Vision API
 */
async function extractTextFromImageWithOpenAI(
  mimeType: string,
  buf: ArrayBuffer
): Promise<string> {
  try {
    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(buf);
    const base64 = btoa(String.fromCharCode(...bytes));
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Extract all legible text and important math expressions verbatim from the image. Return plain text only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please extract all text from this image." },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content ?? "";
  } catch (error) {
    console.error("OCR error:", error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Generate embeddings for text chunks
 */
async function embedBatch(chunks: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks,
    });

    return response.data.map((d) => d.embedding);
  } catch (error) {
    console.error("Embedding error:", error);
    throw new Error(`Embedding failed: ${error.message}`);
  }
}

/**
 * Log ingestion event
 */
async function logIngestion(
  supabase: any,
  attachmentId: string,
  stage: string,
  message: string,
  level: "info" | "warn" | "error" = "info"
) {
  await supabase.from("rag_ingestion_logs").insert({
    attachment_id: attachmentId,
    stage,
    message,
    level,
  });
}

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request payload
    const payload = await req.json();
    const { user_id, conversation_id, bucket, storage_path, name, mime_type, size } = payload;

    // Verify user owns this upload
    if (user.id !== user_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: user_id mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing file: ${name} (${mime_type})`);

    // Create or update attachment record
    const { data: attachment, error: attachError } = await supabase
      .from("ai_attachments")
      .upsert(
        {
          user_id,
          conversation_id,
          bucket,
          storage_path,
          name,
          mime_type,
          size,
          status: "processing",
        },
        { onConflict: "storage_path" }
      )
      .select()
      .single();

    if (attachError) {
      throw new Error(`Failed to create attachment: ${attachError.message}`);
    }

    await logIngestion(supabase, attachment.id, "download", "Downloading file from storage");

    // Download file from storage
    const fileBuffer = await fetchFileArrayBuffer(bucket, storage_path);

    await logIngestion(supabase, attachment.id, "extract", `Extracting text from ${mime_type}`);

    // Extract text based on MIME type
    let text = "";
    let pages: number | null = null;

    if (mime_type === "application/pdf") {
      const result = await extractTextFromPDF(fileBuffer);
      text = result.text;
      pages = result.pages;
    } else if (
      mime_type.includes("word") ||
      mime_type.includes("officedocument.wordprocessingml.document")
    ) {
      const result = await extractTextFromDOCX(fileBuffer);
      text = result.text;
    } else if (mime_type.startsWith("text/")) {
      // Plain text files
      const decoder = new TextDecoder("utf-8");
      text = decoder.decode(new Uint8Array(fileBuffer));
    } else if (mime_type.startsWith("image/")) {
      // OCR using OpenAI Vision
      text = await extractTextFromImageWithOpenAI(mime_type, fileBuffer);
    } else {
      throw new Error(`Unsupported MIME type for ingestion: ${mime_type}`);
    }

    // Clean and normalize text
    const cleanText = text
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/ +/g, " ")
      .trim();

    if (cleanText.length === 0) {
      throw new Error("No text content extracted from file");
    }

    await logIngestion(
      supabase,
      attachment.id,
      "chunk",
      `Chunking ${cleanText.length} characters`
    );

    // Chunk text
    const chunks = textChunks(cleanText, 1200, 200);
    console.log(`Created ${chunks.length} chunks`);

    await logIngestion(supabase, attachment.id, "embed", `Generating embeddings for ${chunks.length} chunks`);

    // Generate embeddings
    const embeddings = await embedBatch(chunks);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from("rag_documents")
      .insert({
        attachment_id: attachment.id,
        user_id,
        conversation_id,
        title: name,
        status: "processing",
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to create document: ${docError.message}`);
    }

    await logIngestion(supabase, attachment.id, "store", `Storing ${chunks.length} chunks`);

    // Prepare chunk rows
    const chunkRows = chunks.map((content, index) => ({
      document_id: document.id,
      user_id,
      conversation_id,
      attachment_id: attachment.id,
      page: null, // TODO: track actual page numbers for PDFs
      chunk_index: index,
      start_char: null,
      end_char: null,
      token_count: null, // TODO: calculate token count
      content,
      embedding: embeddings[index],
    }));

    // Insert chunks in batches of 100
    const batchSize = 100;
    for (let i = 0; i < chunkRows.length; i += batchSize) {
      const batch = chunkRows.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("rag_chunks")
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
    }

    // Update attachment status to ready
    await supabase
      .from("ai_attachments")
      .update({
        status: "ready",
        page_count: pages,
        text_bytes: cleanText.length,
      })
      .eq("id", attachment.id);

    // Update document status to ready
    await supabase
      .from("rag_documents")
      .update({ status: "ready" })
      .eq("id", document.id);

    await logIngestion(supabase, attachment.id, "complete", "Ingestion completed successfully");

    console.log(`✅ Ingestion complete for ${name}`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        chunks_created: chunks.length,
        text_bytes: cleanText.length,
        pages: pages,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Ingestion error:", error);

    // Try to log error if we have attachment ID
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      });

      const payload = await req.json();
      if (payload.storage_path) {
        const { data: attachment } = await supabase
          .from("ai_attachments")
          .select("id")
          .eq("storage_path", payload.storage_path)
          .single();

        if (attachment) {
          await logIngestion(
            supabase,
            attachment.id,
            "error",
            error.message,
            "error"
          );

          await supabase
            .from("ai_attachments")
            .update({ status: "failed" })
            .eq("id", attachment.id);
        }
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

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