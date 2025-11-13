# Test Scripts Security Guidelines

⚠️ **IMPORTANT SECURITY NOTICE** ⚠️

## Environment Variables Required

Many test scripts require server-side environment variables. **NEVER** hardcode these values in scripts that will be committed to git.

### Required Environment Variables

For WhatsApp function testing:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key_here"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
```

For other tests:
```bash
export ANTHROPIC_API_KEY="your_api_key_here"
export WHATSAPP_ACCESS_TOKEN="your_token_here"
export WHATSAPP_PHONE_NUMBER_ID="your_phone_id_here"
```

## Security Best Practices

1. **Never commit secrets**: All test scripts should use `process.env.VARIABLE_NAME`
2. **Use .env.local**: Create a `.env.local` file (gitignored) for local testing
3. **Service role keys**: Only use these for server-side testing, never in client code
4. **Rotate tokens**: Regularly rotate API keys and tokens

## Safe Script Pattern

```javascript
#!/usr/bin/env node

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Always validate environment variables
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Rest of script...
```

## Running Tests

1. Set up your environment variables
2. Run the specific test script:
   ```bash
   node scripts/test-whatsapp-complete.js
   ```

## Files That Should Never Be Committed

- `.env.local` - Local environment variables
- Any script with hardcoded API keys or tokens
- Database dumps with real user data

## If You Accidentally Commit Secrets

1. **Immediately rotate the exposed keys/tokens**
2. Remove them from git history:
   ```bash
   git filter-branch --tree-filter 'git rm -f --ignore-unmatch filename' HEAD
   ```
3. Force push the cleaned history
4. Notify the team if it's a shared repository