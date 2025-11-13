# Parent Preschool Linking & Principal Approval Visibility

## Issue Summary

When a parent joins a school, the school name may not appear in their dashboard, and principals/admins may not see pending parent approval requests.

## Root Causes Identified

### 1. **Deprecated `users` Table References**
The codebase was still querying the deprecated `users` table instead of `profiles` table in the parent dashboard (line 171-178 of `parent/dashboard/page.tsx`).

**Rule Context**: Per `WARP.md`, the `users` table is **DEPRECATED** and all queries must use the `profiles` table.

### 2. **Missing Preschool Data**
When a parent registers, their `profiles.preschool_id` may not be set properly, causing:
- School name not to appear in parent dashboard topbar
- Pending requests not to show in principal's `ParentApprovalWidget`

### 3. **Insufficient Debugging**
Console errors showed "user profile not found in users table" but the root cause (missing preschool_id or wrong table) was not immediately obvious.

## Fixes Applied

### Fix 1: Use `profiles` Table Instead of Deprecated `users` Table

**File**: `src/app/dashboard/parent/page.tsx`

**Changed (lines 169-178)**:
```typescript
// ❌ OLD - querying deprecated users table
const { data: internal } = await sb
  .from('users')
  .select('id, preschool_id')
  .eq('auth_user_id', userId)
  .maybeSingle();

// ✅ NEW - querying profiles table
const { data: internal } = await sb
  .from('profiles')
  .select('id, preschool_id')
  .eq('id', userId)
  .maybeSingle();
```

### Fix 2: Better Visual Feedback for Missing Preschool

**File**: `src/app/dashboard/parent/page.tsx`

**Changed (lines 289-306)**:
```typescript
// ✅ Show different states clearly
{preschoolName ? (
  <div className="chip">
    <span>🎓</span>
    <span>{preschoolName}</span>
  </div>
) : profile?.preschoolId ? (
  <div className="chip warning">
    <span>⚠️</span>
    <span>School Info Loading...</span>
  </div>
) : (
  <div className="chip warning">
    <span>⚠️</span>
    <span>No School Linked</span>
  </div>
)}
```

### Fix 3: Enhanced Console Logging for Debugging

**File**: `src/lib/hooks/useUserProfile.ts`

**Added diagnostic logging**:
```typescript
// ✅ Profile validation
if (!profileData) {
  console.warn('⚠️ No profile found for user:', userId);
  console.warn('⚠️ User may need to complete registration or profile is missing');
} else if (!profileData.preschool_id) {
  console.warn('⚠️ Profile found but NO preschool_id:', profileData);
  console.warn('⚠️ User needs to be linked to a school');
} else {
  console.log('✅ Profile loaded:', {
    userId,
    role: profileData.role,
    preschoolId: profileData.preschool_id,
    name: `${profileData.first_name} ${profileData.last_name}`
  });
}

// ✅ Preschool validation
if (preschoolError) {
  console.error('❌ Preschool fetch error:', preschoolError);
}

if (!preschoolData) {
  console.warn('⚠️ No preschool found with ID:', preschoolId);
  console.warn('⚠️ Preschool may have been deleted or ID is invalid');
} else {
  console.log('✅ Preschool loaded:', preschoolData.name);
}
```

## How the System Works

### Parent Registration Flow

1. **Parent creates account** → `profiles` table entry created with `auth.uid()` as `id`
2. **Parent searches for child** → Uses `claim-child` page with preschool filter
3. **Parent submits link request** → `guardian_requests` table entry created:
   ```sql
   INSERT INTO guardian_requests (
     parent_auth_id,  -- profiles.id (same as auth.uid())
     student_id,
     child_full_name,
     status,          -- 'pending'
     school_id,       -- preschool_id
     created_at
   ) VALUES (...)
   ```
4. **Principal sees request** → `ParentApprovalWidget` queries:
   ```sql
   SELECT * FROM guardian_requests
   WHERE school_id = preschool_id
     AND status = 'pending'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

### Principal Dashboard Visibility

The `ParentApprovalWidget` (located in principal dashboard right sidebar) automatically shows:
- ✅ All pending `guardian_requests` for the principal's preschool
- ✅ Parent name and email (from `profiles` table)
- ✅ Child name (from `guardian_requests.child_full_name`)
- ✅ Approve/Reject buttons

**Widget appears**: Right sidebar of `/dashboard/principal` page (line 182)

## Troubleshooting Guide

### Issue: Parent's School Name Not Showing

**Symptoms**:
- Parent dashboard shows "⚠️ No School Linked" or "⚠️ School Info Loading..."
- Console shows: "⚠️ Profile found but NO preschool_id"

**Diagnosis**:
```sql
-- Check parent's profile
SELECT id, email, first_name, last_name, preschool_id, role
FROM profiles
WHERE id = 'parent_auth_id';

-- Check if preschool exists
SELECT id, name FROM preschools WHERE id = 'preschool_id';
```

**Solutions**:
1. **Missing preschool_id**: Update parent's profile:
   ```sql
   UPDATE profiles
   SET preschool_id = 'actual_preschool_id'
   WHERE id = 'parent_auth_id';
   ```

2. **Invalid preschool_id**: Check if preschool was deleted:
   ```sql
   -- Find valid preschools
   SELECT id, name FROM preschools;
   
   -- Update to valid preschool
   UPDATE profiles
   SET preschool_id = 'valid_preschool_id'
   WHERE id = 'parent_auth_id';
   ```

### Issue: Principal Not Seeing Pending Requests

**Symptoms**:
- `ParentApprovalWidget` doesn't appear in principal dashboard right sidebar
- Console shows no errors

**Diagnosis**:
```sql
-- Check if requests exist
SELECT 
  gr.id,
  gr.status,
  gr.school_id,
  gr.parent_auth_id,
  gr.child_full_name,
  p.email as parent_email
FROM guardian_requests gr
LEFT JOIN profiles p ON p.id = gr.parent_auth_id
WHERE gr.school_id = 'preschool_id'
  AND gr.status = 'pending';
```

**Solutions**:
1. **Wrong school_id**: Requests were created with incorrect `school_id`:
   ```sql
   -- Fix school_id mismatch
   UPDATE guardian_requests
   SET school_id = 'correct_preschool_id'
   WHERE parent_auth_id = 'parent_auth_id'
     AND status = 'pending';
   ```

2. **No requests created**: Parent hasn't submitted a child link request yet
   - Guide parent to `/dashboard/parent/claim-child`
   - Parent must search for child and click "Claim Child"

3. **Status not 'pending'**: Requests may have already been processed
   ```sql
   -- Check all statuses
   SELECT status, COUNT(*) 
   FROM guardian_requests 
   WHERE school_id = 'preschool_id'
   GROUP BY status;
   ```

### Issue: "user profile not found in users table" Error

**Symptoms**:
- Console error: `⚠️ user profile not found in users table for auth_user_id: ...`

**Cause**: Code was querying deprecated `users` table

**Solution**: ✅ Already fixed in this PR - now uses `profiles` table

## Testing Checklist

After applying fixes, verify:

### Parent Dashboard
- [ ] Parent can see their linked school name in topbar (🎓 School Name)
- [ ] If no preschool linked, shows "⚠️ No School Linked"
- [ ] Console shows "✅ Profile loaded" with correct preschool_id
- [ ] Console shows "✅ Preschool loaded: [School Name]"

### Child Linking Flow
- [ ] Parent can search for children at their school
- [ ] "Claim Child" button creates `guardian_requests` entry
- [ ] Request has correct `school_id` matching parent's `preschool_id`
- [ ] Request status is 'pending'

### Principal Dashboard
- [ ] `ParentApprovalWidget` appears in right sidebar if pending requests exist
- [ ] Widget shows correct count of pending requests
- [ ] Each request displays parent name, email, and child name
- [ ] "Approve" button updates status to 'approved' and removes from list
- [ ] "Reject" button updates status to 'rejected' and removes from list

### Database Validation
```sql
-- Verify parent profile
SELECT id, email, first_name, last_name, preschool_id, role
FROM profiles
WHERE role = 'parent'
LIMIT 5;

-- Verify pending requests match preschool
SELECT 
  gr.id,
  gr.status,
  gr.school_id,
  p.preschool_id as parent_preschool_id,
  CASE 
    WHEN gr.school_id = p.preschool_id THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as validation
FROM guardian_requests gr
JOIN profiles p ON p.id = gr.parent_auth_id
WHERE gr.status = 'pending';
```

## Related Files

### Modified Files
- ✅ `src/app/dashboard/parent/page.tsx` - Fixed `users` → `profiles` table reference
- ✅ `src/lib/hooks/useUserProfile.ts` - Added diagnostic logging

### Related Components
- `src/components/dashboard/principal/ParentApprovalWidget.tsx` - Shows pending requests
- `src/app/dashboard/parent/claim-child/page.tsx` - Parent child linking flow
- `src/app/dashboard/principal/page.tsx` - Principal dashboard (includes widget)

## Database Schema Reference

### Key Tables

**profiles** (primary user table):
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,              -- auth.uid()
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,                        -- 'parent', 'teacher', 'principal', 'superadmin'
  preschool_id UUID,                -- Foreign key to preschools
  organization_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**guardian_requests** (child link requests):
```sql
CREATE TABLE guardian_requests (
  id UUID PRIMARY KEY,
  parent_auth_id UUID,              -- References profiles.id
  student_id UUID,                  -- References students.id
  child_full_name TEXT,
  relationship TEXT,
  status TEXT,                      -- 'pending', 'approved', 'rejected'
  school_id UUID,                   -- References preschools.id
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ
);
```

**preschools**:
```sql
CREATE TABLE preschools (
  id UUID PRIMARY KEY,
  name TEXT,
  subscription_plan TEXT,           -- 'free', 'starter', 'professional', 'enterprise'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Migration Context

This fix aligns with the governance rule:
> **ALWAYS** use `profiles` table for user data (NOT `users` table). The `users` table is **DEPRECATED** and being phased out.

**Reference**: See `WARP.md` User Data Architecture section and rule `XGf8LSEKa41lefYFmlMJ3P`.

## Next Steps

If issues persist after applying these fixes:

1. **Check Supabase logs** for RLS policy violations
2. **Verify RLS policies** allow principals to read `guardian_requests` for their preschool
3. **Confirm parent registration flow** properly sets `preschool_id` in `profiles` table
4. **Test with fresh parent account** to isolate data vs code issues
5. **Review migration** `20251030110200_change_child_registration_parent_id_to_profiles.sql`

## Contact & Support

For additional help:
- Check console logs for "⚠️" and "❌" diagnostic messages
- Review Supabase dashboard > Authentication > Users
- Review Supabase dashboard > Table Editor > profiles, guardian_requests
- File issue with logs and screenshots if problem persists
