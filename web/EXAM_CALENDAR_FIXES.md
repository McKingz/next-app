# CAPS Exam Calendar & Organization Type Fixes

**Date**: November 2, 2025  
**Status**: 🔴 CRITICAL ISSUES IDENTIFIED  
**Priority**: HIGH

---

## 🚨 Critical Issues Found

### 1. **Static Hardcoded Exam Dates**
**Problem**: `CAPSExamCalendar.tsx` shows Nov 1 as "today" when current date is Nov 2, 2025
**Impact**: 
- Misleading information for parents
- Shows exams as "today" when they already passed
- No dynamic date calculation

**Current Code**:
```tsx
{ grade: 'Grade 12', subject: 'English Home Language P1', date: 'Nov 1', time: '09:00', duration: '3h', status: 'today' },
```

**Issue**: Dates are hardcoded strings, not Date objects

---

### 2. **Missing Organization Type Support**
**Problem**: App supports multiple organization types but CAPS calendar only shows high school exams
**Supported Types**:
- ✅ `preschool` (ages 3-6)
- ✅ `k12_school` (Grade R-12)
- ✅ `hybrid` (mixed)
- ✅ `homeschool`
- ✅ `aftercare`
- ✅ `training_center`
- ✅ `independent` (no organization)

**Current Behavior**: Shows Grade 9-12 NSC exam schedule to ALL users (including preschool parents!)

**Impact**:
- Preschool parents (ages 3-6) see Grade 12 Math exams
- No age-appropriate content filtering
- Confusing UX

---

### 3. **Dash AI Shows Wrong Exam Dates**
**Problem**: Dash AI doesn't have access to exam calendar data
**Edge Function**: `ai-proxy-simple/index.ts` has no exam schedule context
**Result**: When asked "When is the Math exam?", Dash makes up dates

**Missing**:
- No exam_schedule table in database
- No tool calling to access real exam dates
- No context about official DBE exam timetable

---

### 4. **Broken Grade Detection**
**Problem**: Parent dashboard calculates grade using formula:
```tsx
`Grade ${Math.floor(10 + (activeChild.progressScore / 20))}`
```

**Issues**:
- Assumes all children are Grade 10+
- progressScore is arbitrary (0-100)
- No real grade field in students table
- Preschool children show as "Grade 10"

---

## ✅ Proposed Solutions

### Solution 1: Dynamic Exam Calendar
**Files to Create**:
1. `web/src/lib/utils/examSchedule.ts` - Date calculation utilities
2. `supabase/migrations/add_exam_schedule_table.sql` - Real exam dates
3. Update `CAPSExamCalendar.tsx` to use dynamic dates

**Features**:
- Auto-calculate "today", "upcoming", "completed" based on current date
- Fetch real exam dates from database
- Support multiple exam periods (Nov 2025, May 2026, etc.)
- Admin interface to update exam dates

---

### Solution 2: Organization-Aware UI
**Files to Update**:
1. `web/src/components/dashboard/parent/CAPSExamCalendar.tsx`
2. `web/src/lib/hooks/useParentDashboardData.ts`

**Logic**:
```tsx
// Only show CAPS exam calendar for K-12 students
if (usageType === 'preschool') {
  return <PreschoolAssessmentCalendar />;  // Age 3-6 milestones
}

if (usageType === 'k12_school' || usageType === 'hybrid') {
  // Get child's actual grade from students.grade field
  if (childGrade >= 9 && childGrade <= 12) {
    return <CAPSExamCalendar grade={childGrade} />;
  } else {
    return <TermAssessmentCalendar />;  // Grade R-8 term tests
  }
}
```

---

### Solution 3: Add Exam Schedule to Dash AI
**Files to Update**:
1. `supabase/functions/ai-proxy-simple/index.ts`
2. Create `exam_schedule` table
3. Add function calling tool

**Implementation**:
```typescript
// In ai-proxy-simple Edge Function
const examScheduleContext = await getExamSchedule(grade, subject);

const systemPrompt = `
You are Dash, a South African education assistant.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}

OFFICIAL CAPS EXAM SCHEDULE:
${examScheduleContext}

When asked about exam dates, use the OFFICIAL schedule above.
`;
```

**Tool Calling**:
```typescript
tools: [
  {
    name: 'get_exam_schedule',
    description: 'Get official DBE/CAPS exam schedule for specific grade and subject',
    input_schema: {
      type: 'object',
      properties: {
        grade: { type: 'string', description: 'Grade level (9-12)' },
        subject: { type: 'string', description: 'Subject name' },
        year: { type: 'number', description: 'Exam year (e.g., 2025)' }
      }
    }
  }
]
```

---

### Solution 4: Fix Grade Detection
**Database Change**:
```sql
-- Add real grade field to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS grade TEXT;

-- Valid values: 'toddler', 'pre-k', 'grade_r', 'grade_1', ..., 'grade_12'
```

**Hook Update**:
```tsx
// web/src/lib/hooks/useParentDashboardData.ts
const studentGrade = child.grade || 'unknown';  // Use real grade, not formula
```

---

## 📊 All App Scenarios to Account For

### Scenario 1: **Preschool Parent (Ages 3-6)**
- **Organization Type**: `preschool`
- **Grades**: Toddler, Pre-K, Reception, Grade R
- **Should See**: 
  - ✅ Developmental milestones
  - ✅ Play-based activities
  - ✅ School event calendar
  - ❌ NOT CAPS exam schedule

### Scenario 2: **K-12 Parent (Foundation Phase: Grade R-3)**
- **Organization Type**: `k12_school`
- **Grades**: Grade R, 1, 2, 3
- **Should See**:
  - ✅ Term assessment calendar
  - ✅ School reports schedule
  - ✅ Homework assignments
  - ❌ NOT NSC exam schedule (they're too young)

### Scenario 3: **K-12 Parent (Intermediate Phase: Grade 4-6)**
- **Organization Type**: `k12_school`
- **Grades**: 4, 5, 6
- **Should See**:
  - ✅ Mid-year and end-year exams
  - ✅ CAPS-aligned term tests
  - ❌ NOT Grade 12 NSC finals

### Scenario 4: **K-12 Parent (Senior Phase: Grade 7-9)**
- **Organization Type**: `k12_school`
- **Grades**: 7, 8, 9
- **Should See**:
  - ✅ GET (General Education & Training) exams
  - ✅ Subject-specific assessments
  - ⚠️ MAYBE show Grade 9 exam dates (if DBE publishes them)

### Scenario 5: **K-12 Parent (FET Phase: Grade 10-12)**
- **Organization Type**: `k12_school`
- **Grades**: 10, 11, 12
- **Should See**:
  - ✅ Full CAPS exam calendar (current implementation)
  - ✅ NSC (National Senior Certificate) dates
  - ✅ Past papers access
  - ✅ Exam countdown

### Scenario 6: **Hybrid Institution Parent**
- **Organization Type**: `hybrid`
- **Grades**: Mixed (Toddler to Grade 12)
- **Should See**: Dynamic calendar based on child's actual grade

### Scenario 7: **Homeschool Parent**
- **Organization Type**: `homeschool`
- **No Organization**: Independent
- **Should See**:
  - ✅ Optional CAPS exam calendar
  - ✅ Self-paced learning schedule
  - ✅ Downloadable resources

### Scenario 8: **Training Center / Aftercare**
- **Organization Type**: `training_center` or `aftercare`
- **Should See**:
  - ✅ Homework help calendar
  - ✅ Supplemental learning schedule
  - ❌ NOT school-specific exam dates

### Scenario 9: **Independent Parent (No School)**
- **Organization Type**: `independent`
- **No Organization ID**: NULL
- **Should See**:
  - ✅ Generic CAPS exam prep resources
  - ✅ Public exam calendar (like /exam-prep page)
  - ✅ Upgrade prompt to join organization

---

## 🎯 Decision Matrix: When to Show CAPS Exam Calendar

| Organization Type | Child Grade | Show CAPS Exam Calendar? | Alternative |
|------------------|-------------|-------------------------|-------------|
| Preschool | Toddler - Grade R | ❌ NO | Developmental milestones |
| K-12 School | Grade R-6 | ❌ NO | Term assessments |
| K-12 School | Grade 7-8 | ⚠️ MAYBE | GET exam dates |
| K-12 School | Grade 9-12 | ✅ YES | Full NSC schedule |
| Hybrid | Varies | ✅ IF Grade 9-12 | Dynamic based on grade |
| Homeschool | Any | ✅ OPTIONAL | Self-paced option |
| Independent | Any | ✅ PUBLIC VERSION | Generic calendar |
| Training Center | Any | ❌ NO | Homework support |
| Aftercare | Any | ❌ NO | Activity schedule |

---

## 🛠️ Implementation Checklist

### Phase 1: Database Schema (HIGH PRIORITY)
- [ ] Create `exam_schedule` table with official DBE dates
- [ ] Add `grade` field to `students` table
- [ ] Add `organization_type` to `preschools` table (if missing)
- [ ] Seed official 2025/2026 exam dates

### Phase 2: Fix Grade Detection (HIGH PRIORITY)
- [ ] Update `useParentDashboardData.ts` to use real grade
- [ ] Remove formula: `Math.floor(10 + (activeChild.progressScore / 20))`
- [ ] Add grade selector in child registration
- [ ] Backfill existing students with real grades

### Phase 3: Dynamic Exam Calendar (MEDIUM PRIORITY)
- [ ] Create `examSchedule.ts` utility with date calculations
- [ ] Update `CAPSExamCalendar.tsx` to fetch from database
- [ ] Add auto-detection of "today", "upcoming", "past"
- [ ] Add countdown timers for upcoming exams

### Phase 4: Organization-Aware UI (MEDIUM PRIORITY)
- [ ] Add conditional rendering based on `usageType`
- [ ] Create `PreschoolAssessmentCalendar.tsx` (ages 3-6)
- [ ] Create `TermAssessmentCalendar.tsx` (Grades R-8)
- [ ] Keep `CAPSExamCalendar.tsx` for Grades 9-12 only

### Phase 5: Dash AI Integration (LOW PRIORITY)
- [ ] Add exam schedule to Edge Function context
- [ ] Implement tool calling for `get_exam_schedule`
- [ ] Test accuracy of exam date responses
- [ ] Add current date awareness to AI

### Phase 6: Testing (REQUIRED)
- [ ] Test with preschool parent (ages 3-6)
- [ ] Test with K-12 parent (Grade 1)
- [ ] Test with K-12 parent (Grade 10)
- [ ] Test with independent parent (no organization)
- [ ] Test Dash AI exam date questions

---

## 📅 Official DBE Exam Dates to Add

### 2025 NSC Exam Schedule (Grade 12)
**Source**: https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations.aspx

**October/November 2025 (Final Exams)**:
- Computer Applications Technology P1 & P2: 28 Oct 2025
- English Home Language P1: 31 Oct 2025
- Afrikaans Home Language P1: 31 Oct 2025
- English Home Language P2: 6 Nov 2025
- Mathematics P1: 7 Nov 2025
- Physical Sciences P1: 10 Nov 2025
- Life Sciences P1: 11 Nov 2025
- Mathematics P2: 12 Nov 2025
- Physical Sciences P2: 17 Nov 2025
- Life Sciences P2: 18 Nov 2025

**(Note: Your hardcoded dates were wrong - English P1 is Oct 31, not Nov 1)**

### 2026 NSC Exam Schedule (Projected)
- Will follow similar pattern
- Typically starts late October
- Ends mid-November

---

## 🔥 Quick Fix (Immediate)

**Minimum Viable Fix** (Can deploy today):

1. **Hide CAPS calendar for preschool users**:
```tsx
// In CAPSExamCalendar.tsx
if (usageType === 'preschool') {
  return null;  // Don't show to preschool parents
}
```

2. **Fix "today" detection**:
```tsx
const TODAY = new Date().toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
// Then compare: exam.date === TODAY
```

3. **Add disclaimer**:
```tsx
<div className="text-xs text-muted-foreground mt-2">
  ⚠️ Exam dates are approximate. Please verify with your school or DBE website.
</div>
```

---

## 📞 Next Steps

1. **Confirm priority**: Which fix should we implement first?
2. **Get real exam dates**: Need official 2025/2026 DBE calendar
3. **Test organization types**: Verify all scenarios work
4. **Update Dash AI**: Add exam schedule awareness

---

**Questions to Answer**:
1. Should we create separate calendars for each education phase?
2. Do we have official 2025/2026 exam dates from DBE?
3. Should Dash AI have real-time access to exam schedule?
4. How do we backfill student grades for existing users?

