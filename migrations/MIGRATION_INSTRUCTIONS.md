# Database Migration Instructions - Parent Signup Flow

**Date:** 2025-11-01  
**Migration File:** `20251101_add_usage_type_and_fix_currency.sql`  
**Status:** Ready to run  
**Estimated Time:** 1-2 minutes  
**Risk Level:** Low (adds columns, no data deletion)

---

## 🎯 What This Migration Does

1. ✅ Adds `usage_type` column to `profiles` table
2. ✅ Ensures `preschool_id` is nullable (optional)
3. ✅ Migrates existing users to appropriate usage types
4. ✅ Ensures all currency fields use **ZAR (South African Rand)**
5. ✅ Adds `approved` and `verified` flags to `preschools`
6. ✅ Adds `date_of_birth` and `grade_level` to `students`
7. ✅ Creates helper functions for feature checking
8. ✅ Updates RLS policies for approved organizations

---

## 🚀 How to Run This Migration

### **Option 1: Via Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `20251101_add_usage_type_and_fix_currency.sql`
5. Paste into the SQL editor
6. Click **Run** (bottom right)
7. Wait for "Success" message
8. Run verification queries (see below)

### **Option 2: Via Command Line**

```bash
# If you have psql installed and database access
psql -h <your-supabase-host> \
     -U postgres \
     -d postgres \
     -f migrations/20251101_add_usage_type_and_fix_currency.sql
```

### **Option 3: Via Supabase CLI**

```bash
# If you have Supabase CLI set up
supabase db push --file migrations/20251101_add_usage_type_and_fix_currency.sql
```

---

## ✅ Verification Steps

After running the migration, execute these queries to verify:

### **1. Check usage_type was added:**
```sql
SELECT usage_type, COUNT(*) as count 
FROM profiles 
WHERE role = 'parent' 
GROUP BY usage_type 
ORDER BY count DESC;
```

**Expected Output:**
```
usage_type    | count
--------------+-------
preschool     | X
independent   | Y
(2 rows)
```

### **2. Check currency is ZAR:**
```sql
-- Check fees
SELECT currency, COUNT(*) as count 
FROM fees 
GROUP BY currency;

-- Check payments
SELECT currency, COUNT(*) as count 
FROM payments 
GROUP BY currency;

-- Check subscription plans
SELECT currency, COUNT(*) as count 
FROM subscription_plans 
GROUP BY currency;
```

**Expected Output:** All should show `ZAR`

### **3. Check preschool approval columns:**
```sql
SELECT 
  COUNT(*) as total, 
  SUM(CASE WHEN approved THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN verified THEN 1 ELSE 0 END) as verified
FROM preschools;
```

### **4. Check nullable fields:**
```sql
SELECT 
  COUNT(*) as total_profiles,
  SUM(CASE WHEN preschool_id IS NULL THEN 1 ELSE 0 END) as without_preschool,
  SUM(CASE WHEN usage_type IS NOT NULL THEN 1 ELSE 0 END) as with_usage_type
FROM profiles 
WHERE role = 'parent';
```

**Expected:** All parents should have usage_type, some may have NULL preschool_id

### **5. Test helper functions:**
```sql
-- Test has_school_features function
SELECT has_school_features('<some-user-uuid>');

-- Test get_approved_organizations function
SELECT * FROM get_approved_organizations() LIMIT 5;
```

---

## 🔧 Post-Migration Tasks

### **1. Approve Organizations**

**Option A: Via Superadmin Dashboard** (Recommended)

1. Login with a superadmin account
2. Navigate to: `/dashboard/admin/organizations`
3. Review each organization in the list
4. Click **"Approve"** for legitimate organizations
5. Click **"Revoke"** to remove approval from organizations

**Features:**
- ✅ Search and filter organizations
- ✅ View pending vs approved status
- ✅ Audit trail (who approved, when)
- ✅ One-click approval/rejection
- ✅ Real-time stats dashboard

**Option B: Via SQL** (Quick for Development)

```sql
-- View all organizations
SELECT id, name, type, city, approved, verified 
FROM preschools 
ORDER BY name;

-- Approve specific organizations
UPDATE preschools 
SET 
  approved = TRUE,
  verified = TRUE
WHERE id IN (
  '<org-id-1>',
  '<org-id-2>',
  '<org-id-3>'
);

-- Or approve all existing organizations (use with caution)
UPDATE preschools 
SET 
  approved = TRUE,
  verified = TRUE
WHERE is_active = TRUE;
```

### **2. Set Date of Birth for Existing Students (Optional)**

If you have students without birth dates, you may want to estimate based on grade:

```sql
-- Example: Estimate birth dates based on grade level
UPDATE students 
SET date_of_birth = CASE 
  WHEN grade_level = 'Grade R' THEN CURRENT_DATE - INTERVAL '5 years'
  WHEN grade_level = 'Grade 1' THEN CURRENT_DATE - INTERVAL '6 years'
  WHEN grade_level = 'Grade 2' THEN CURRENT_DATE - INTERVAL '7 years'
  -- Add more as needed
  ELSE NULL
END
WHERE date_of_birth IS NULL 
  AND grade_level IS NOT NULL;
```

### **3. Test the New Signup Flow**

1. Go to `/sign-up/parent`
2. Try signing up as each usage type:
   - ✅ Preschool (with and without organization)
   - ✅ K-12 School (with and without organization)
   - ✅ Homeschool (should skip organization)
   - ✅ Aftercare (optional organization)
   - ✅ Supplemental (should skip organization)
   - ✅ Exploring (should skip organization)

---

## 💰 Currency Settings (ZAR)

All pricing should now be in **South African Rand (ZAR)**:

### **Update Subscription Plans (if needed):**

```sql
-- Check current plans
SELECT * FROM subscription_plans;

-- Example: Update pricing to ZAR (adjust amounts as needed)
UPDATE subscription_plans 
SET 
  price = CASE 
    WHEN name = 'Free' THEN 0
    WHEN name = 'Premium' THEN 99.99  -- R99.99/month
    WHEN name = 'Family' THEN 199.99  -- R199.99/month
    ELSE price
  END,
  currency = 'ZAR'
WHERE currency != 'ZAR' OR currency IS NULL;
```

### **Update Fee Templates:**

```sql
-- Ensure fee templates use ZAR
UPDATE fee_templates 
SET currency = 'ZAR' 
WHERE currency != 'ZAR' OR currency IS NULL;
```

---

## 🚨 Troubleshooting

### **Issue: Column already exists**
```
ERROR: column "usage_type" of relation "profiles" already exists
```

**Solution:** Safe to ignore - the migration uses `IF NOT EXISTS`

### **Issue: Currency constraint violation**
```
ERROR: new row violates check constraint on table "fees"
```

**Solution:** Some old data may have invalid currency. Run:
```sql
-- Find invalid currencies
SELECT DISTINCT currency FROM fees WHERE currency NOT IN ('ZAR', 'USD', 'EUR', 'GBP');

-- Fix them
UPDATE fees SET currency = 'ZAR' WHERE currency NOT IN ('ZAR', 'USD', 'EUR', 'GBP');
```

### **Issue: NULL usage_type after migration**
```
ERROR: Some profiles have NULL usage_type
```

**Solution:** Re-run the migration's UPDATE statement:
```sql
UPDATE profiles 
SET usage_type = 'independent'
WHERE usage_type IS NULL AND role = 'parent';
```

### **Issue: Can't access organizations in signup**
```
No organizations appearing in search
```

**Solution:** Approve organizations:
```sql
UPDATE preschools 
SET approved = TRUE, verified = TRUE 
WHERE is_active = TRUE;
```

---

## 🔄 Rollback Procedure (Emergency Only)

If you need to rollback this migration:

1. **DO NOT delete data** - just drop columns
2. Run the rollback section from the migration file (commented out)
3. Inform the team immediately
4. Check for dependent features

```sql
-- Remove usage_type column
ALTER TABLE profiles DROP COLUMN IF EXISTS usage_type;

-- Remove indexes
DROP INDEX IF EXISTS idx_profiles_usage_type;

-- Remove functions
DROP FUNCTION IF EXISTS has_school_features(UUID);
DROP FUNCTION IF EXISTS get_approved_organizations();
```

⚠️ **Warning:** Only rollback if absolutely necessary. This will break the new signup flow.

---

## 📊 Expected Impact

### **Database Changes:**
- ✅ 1 new column in `profiles` (usage_type)
- ✅ 2 new columns in `preschools` (approved, verified)
- ✅ 2 new columns in `students` (date_of_birth, grade_level)
- ✅ 1-3 new currency columns in various tables
- ✅ 4 new indexes
- ✅ 2 new helper functions
- ✅ 1 new RLS policy

### **Data Migration:**
- Existing parent users → classified by current preschool_id
- All currency fields → set to ZAR
- Existing preschools → set to unverified/unapproved (manual approval needed)

### **Application Changes:**
- ✅ New signup flow works
- ✅ Organization linking is optional
- ✅ Currency displays as R (Rand symbol)
- ✅ Feature differentiation ready

---

## ✅ Final Checklist

Before marking migration as complete:

- [ ] Migration SQL executed successfully
- [ ] Verification queries all pass
- [ ] No errors in Supabase logs
- [ ] Existing preschools approved (if desired)
- [ ] New signup flow tested (all 6 types)
- [ ] Currency displays correctly (R symbol)
- [ ] Feature flags work (school vs independent)
- [ ] Analytics tracking usage_type
- [ ] Documentation updated
- [ ] Team notified

---

## 📞 Support

**Questions?**
- Check the SQL comments in the migration file
- Review `PARENT_SIGNUP_FLOW_AUDIT.md` for context
- Review `FEATURE_DIFFERENTIATION_GUIDE.md` for implementation

**Issues?**
- Check Supabase logs for errors
- Run verification queries
- Check application logs
- Contact database admin if needed

---

**Status:** Ready to run ✅  
**Last Updated:** 2025-11-01  
**Version:** 1.0
