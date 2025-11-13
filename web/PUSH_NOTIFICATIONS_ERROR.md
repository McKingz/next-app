# 🔔 Push Notifications Error

## Error Observed:

```
POST https://edudashpro.org.za/api/notifications/subscribe 500 (Internal Server Error)
```

## Location:

`/api/notifications/subscribe` endpoint

## Investigation Needed:

The error is happening when the app tries to subscribe to deployment notifications. This is a **separate issue** from the exam generation problem.

## Possible Causes:

1. **Database constraint violation** on `push_subscriptions` table
   - The logs show a 400 error from Supabase REST API
   - Using `on_conflict=endpoint` parameter
   - Might be a duplicate entry issue

2. **RLS Policy** blocking the insert
   - User might not have permission to insert into `push_subscriptions`

3. **Missing required fields** in the subscription object

## Quick Fix:

### Check the RLS policy on `push_subscriptions`:

```sql
-- Check existing policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'push_subscriptions';
```

### Add or update RLS policy:

```sql
-- Allow users to insert/update their own push subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
ON push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- OR allow service role to bypass RLS for this table
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all push subscriptions"
ON push_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

## Non-Critical:

This error **does not prevent exam generation** or core functionality. It's just preventing push notifications from working.

You can ignore it for now and focus on testing exam generation first.

---

**Priority**: Low  
**Impact**: Push notifications won't work  
**Workaround**: None needed - app works without push notifications
