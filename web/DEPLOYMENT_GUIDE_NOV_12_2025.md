# Quick Deployment Guide - November 12, 2025 Updates

## Overview
This guide covers deploying the recent improvements to EduDash Pro: enhanced AI explanations, CAPS alignment, SuperAdmin dashboard, and performance optimizations.

---

## Pre-Deployment Checks

### 1. Verify Edge Function Changes
```bash
cd /workspaces/edupro
# Check explain-answer function
cat supabase/functions/explain-answer/index.ts | grep "max_tokens"
# Should show: max_tokens: 800
```

### 2. Build and Test Web App
```bash
cd /workspaces/edupro/web
npm run build
# Check for build errors
# Verify bundle size is reasonable
```

### 3. Type Check
```bash
cd /workspaces/edupro/web
npm run type-check
# Should pass with no errors
```

---

## Deployment Steps

### Step 1: Deploy Edge Function
```bash
cd /workspaces/edupro

# Deploy the enhanced explain-answer function
supabase functions deploy explain-answer --project-ref YOUR_PROJECT_REF

# Verify deployment
supabase functions list
```

### Step 2: Verify Database Functions
```bash
# Connect to your Supabase project
psql YOUR_DATABASE_CONNECTION_STRING

# Check RPC functions exist
\df get_superadmin_dashboard_data
\df test_superadmin_system

# Check audit log table
\d superadmin_audit_log

# Exit
\q
```

### Step 3: Deploy Web Application
```bash
cd /workspaces/edupro/web

# Build production version
npm run build

# Deploy to your hosting (Vercel example)
vercel --prod

# Or for other platforms, follow their deployment process
```

### Step 4: Verify Service Worker
```bash
# Check service worker version updated
cat web/public/sw.js | grep "SW_VERSION"
# Should show recent timestamp
```

---

## Post-Deployment Verification

### 1. Test AI Explanations
1. Visit `/dashboard/exam-prep`
2. Generate a practice test
3. Submit with wrong answers
4. Click "Explain Answer"
5. Verify detailed, teacher-like explanation appears

**Expected**: 4-6 paragraph explanation with sections for mistake analysis, teaching, steps, CAPS alignment, and encouragement.

### 2. Test SuperAdmin Dashboard
1. Login as superadmin
2. Visit `/admin`
3. Verify live statistics display
4. Check system status indicator
5. Click quick action buttons
6. Verify recent activity feed

**Expected**: Real-time data, responsive layout, functional navigation.

### 3. Test Performance
1. Open browser DevTools
2. Go to Lighthouse tab
3. Run audit on `/dashboard`
4. Check scores:
   - Performance: >85
   - Accessibility: >90
   - Best Practices: >95
   - SEO: >90

### 4. Test CAPS Alignment
1. Generate exam for Grade 5 Mathematics
2. Review questions and topics
3. Verify South African context
4. Check cognitive level distribution
5. Confirm language consistency

**Expected**: All questions aligned to CAPS, appropriate difficulty, SA context.

---

## Rollback Plan (If Needed)

### Edge Function Rollback
```bash
# List previous versions
supabase functions list --project-ref YOUR_PROJECT_REF

# Rollback to previous version (if needed)
supabase functions deploy explain-answer --project-ref YOUR_PROJECT_REF --version PREVIOUS_VERSION
```

### Web App Rollback
```bash
# If using Vercel
vercel rollback

# If using custom deployment, redeploy previous version
git checkout main  # or previous working commit
npm run build
# Deploy using your process
```

---

## Monitoring

### What to Monitor

1. **Edge Function Performance**
   - Response times (should be <2s)
   - Error rates (should be <1%)
   - Rate limit hits
   - Cost per request

2. **Web App Performance**
   - Initial load time (<1.5s)
   - Time to Interactive (<2s)
   - Cache hit rates (>60%)
   - Bundle size (<500KB initial)

3. **User Experience**
   - Explanation quality feedback
   - Dashboard load errors
   - Browser console errors
   - Mobile performance

### Monitoring Tools
```bash
# Supabase logs
supabase functions logs explain-answer --tail

# Web analytics (example with Vercel)
vercel logs --follow

# Check error rates in Supabase dashboard
# Check analytics in your hosting dashboard
```

---

## Common Issues & Solutions

### Issue 1: Edge Function Timeout
**Symptom**: Explanations fail with timeout error  
**Solution**: Claude API may be overloaded. Function has retry logic (3 attempts). Fallback explanation will be shown automatically.

### Issue 2: SuperAdmin Dashboard Empty
**Symptom**: No data displayed  
**Solution**: 
1. Verify user has superadmin role
2. Check RPC functions exist in database
3. Verify RLS policies allow superadmin access

### Issue 3: Build Size Too Large
**Symptom**: Build exceeds size limits  
**Solution**:
1. Check lazy loading is working
2. Verify package optimization in next.config.ts
3. Run `npm run analyze` to identify large dependencies

### Issue 4: Cache Issues
**Symptom**: Old content showing after deployment  
**Solution**:
```bash
# Clear CDN cache (Vercel example)
vercel --purge

# Users may need to hard refresh (Ctrl+F5)
```

---

## Success Criteria

✅ All deployments complete without errors  
✅ AI explanations are detailed and teacher-like  
✅ SuperAdmin dashboard displays live data  
✅ CAPS compliance checklist enforced  
✅ Performance scores >85 on Lighthouse  
✅ No console errors in production  
✅ Mobile experience is smooth  
✅ Dark mode works correctly  

---

## Support & Troubleshooting

If issues arise:
1. Check Supabase logs for Edge Function errors
2. Review browser console for frontend errors
3. Verify environment variables are set correctly
4. Check database connections and RLS policies
5. Review this document's Common Issues section

For critical issues, consider rolling back to previous version while investigating.

---

**Deployment Checklist**:
- [ ] Edge function deployed
- [ ] Database functions verified
- [ ] Web app built successfully
- [ ] Web app deployed
- [ ] AI explanations tested
- [ ] SuperAdmin dashboard tested
- [ ] Performance audit completed
- [ ] CAPS alignment verified
- [ ] Monitoring set up
- [ ] Team notified of changes

**Status**: Ready for Production ✅
