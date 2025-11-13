# Testing Guide: CAPS Exam Prep Feature

## Quick Test Steps

### 1. Start Development Server
```bash
cd /home/king/Desktop/edudashpro/web
npm run dev
```

### 2. Visit Exam Prep Page
Open browser: `http://localhost:3000/exam-prep`

### 3. Test Guest Mode Flow
- [ ] Select **Grade 9**
- [ ] Select **Mathematics** 
- [ ] Select **Practice Test**
- [ ] Click "Generate with Dash AI"
- [ ] Verify modal opens with loading state
- [ ] Check if localStorage key is set: `EDUDASH_EXAM_PREP_FREE_USED`
- [ ] Try generating again - should show "Free limit reached" alert

### 4. Test Different Resource Types
- [ ] **Revision Notes**: Grade 10, Life Sciences
- [ ] **Study Guide**: Grade 12, Mathematics
- [ ] **Flashcards**: Grade 7, Natural Sciences

### 5. Test Navigation
- [ ] Home page → Click "Try Exam Prep" button in hero
- [ ] Should navigate to `/exam-prep`
- [ ] Nav bar → Click "📝 Exam Prep" link

### 6. Test Responsive Design
- [ ] Desktop view (1920x1080)
- [ ] Tablet view (768x1024)
- [ ] Mobile view (375x667)

### 7. Apply Database Migration
```bash
cd /home/king/Desktop/edudashpro
npx supabase db push
npx supabase db diff  # Verify no drift
```

### 8. Verify Tables Created
Check Supabase Dashboard:
- [ ] `past_papers` table exists
- [ ] `exam_generations` table exists
- [ ] `exam_user_progress` table exists
- [ ] RLS policies are active
- [ ] Function `get_user_exam_stats` exists

## Expected Behavior

### Guest Mode (Not Signed In)
- ✅ Can select grade, subject, exam type
- ✅ Can click "Generate" button
- ✅ Shows modal with placeholder content
- ✅ Prompts to sign in for full generation
- ✅ Daily limit enforced (1 per day)

### Authenticated Mode (Signed In as Parent)
- ✅ Unlimited generations
- ✅ Content saved to `exam_generations` table
- ✅ Full AI-generated exam papers with memos
- ✅ No daily limits

## Manual Testing Checklist

- [ ] All grades selectable (R through 12)
- [ ] Subjects change based on phase
- [ ] 4 exam types display correctly
- [ ] Icons render properly (Lucide React)
- [ ] Colors match theme (gold for exam prep)
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Links work correctly

## Browser Compatibility

Test on:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS if available)

## Performance Checks

- [ ] Page loads < 3 seconds
- [ ] No layout shifts (CLS)
- [ ] Images lazy load
- [ ] Smooth scrolling animations

## Next: Production Deployment

Once all tests pass:
```bash
npm run build
# Deploy to Vercel or production server
```
