# Interactive Exam Issues & Solutions

## ?? Problems Found

### Issue 1: Wrong Context in AI Request
**File:** `/workspace/web/src/components/dashboard/AskAIWidget.tsx` (Line 124)

**Problem:**
```typescript
context: 'general_question',  // ? WRONG!
```

**Should be:**
```typescript
context: 'caps_exam_preparation',  // ? CORRECT
```

**Impact:** AI doesn't know it should generate an exam, so it might just chat instead of calling the `generate_caps_exam` tool.

---

### Issue 2: Poor UX - Modal for Exams
**Current Flow:**
1. User configures exam in ExamPrepWidget
2. Clicks "Generate"
3. Opens AI modal (small, cramped)
4. User clicks "Send"
5. Waits in modal
6. Exam renders in same modal

**Problems:**
- ? Modal is too small for exams
- ? Can't navigate away while generating
- ? Feels like a chat, not an exam generator
- ? No dedicated space for exam-taking
- ? Hard to review past exams

---

## ? Proposed Solutions

### Solution 1: Fix Context (Quick Fix)
Update `onSend()` to use correct context based on `enableInteractive` flag:

```typescript
const { data, error } = await supabase.functions.invoke('ai-proxy', {
  body: {
    scope: 'parent',
    service_type: 'homework_help',
    enable_tools: true,
    payload: {
      prompt: text,
      context: enableInteractive ? 'caps_exam_preparation' : 'general_question',  // ? Dynamic
      metadata: {
        source: 'dashboard',
        language: language || 'en-ZA',
        enableInteractive: enableInteractive  // ? Pass flag
      }
    },
    metadata: {
      role: 'parent'
    }
  },
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});
```

### Solution 2: Dedicated Exam Page (Better UX)
Create `/dashboard/parent/generate-exam` page with better flow:

**New Flow:**
```
ExamPrepWidget
     ?
Click "Generate"
     ?
Navigate to /dashboard/parent/generate-exam?grade=10&subject=Math&type=practice_test
     ?
Dedicated page with:
  - Loading state
  - Full-screen exam view
  - Progress indicator
  - Cancel button
  - Navigation
     ?
Exam generates
     ?
Exam displays full-screen
     ?
Student takes exam
     ?
Auto-saves to /my-exams
```

**Benefits:**
- ? Full-screen experience
- ? Better loading states
- ? Can navigate away
- ? Professional feel
- ? Dedicated exam-taking space
- ? Proper URL structure
- ? Shareable links
- ? Browser back button works

---

## ?? Recommended Approach

### Option A: Quick Fix (5 minutes)
Just fix the context issue - minimal change, immediate improvement.

**Pros:**
- Fast
- Low risk
- Minimal code change

**Cons:**
- Still uses modal (poor UX)
- Doesn't fix navigation issues

### Option B: Dedicated Page (30 minutes)
Create proper exam generation page with great UX.

**Pros:**
- Professional experience
- Better UX
- Scalable
- Room for features (save draft, pause exam, etc.)

**Cons:**
- More code changes
- Need to update navigation flow

---

## ?? Implementation Plan (Option B - Recommended)

### Step 1: Create /generate-exam Page
**File:** `/workspace/web/src/app/dashboard/parent/generate-exam/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ParentShell } from '@/components/layout/ParentShell';
import { useParentDashboardData } from '@/lib/hooks/parent/useParentDashboardData';
import { ExamInteractiveView } from '@/components/dashboard/exam-prep/ExamInteractiveView';
import { useExamSession } from '@/lib/hooks/useExamSession';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';

export default function GenerateExamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, profile } = useParentDashboardData();
  
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<any>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  
  const { saveExamGeneration } = useExamSession(null);
  
  // Get params from URL
  const grade = searchParams.get('grade');
  const subject = searchParams.get('subject');
  const examType = searchParams.get('type');
  const language = searchParams.get('language') || 'en-ZA';
  
  useEffect(() => {
    if (!grade || !subject || !examType) {
      setError('Missing exam parameters');
      setGenerating(false);
      return;
    }
    
    generateExam();
  }, [grade, subject, examType]);
  
  const generateExam = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const prompt = `Generate an interactive, age-appropriate practice examination paper for ${grade} ${subject} strictly aligned to the CAPS curriculum.`;
      
      const { data, error: invokeError } = await supabase.functions.invoke('ai-proxy', {
        body: {
          scope: 'parent',
          service_type: 'homework_help',
          enable_tools: true,
          payload: {
            prompt,
            context: 'caps_exam_preparation',
            metadata: {
              source: 'exam_generator',
              language,
              grade,
              subject,
              examType
            }
          },
          metadata: { role: 'parent' }
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      
      if (invokeError) throw invokeError;
      
      // Parse exam from tool results
      if (data?.tool_results && Array.isArray(data.tool_results)) {
        for (const toolResult of data.tool_results) {
          const resultData = typeof toolResult.content === 'string' 
            ? JSON.parse(toolResult.content)
            : toolResult.content;
          
          if (resultData.success && resultData.data?.sections) {
            // Save to database
            const genId = await saveExamGeneration(
              resultData.data,
              prompt,
              resultData.data.title || 'Generated Exam',
              resultData.data.grade,
              resultData.data.subject
            );
            
            setGenerationId(genId);
            setExam(resultData.data);
            setGenerating(false);
            return;
          }
        }
      }
      
      throw new Error('Failed to generate exam');
      
    } catch (err: any) {
      console.error('[GenerateExam] Error:', err);
      setError(err.message || 'Failed to generate exam');
      setGenerating(false);
    }
  };
  
  if (!userId) {
    return null;
  }
  
  return (
    <ParentShell
      userId={userId}
      profile={profile}
      activeChildId={null}
      setActiveChildId={() => {}}
      childrenCards={[]}
      childrenLoading={false}
      metrics={{}}
      unreadCount={0}
      trialStatus={null}
      loading={false}
    >
      {generating && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '1rem'
        }}>
          <Loader2 className="icon32" style={{ animation: 'spin 1s linear infinite' }} />
          <h2>Generating Your Exam...</h2>
          <p style={{ color: 'var(--muted)', textAlign: 'center' }}>
            Dash is creating a {grade} {subject} exam for you.<br />
            This may take 15-30 seconds.
          </p>
        </div>
      )}
      
      {error && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          padding: '2rem'
        }}>
          <AlertCircle className="icon32" style={{ color: 'var(--danger)' }} />
          <h2>Generation Failed</h2>
          <p style={{ color: 'var(--muted)' }}>{error}</p>
          <button onClick={() => router.back()} className="btn btnPrimary">
            Go Back
          </button>
        </div>
      )}
      
      {exam && (
        <ExamInteractiveView
          exam={exam}
          generationId={generationId}
          onClose={() => router.push('/dashboard/parent')}
        />
      )}
    </ParentShell>
  );
}
```

### Step 2: Update ExamPrepWidget
**File:** `/workspace/web/src/components/dashboard/exam-prep/ExamPrepWidget.tsx`

Change `handleConfirmGenerate`:
```typescript
const handleConfirmGenerate = () => {
  if (!customPrompt) return;
  
  // Navigate to dedicated exam generation page
  const params = new URLSearchParams({
    grade: gradeInfo?.value || '',
    subject: selectedSubject,
    type: selectedExamType,
    language: selectedLanguage
  });
  
  router.push(`/dashboard/parent/generate-exam?${params.toString()}`);
  setShowPromptPreview(false);
};
```

### Step 3: Update Navigation
Add "Generate Exam" to side navigation (optional)

---

## ?? Comparison

| Feature | Modal (Current) | Dedicated Page |
|---------|----------------|----------------|
| Screen Space | ? Small | ? Full |
| Navigation | ? Blocked | ? Normal |
| URL | ? No URL | ? /generate-exam |
| Back Button | ? Closes | ? Works |
| Loading State | ?? Basic | ? Professional |
| Exam Taking | ? Cramped | ? Spacious |
| Shareable | ? No | ? Yes |
| Professional | ? Chat-like | ? App-like |

---

## ?? Testing Plan

### Test 1: Quick Fix (Option A)
1. Generate practice test
2. Verify context is `caps_exam_preparation`
3. Verify AI calls `generate_caps_exam` tool
4. Verify exam renders in modal

### Test 2: Dedicated Page (Option B)
1. Click "Generate Practice Test"
2. Verify navigation to `/generate-exam?grade=10&subject=Math&type=practice_test`
3. See loading state
4. Exam generates
5. Take exam full-screen
6. Submit and see results
7. Navigate back

---

## ?? Recommendation

**Implement Option B (Dedicated Page)**

**Why:**
1. Better UX (professional, spacious)
2. Proper navigation flow
3. Scalable (can add features)
4. Modern app architecture
5. Only 30 minutes more work
6. Much better end result

**Quick wins:**
- Fix context issue first (5 min)
- Then create dedicated page (30 min)
- Total: 35 minutes for proper solution

---

**Which option do you prefer?**
- **Option A:** Quick fix (modal stays) - 5 minutes
- **Option B:** Dedicated page (proper UX) - 35 minutes ? RECOMMENDED
