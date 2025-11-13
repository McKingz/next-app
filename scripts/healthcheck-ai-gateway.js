/* Simple health check for ai-gateway Edge Function.
   Usage: node scripts/healthcheck-ai-gateway.js
   Requires: process.env.EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
*/

const urlBase = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
if (!urlBase) {
  console.error('Missing SUPABASE URL. Set EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL')
  process.exit(2)
}

async function main() {
  const url = `${urlBase}/functions/v1/ai-gateway`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'health' })
  })
  const json = await res.json().catch(() => ({}))
  if (res.ok && json && json.status === 'ok') {
    console.log('ai-gateway health: OK', json)
    process.exit(0)
  } else {
    console.error('ai-gateway health: FAIL', res.status, json)
    process.exit(1)
  }
}

main().catch((e) => { console.error('Health check error', e); process.exit(1) })