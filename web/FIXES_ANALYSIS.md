# Fixes Analysis - Forgot Password, Scoring, and Auth

## Issue 1: Forgot Password Email Sending ?

### **Current Status:**
**Code is CORRECT** ?

**File:** `/workspace/web/src/app/forgot-password/page.tsx`

**Implementation:**
```typescript
const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
});
```

### **How It Works:**
1. User enters email on `/forgot-password` page
2. Clicks "Send Reset Link"
3. Supabase sends email via configured SMTP
4. Email contains link to `/reset-password?token=...`
5. User clicks link and sets new password

### **Requirements:**
?? **Email sending requires Supabase configuration:**

1. **In Supabase Dashboard:**
   - Go to Authentication > Email Templates
   - Ensure "Reset Password" template is configured
   - Confirm SMTP settings or use Supabase's default email service

2. **Email Template Variables:**
   - `{{ .ConfirmationURL }}` - Link to reset page
   - `{{ .Token }}` - Reset token
   - `{{ .SiteURL }}` - Your site URL

### **Testing:**
```bash
# Test the endpoint
curl -X POST https://YOUR_PROJECT.supabase.co/auth/v1/recover \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Expected Response:**
```json
{} // Empty response = success (email sent)
```

### **Troubleshooting:**
If emails aren't sending:
1. Check spam folder
2. Verify email in Supabase Auth Users
3. Check Supabase Dashboard > Authentication > Email Templates
4. Review Supabase logs for email delivery errors
5. Ensure redirect URL is in Supabase allowed URLs list

**Conclusion:** ? Code is correct. Issue is likely **Supabase SMTP configuration**.

---

## Issue 2: Scoring and Grading Logic ?

### **Current Problems:**

#### **Problem 1: All Wrong Answers Get 0 Marks (Partial Credit Not Supported)**

**File:** `/workspace/web/src/lib/examParser.ts` (lines 260-409)

**Current Logic:**
```typescript
marks: isCorrect ? question.marks : 0  // ? Binary: all or nothing
```

**Issue:**
- Multiple-choice: Correct = full marks, Wrong = 0 marks ? (OK)
- Numeric: Correct = full marks, Wrong = 0 marks ? (OK for exact answers)
- **Essay/Short Answer: ALWAYS 0 marks** ? (Needs teacher review or AI grading)

#### **Problem 2: No Support for Partial Marks**

CAPS exams often award partial marks for:
- Showing work in math problems
- Partially correct essay answers
- Multi-part questions

**Current code doesn't support:**
- Marking schemes with partial marks (e.g., 2 marks for method, 3 for answer)
- Step-by-step grading
- Rubric-based assessment

#### **Problem 3: Essay Questions Always Score 0**

```typescript
// If no correct answer provided, can't auto-grade
if (!question.correctAnswer) {
  return {
    isCorrect: false,
    feedback: '? Answer recorded. Awaiting teacher review.',
    marks: 0,  // ? Always 0 for essays!
  };
}
```

**This means:**
- Essays, long-form answers, and open-ended questions = 0 marks
- **Total score is inaccurate** if exam has essay questions

---

### **Solution: Enhanced Grading System**

#### **Option A: AI-Powered Grading (Recommended)**

Use Dash AI to grade essay/short answer questions:

```typescript
async function gradeEssayQuestion(
  question: ExamQuestion,
  studentAnswer: string
): Promise<QuestionFeedback> {
  // Call ai-proxy to grade essay
  const { data } = await supabase.functions.invoke('ai-proxy', {
    body: {
      scope: 'teacher',
      service_type: 'grading',
      payload: {
        prompt: `Grade this ${question.marks}-mark essay question:
        
QUESTION: ${question.text}

STUDENT ANSWER: ${studentAnswer}

MARKING RUBRIC: ${question.rubric || 'Standard CAPS rubric'}

Provide:
1. Marks earned (0-${question.marks})
2. Brief feedback (2-3 sentences)
3. Is answer correct? (yes/no)`,
        context: 'exam_grading'
      }
    }
  });
  
  return {
    isCorrect: data.marks >= question.marks * 0.7, // 70%+ = "correct"
    feedback: data.feedback,
    marks: data.marks
  };
}
```

#### **Option B: Manual Teacher Review (Simpler)**

Mark essays as "pending review" with placeholder marks:

```typescript
// Essay questions default to 50% (estimated)
if (!question.correctAnswer && question.type === 'essay') {
  return {
    isCorrect: false,
    feedback: '?? Answer recorded. Teacher review required.',
    marks: Math.floor(question.marks / 2), // 50% provisional marks
    requiresReview: true
  };
}
```

#### **Option C: Keyword Matching (Basic)**

Simple rubric-based grading:

```typescript
interface GradingRubric {
  keywords: string[];
  marksPerKeyword: number;
  maxMarks: number;
}

function gradeByKeywords(
  studentAnswer: string,
  rubric: GradingRubric
): number {
  const found = rubric.keywords.filter(kw => 
    studentAnswer.toLowerCase().includes(kw.toLowerCase())
  );
  return Math.min(
    found.length * rubric.marksPerKeyword,
    rubric.maxMarks
  );
}
```

---

## Issue 3: Authentication Error in useExamSession ?

### **Error:**
```
[useExamSession] Not authenticated
```

**File:** `/workspace/web/src/lib/hooks/useExamSession.ts` (line 192)

### **Root Cause:**
User session is `null` when trying to save exam progress.

**Possible Reasons:**
1. Session expired during exam
2. User not logged in (shouldn't be possible if route is protected)
3. Session not initialized yet
4. User logged out in another tab

### **Current Code:**
```typescript
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  console.error('[useExamSession] Not authenticated');
  return false;  // ? Silently fails - user loses progress!
}
```

### **Problems:**
- ? Silent failure - user doesn't know progress wasn't saved
- ? No retry mechanism
- ? No offline support
- ? Progress lost if auth fails

---

### **Solutions:**

#### **Solution 1: Add User Feedback (Quick Fix)**

```typescript
if (!sessionData.session) {
  console.error('[useExamSession] Not authenticated');
  
  // Show error to user
  alert('?? Could not save progress - you may not be logged in. Please log in and resubmit.');
  
  // Try to save to localStorage as backup
  localStorage.setItem('exam_backup', JSON.stringify({
    answers,
    score,
    timestamp: Date.now()
  }));
  
  return false;
}
```

#### **Solution 2: Refresh Session (Better)**

```typescript
// Try to refresh session first
const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

if (!sessionData.session) {
  // Attempt to refresh
  const { data: refreshData } = await supabase.auth.refreshSession();
  
  if (!refreshData.session) {
    // Still no session - redirect to login
    alert('Session expired. Please log in again to save your progress.');
    window.location.href = '/sign-in?redirectTo=' + encodeURIComponent(window.location.pathname);
    return false;
  }
  
  // Use refreshed session
  sessionData.session = refreshData.session;
}
```

#### **Solution 3: Offline-First with Retry (Best)**

```typescript
async function saveProgress(/* ... */): Promise<boolean> {
  // Save to localStorage first (always)
  const backup = { answers, score, examTitle, grade, subject, timestamp: Date.now() };
  localStorage.setItem(`exam_progress_${generationId}`, JSON.stringify(backup));
  
  // Try to save to database
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData.session) {
      // Show user-friendly message
      toast.error('Progress saved locally. Please log in to sync to cloud.');
      return false;
    }
    
    const { error } = await supabase.from('exam_user_progress').insert({
      user_id: sessionData.session.user.id,
      exam_generation_id: generationId,
      score_obtained: score.earned,
      score_total: score.total,
      // ... rest of data
    });
    
    if (error) {
      // Retry once
      await new Promise(resolve => setTimeout(resolve, 1000));
      const retryResult = await supabase.from('exam_user_progress').insert(/* same data */);
      
      if (retryResult.error) {
        toast.error('Could not sync to cloud. Progress saved locally.');
        return false;
      }
    }
    
    // Success! Clear localStorage backup
    localStorage.removeItem(`exam_progress_${generationId}`);
    toast.success('Progress saved!');
    return true;
    
  } catch (err) {
    console.error('[useExamSession] Save failed:', err);
    toast.error('Progress saved locally only.');
    return false;
  }
}
```

---

## Summary & Recommendations

| Issue | Status | Fix Priority | Effort |
|-------|--------|--------------|--------|
| **Forgot Password Email** | ? Code OK | ?? Config | 5 min |
| **Scoring Logic** | ? Broken | ?? HIGH | 30 min |
| **Auth Error** | ? Broken | ?? HIGH | 15 min |

### **Recommended Implementation Order:**

1. **Fix Auth Error First** (15 min)
   - Add localStorage backup
   - Add user feedback
   - Prevents data loss

2. **Fix Scoring Logic** (30 min)
   - Implement AI grading for essays
   - Add partial mark support
   - Update feedback UI

3. **Verify Forgot Password** (5 min)
   - Check Supabase email config
   - Test end-to-end flow
   - Update email templates if needed

---

**Next Steps:**
1. Apply auth fix to prevent data loss
2. Enhance grading to support essay questions
3. Test forgot password flow with real email
4. Add toast notifications for better UX
