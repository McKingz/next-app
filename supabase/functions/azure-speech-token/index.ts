// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: azure-speech-token
// Issues a short-lived Azure Speech authorization token to the client.
// Requires secrets: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

serve(async (_req: Request) => {
  const key = (globalThis as any).Deno?.env?.get('AZURE_SPEECH_KEY');
  const region = (globalThis as any).Deno?.env?.get('AZURE_SPEECH_REGION');
  if (!key || !region) {
    return json({ error: 'missing_azure_config' }, { status: 500 });
  }

  try {
    const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json({ error: 'azure_token_failed', status: res.status, details: text }, { status: 500 });
    }
    const token = await res.text();
    // Azure tokens typically valid ~10 minutes
    return json({ token, region, expiresIn: 600 });
  } catch (e) {
    return json({ error: 'azure_token_exception', details: String(e) }, { status: 500 });
  }
});
