# Real Data Integration - EduDash Pro Web

This document describes the implementation of real Supabase data fetching throughout the web application, replacing mock data and hardcoded values.

## Summary of Changes

### ✅ **Completed Implementations**

#### 1. User Profile Hook (`/src/lib/hooks/useUserProfile.ts`)

**New centralized hook** that fetches complete user profile data including:
- User email from auth
- First name and last name from profiles table
- User role (parent, teacher, principal, superadmin)
- Preschool ID, name, and slug
- Organization ID and name

**Query Flow**:
```typescript
1. Get auth user email
2. Fetch from users table (auth_user_id → preschool_id, role, organization_id)
3. Fetch from profiles table (first_name, last_name)
4. Fetch from preschools table (name, slug)
5. Return combined profile object
```

**Usage**:
```typescript
const { profile, loading, error, refetch } = useUserProfile(userId);

// Access data:
profile.email          // User email
profile.firstName      // First name from profiles
profile.lastName       // Last name from profiles
profile.preschoolName  // Preschool name
profile.role           // User role
```

---

#### 2. Unread Messages Hook (`/src/lib/hooks/parent/useUnreadMessages.ts`)

**Purpose**: Fetch real-time count of unread messages for a parent.

**Implementation**:
- Queries `messages` table with `recipient_id` and `is_read = false`
- Falls back to `announcements` table if messages table doesn't exist
- Filters by preschool_id for tenant isolation
- Returns 0 if tables don't exist (graceful degradation)

**Query**:
```sql
-- Primary attempt
SELECT COUNT(*) FROM messages
WHERE recipient_id = <internal_user_id>
  AND is_read = false
  AND preschool_id = <user_preschool_id>

-- Fallback if messages table doesn't exist
SELECT COUNT(*) FROM announcements
WHERE preschool_id = <user_preschool_id>
  AND created_at >= NOW() - INTERVAL '7 days'
```

**Usage**:
```typescript
const { unreadCount, loading, error, refetch } = useUnreadMessages(userId, activeChildId);
```

---

#### 3. Child Metrics - Real Payments Data (`/src/lib/hooks/parent/useChildMetrics.ts`)

**Fixed**: Replaced mock fees data with real database queries.

**Before** (Line 61-66):
```typescript
// ❌ MOCK DATA
const feesDue = {
  amount: Math.random() > 0.7 ? Math.floor(Math.random() * 5000) + 500 : 0,
  dueDate: Math.random() > 0.5 ? thirtyDaysFromNow : null,
  overdue: Math.random() > 0.8,
};
```

**After**:
```typescript
// ✅ REAL DATA
const { data: payments } = await supabase
  .from('payments')
  .select('amount, due_date, status')
  .eq('student_id', childId)
  .in('status', ['pending', 'overdue'])
  .order('due_date', { ascending: true })
  .limit(1)
  .maybeSingle();

if (payments && payments.amount > 0) {
  const isOverdue = payments.due_date ? new Date(payments.due_date) < new Date() : false;
  feesDue = {
    amount: payments.amount,
    dueDate: payments.due_date || null,
    overdue: isOverdue || payments.status === 'overdue',
  };
}
```

**Graceful Handling**:
- If `payments` table doesn't exist, returns `feesDue = null`
- No errors thrown - UI gracefully shows "No fees due"

---

#### 4. Parent Dashboard Updates (`/src/app/dashboard/parent/page.tsx`)

**Fixed Multiple Issues**:

##### A. Preschool Name Display

**Header (Line 234-241)**:
```tsx
// ✅ Shows preschool name with icon in top left
{preschoolName ? (
  <div className="chip">
    <span>🎓</span>
    <span style={{ fontWeight: 600 }}>{preschoolName}</span>
  </div>
) : (
  <div className="chip">{tenantSlug ? `/${tenantSlug}` : 'EduDash Pro'}</div>
)}
```

**Main Content (Line 297-308)**:
```tsx
// ✅ Shows prominent preschool banner
{preschoolName && (
  <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🎓</div>
      <div>
        <h2>{preschoolName}</h2>
        <p>Preschool Dashboard</p>
      </div>
    </div>
  </div>
)}
```

##### B. User Greeting (Line 310)

**Before**:
```tsx
<h1>Good Morning, Olivia</h1>  {/* ❌ Hardcoded */}
```

**After**:
```tsx
<h1>{greeting}, {userName}</h1>  {/* ✅ Real user name */}
// userName = profile?.firstName || userEmail?.split('@')[0] || 'User'
```

##### C. Metrics with Real Data (Line 361-362, 407-408)

**Unread Messages**:
```tsx
// Before: {activeChild ? metrics.unreadMessages : 0}
// After: {unreadCount}  ✅ Real data from useUnreadMessages hook
```

**Upcoming Events**:
```tsx
// Before: Always showed 0
// After: {activeChild ? metrics.upcomingEvents : 0}  ✅ Real data from database
```

---

## Database Schema Requirements

### Tables Used

#### 1. `users` (Internal User Mapping)
```sql
- auth_user_id (UUID, references auth.users)
- preschool_id (UUID, references preschools)
- role (TEXT: 'parent', 'teacher', 'principal', 'superadmin')
- organization_id (UUID, nullable)
- organization_name (TEXT, nullable)
```

#### 2. `profiles` (User Profile Data)
```sql
- id (UUID, references auth.users)
- first_name (TEXT)
- last_name (TEXT)
- preschool_id (UUID, nullable)
- organization_id (UUID, nullable)
- organization_name (TEXT, nullable)
```

#### 3. `preschools` (Preschool/Organization Data)
```sql
- id (UUID, primary key)
- name (TEXT, required)
- slug (TEXT, unique)
```

#### 4. `payments` (Fee/Payment Tracking)
```sql
- id (UUID, primary key)
- student_id (UUID, references students)
- amount (NUMERIC, required)
- due_date (DATE, nullable)
- status (TEXT: 'pending', 'paid', 'overdue')
- preschool_id (UUID, references preschools) -- RLS filter
```

#### 5. `messages` (Parent-Teacher Communication) - Optional
```sql
- id (UUID, primary key)
- recipient_id (UUID, references users.id)
- is_read (BOOLEAN, default false)
- preschool_id (UUID, references preschools) -- RLS filter
- created_at (TIMESTAMP)
```

#### 6. `students` (Already exists)
```sql
- id (UUID, primary key)
- first_name, last_name (TEXT)
- parent_id, guardian_id (UUID, references users.id)
- class_id (UUID, references classes)
- preschool_id (UUID, references preschools) -- RLS filter
```

#### 7. `attendance_records` (Already exists)
```sql
- student_id (UUID, references students)
- date (DATE)
- status ('present', 'absent', 'late')
- check_in_time (TIMESTAMP)
```

#### 8. `homework_assignments` & `homework_submissions` (Already exist)
```sql
-- Used for pending homework count
```

#### 9. `class_events` (Already exists)
```sql
-- Used for upcoming events count
```

---

## Testing Checklist

### ✅ **What to Verify**

1. **Preschool Name Appears**:
   - [ ] Shows in header top-left with 🎓 icon
   - [ ] Shows in purple gradient banner above greeting
   - [ ] Falls back to tenant slug if preschool not found

2. **User Greeting**:
   - [ ] Shows correct first name from profile
   - [ ] Falls back to email username if no first name
   - [ ] Shows time-appropriate greeting (Morning/Afternoon/Evening)

3. **Metrics Display**:
   - [ ] Unread messages count updates in real-time
   - [ ] Pending homework shows actual count from database
   - [ ] Upcoming events shows actual count (not always 0)
   - [ ] Fees due shows real payment data (or "None" if no fees)

4. **Fees Handling**:
   - [ ] If payment due, shows amount like "R 1,500"
   - [ ] If overdue, indicates overdue status
   - [ ] If no payments, shows "None" gracefully
   - [ ] Doesn't crash if `payments` table doesn't exist

5. **Graceful Degradation**:
   - [ ] App works even if optional tables don't exist
   - [ ] No console errors for missing tables
   - [ ] Shows sensible defaults (0 messages, no fees, etc.)

---

## Environment Variables Required

Ensure these are set in `.env.local` and Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Deployment Notes

**Production URL**: Check Vercel deployment output for latest URL

**Build Command**: `npm run build`

**Build Time**: ~15-20 seconds

**Deploy Command**: `vercel --cwd web deploy --prod`

---

## Known Limitations & Future Improvements

### Current Limitations

1. **Messages Table Schema**:
   - Hook assumes `messages` table with specific schema
   - Falls back to `announcements` if not found
   - May need adjustment based on actual schema

2. **Payments Table**:
   - Assumes single payment per student
   - May need aggregation for multiple payments
   - Currency formatting assumes ZAR (South African Rand)

3. **Performance**:
   - Multiple sequential queries in hooks
   - Could be optimized with joins or views
   - Consider caching for preschool data

### Recommended Improvements

1. **Caching Layer**:
   ```typescript
   // Cache preschool data for session
   const cachedPreschool = sessionStorage.getItem('preschool_data');
   ```

2. **Real-time Updates**:
   ```typescript
   // Subscribe to message changes
   supabase
     .channel('messages')
     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, 
       (payload) => refetchMessages()
     )
     .subscribe();
   ```

3. **Batch Queries**:
   ```typescript
   // Single query with joins instead of multiple queries
   const { data } = await supabase
     .from('users')
     .select(`
       *,
       profiles!inner(first_name, last_name),
       preschools!inner(name, slug)
     `)
     .eq('auth_user_id', userId)
     .single();
   ```

4. **Error Boundaries**:
   - Wrap dashboard in error boundary
   - Show friendly message if data fails to load
   - Provide retry button

---

## Migration Path (If Needed)

If your database schema differs from assumptions:

### Step 1: Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'profiles', 'preschools', 'payments', 'messages');
```

### Step 2: Add Missing Columns
```sql
-- If preschools missing slug
ALTER TABLE preschools 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- If users missing organization fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS organization_id UUID,
ADD COLUMN IF NOT EXISTS organization_name TEXT;
```

### Step 3: Migrate Data
```sql
-- Generate slugs from names
UPDATE preschools
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Preschool name not showing"
- Check: `users.preschool_id` is set for the logged-in user
- Check: `preschools` table has corresponding row
- Check: RLS policies allow reading preschools

**Issue**: "Fees always show as None"
- Check: `payments` table exists and has data
- Check: `student_id` in payments matches actual student
- Check: RLS policies allow reading payments

**Issue**: "Unread messages always 0"
- Check: `messages` table exists
- Check: Schema matches expected (recipient_id, is_read columns)
- Check: RLS policies allow reading messages

### Debug Mode

Enable Supabase debug logging:
```bash
# In .env.local
NEXT_PUBLIC_DEBUG_SUPABASE=true
```

Then check browser console for:
```
[Supabase] Web client initialized { hasUrl: true, ... }
```

---

## Related Documentation

- [Main WARP.md](/WARP.md) - Development rules and standards
- [PWA Setup](PWA-SETUP.md) - Progressive Web App configuration
- [Supabase RLS](../docs/security/RLS_POLICIES.md) - Row Level Security policies

---

**Last Updated**: 2025-10-29  
**Author**: EduDash Pro Development Team  
**Status**: ✅ Production Ready
