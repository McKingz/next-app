// Supabase Edge Function: payments-bridge
// Serves return/cancel bridge pages that deep-link back into the app
// Path examples:
//  - /functions/v1/payments-bridge/return
//  - /functions/v1/payments-bridge/cancel
// Optional query params are preserved and forwarded to the app deep link.

import { serve } from 'https://deno.fresh.land/std/http/server.ts';

function html(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function buildDeepLink(path: 'return' | 'cancel', search: string) {
  const base = 'edudashpro://screens/payments/';
  return `${base}${path}${search ? search : ''}`;
}

function page(title: string, message: string, deeplink: string) {
  // Tries multiple redirect strategies for different Android browsers.
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; margin: 0; background: #0b1220; color: #fff; display: grid; place-items: center; min-height: 100vh; }
  .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 24px; max-width: 560px; text-align: center; }
  .btn { display:inline-block; margin-top:16px; padding:12px 18px; background:#00f5ff; color:#000; border-radius:8px; font-weight:700; text-decoration:none; }
  .sub { opacity: .8; font-size: 14px; margin-top: 8px; }
</style>
<script>
  const deeplink = ${JSON.stringify(deeplink)};
  // Attempt immediate redirect
  window.location.replace(deeplink);
  // Fallback strategies
  setTimeout(() => { window.location.href = deeplink; }, 300);
</script>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" href="${deeplink}">Open EduDash Pro</a>
    <p class="sub">If the app doesn't open automatically, tap the button above.</p>
  </div>
</body>
</html>`;
}

serve((req) => {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    // Expect .../payments-bridge/<action>
    const action = (parts.pop() || '').toLowerCase();
    const search = url.search || '';

    if (action === 'return' || action === 'cancel') {
      const deeplink = buildDeepLink(action as 'return' | 'cancel', search);
      const title = action === 'return' ? 'Payment Complete' : 'Payment Cancelled';
      const msg = action === 'return' ? 'Your payment was processed. Returning to EduDash Pro…' : 'Payment cancelled. Returning to EduDash Pro…';
      return html(page(title, msg, deeplink));
    }

    return html(page('Payments', 'Unknown payments action.', 'edudashpro://'), 404);
  } catch (e) {
    return html('<h1>Payments Bridge Error</h1>', 500);
  }
});
