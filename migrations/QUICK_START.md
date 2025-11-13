# Quick Start - Database Migration

**Just want to run it? Here's the TL;DR:**

---

## 🚀 Run This Now

### **Step 1: Run the Migration**

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy everything from `20251101_add_usage_type_and_fix_currency.sql`
3. Paste and click **Run**
4. Wait for "Success" ✅

### **Step 2: Approve Your Schools**

```sql
-- Approve ALL existing schools (so they appear in parent search)
UPDATE preschools 
SET approved = TRUE, verified = TRUE 
WHERE is_active = TRUE;
```

### **Step 3: Verify It Worked**

```sql
-- Should show usage types for parents
SELECT usage_type, COUNT(*) 
FROM profiles 
WHERE role = 'parent' 
GROUP BY usage_type;

-- Should show ZAR currency
SELECT DISTINCT currency FROM fees;
SELECT DISTINCT currency FROM payments;

-- Should show approved schools
SELECT COUNT(*) as approved_schools 
FROM preschools 
WHERE approved = TRUE;
```

### **Step 4: Test Signup**

Go to `/sign-up/parent` and test:
- ✅ Homeschool signup (no org required)
- ✅ Preschool signup (optional org)
- ✅ K-12 signup (optional org)

---

## ✅ Done!

**That's it!** Your database is ready for the new signup flow.

---

## 📝 What Changed?

- Added `usage_type` to track parent categories
- Made `preschool_id` optional (for independent parents)
- Set all currency to **ZAR (Rand)** 🇿🇦
- Added approval system for organizations
- Added helper functions for feature checks

---

## 🆘 If Something Goes Wrong

**Can't find the SQL file?**
→ It's at `/workspace/migrations/20251101_add_usage_type_and_fix_currency.sql`

**Migration failed?**
→ Check the error message and see `MIGRATION_INSTRUCTIONS.md` troubleshooting section

**No schools showing in signup?**
→ Run: `UPDATE preschools SET approved = TRUE, verified = TRUE;`

**Currency not showing as Rand?**
→ Check application code uses `R` symbol, database has `ZAR` correctly

---

## 📚 Full Details

See `MIGRATION_INSTRUCTIONS.md` for complete documentation.

---

**Time Required:** 5 minutes  
**Risk Level:** Low ✅  
**Rollback Available:** Yes (but shouldn't need it)
