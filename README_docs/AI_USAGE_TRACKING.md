# AI Usage Tracking & Rate Limiting System

## Overview

This system tracks and limits AI feature usage to prevent API credit exhaustion while providing a clear upgrade path for users.

## Features

- **Per-User Quotas**: Track exam generations, explanations, and chat messages
- **Tiered Limits**: Different limits for Free, Trial, Basic, and Premium users
- **Automatic Resets**: Monthly reset for exams/explanations, daily reset for chat
- **PayFast Integration**: Seamless subscription payments
- **Usage Analytics**: Track all AI requests for debugging and optimization

## Database Tables

### 1. `user_ai_usage`
Tracks current usage for each user:
- `exams_generated_this_month`: Counter reset monthly
- `explanations_requested_this_month`: Counter reset monthly
- `chat_messages_today`: Counter reset daily
- `current_tier`: User's subscription tier
- `last_monthly_reset_at`: Last monthly reset timestamp
- `last_daily_reset_at`: Last daily reset timestamp

### 2. `ai_usage_tiers`
Defines limits for each subscription tier:
- `tier_name`: free, trial, basic, premium, school
- `exams_per_month`: Monthly exam generation limit
- `explanations_per_month`: Monthly explanation limit
- `chat_messages_per_day`: Daily chat message limit
- `monthly_price_zar`: Subscription price

### 3. `ai_request_log`
Logs all AI requests for analytics:
- `user_id`: User making the request
- `request_type`: exam_generation, explanation, or chat_message
- `status`: success, failed, or rate_limited
- `response_time_ms`: Performance tracking
- `metadata`: Additional context

### 4. `subscriptions`
Tracks PayFast subscriptions:
- `user_id`: User's subscription
- `tier`: Subscription tier
- `status`: active, cancelled, or expired
- `payment_id`: PayFast payment reference
- `subscription_start/end`: Billing period

## Usage Limits

### Free Tier (R0/month)
- 3 AI-generated exams per month
- 5 AI explanations per month
- 10 chat messages per day

### Trial Tier (R0/month - limited time)
- 10 AI-generated exams per month
- 20 AI explanations per month
- 50 chat messages per day

### Basic Tier (R99/month)
- 30 AI-generated exams per month
- 100 AI explanations per month
- 200 chat messages per day

### Premium Tier (R299/month)
- 100 AI-generated exams per month
- 500 AI explanations per month
- 1000 chat messages per day
- Priority AI processing

### School Tier (Custom pricing)
- Unlimited AI generations
- Unlimited explanations
- Unlimited chat messages
- Dedicated support

## Frontend Integration

### Using the `useAIQuota` Hook

```tsx
import { useAIQuota } from '@/lib/hooks/useAIQuota';

function ExamBuilder() {
  const { withQuotaCheck, usage } = useAIQuota();

  const generateExam = async () => {
    const result = await withQuotaCheck(
      'exam_generation',
      async () => {
        // Your exam generation logic
        return await createExam();
      },
      (quotaStatus) => {
        // Custom quota exceeded handler
        alert(`Out of exams! ${quotaStatus.remaining} left.`);
      }
    );

    if (result) {
      console.log('Exam generated:', result);
    }
  };

  return (
    <div>
      <p>Used: {usage?.exams_generated_this_month} exams this month</p>
      <button onClick={generateExam}>Generate Exam</button>
    </div>
  );
}
```

### Showing Quota Warnings

```tsx
import { AIQuotaWarning } from '@/components/ai/AIQuotaWarning';

function ExamPage() {
  return (
    <div>
      <AIQuotaWarning requestType="exam_generation" />
      {/* Rest of your page */}
    </div>
  );
}
```

## Backend Integration

### Database Functions

#### `check_ai_usage_limit(user_id, request_type)`
Checks if user can make an AI request:

```sql
SELECT * FROM check_ai_usage_limit(
  '123e4567-e89b-12d3-a456-426614174000'::uuid,
  'exam_generation'
);

-- Returns:
{
  "allowed": true,
  "remaining": 8,
  "limit": 10,
  "current_tier": "trial",
  "upgrade_available": true
}
```

#### `increment_ai_usage(user_id, request_type, status, metadata)`
Increments usage counter after request:

```sql
SELECT increment_ai_usage(
  '123e4567-e89b-12d3-a456-426614174000'::uuid,
  'exam_generation',
  'success',
  '{"exam_id": "abc123"}'::jsonb
);
```

## PayFast Integration

### Setup

1. Add PayFast credentials to `.env`:
```bash
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase
NEXT_PUBLIC_PAYFAST_URL=https://sandbox.payfast.co.za/eng/process
```

2. Configure PayFast webhooks to point to:
```
https://your-domain.com/api/payfast/webhook
```

### Payment Flow

1. User clicks "Upgrade" button
2. Frontend calls `/api/payfast/create-payment`
3. User redirected to PayFast payment page
4. After payment:
   - Success: `/dashboard/parent/upgrade/success`
   - Cancel: `/dashboard/parent/upgrade/cancel`
5. PayFast sends webhook to `/api/payfast/webhook`
6. Webhook updates user tier in database
7. User gains access to upgraded limits

## Migration

Apply the migration to set up all tables and functions:

```bash
psql "postgresql://user:pass@host:port/database" \
  -f supabase/migrations/20251112000000_ai_usage_tracking.sql
```

## Monitoring

### Check User Usage
```sql
SELECT * FROM user_ai_usage WHERE user_id = 'your_user_id';
```

### View Request Logs
```sql
SELECT * FROM ai_request_log 
WHERE user_id = 'your_user_id' 
ORDER BY created_at DESC 
LIMIT 100;
```

### Analytics Queries
```sql
-- Most active users
SELECT user_id, total_exams_generated, total_chat_messages
FROM user_ai_usage
ORDER BY total_exams_generated DESC
LIMIT 10;

-- Success rate by request type
SELECT 
  request_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  ROUND(AVG(response_time_ms)) as avg_response_ms
FROM ai_request_log
GROUP BY request_type;

-- Rate limit hits
SELECT DATE(created_at), COUNT(*)
FROM ai_request_log
WHERE status = 'rate_limited'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

## Testing Strategy

### For 20 Testers with $10 API Credit

1. **Set Free Tier Limits Low**: 3 exams/month keeps costs down
2. **Monitor Usage**: Track in `ai_request_log` table
3. **Grant Trial Access**: Give active testers trial tier (10 exams/month)
4. **Estimated Costs**:
   - 3 exams × 20 users = 60 exams
   - ~$0.50 per exam = $30 total
   - With explanations: ~$50-60 total
5. **Safety Net**: Rate limits prevent runaway costs

## Troubleshooting

### User Can't Generate Exams
1. Check their current tier: `SELECT current_tier FROM user_ai_usage WHERE user_id = ?`
2. Check usage: `SELECT exams_generated_this_month FROM user_ai_usage WHERE user_id = ?`
3. Manually reset if needed: `UPDATE user_ai_usage SET exams_generated_this_month = 0 WHERE user_id = ?`

### Quota Not Resetting
Check reset timestamps:
```sql
SELECT 
  user_id,
  last_monthly_reset_at,
  last_daily_reset_at,
  NOW() - last_monthly_reset_at as days_since_monthly_reset
FROM user_ai_usage;
```

### PayFast Webhook Not Working
1. Check webhook logs: `SELECT * FROM ai_request_log WHERE metadata->>'source' = 'payfast'`
2. Verify signature validation in logs
3. Test webhook with PayFast sandbox
4. Ensure webhook URL is publicly accessible

## Security Considerations

- ✅ All database functions use `SECURITY DEFINER`
- ✅ RLS policies prevent users from manipulating their own quotas
- ✅ PayFast signatures verified on all webhook requests
- ✅ Service role required for tier upgrades
- ✅ Request logs help identify abuse patterns

## Future Enhancements

- [ ] Email notifications when approaching limits
- [ ] Grace period after limit exceeded (1-2 extra requests)
- [ ] Family plans with shared quotas
- [ ] Annual subscription discounts
- [ ] Usage analytics dashboard for users
- [ ] Automatic tier downgrade on cancellation
