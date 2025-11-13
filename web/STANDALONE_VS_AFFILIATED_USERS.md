# Standalone vs Affiliated Users - Critical Architecture

**Date**: 2025-11-02  
**Priority**: HIGH - This is a core architectural distinction

---

## 🎯 User Type Architecture

EduDash Pro supports **TWO FUNDAMENTALLY DIFFERENT USER MODELS**:

### 1. **Affiliated Users** (Organization-Based)
Users connected to schools/preschools (`preschool_id` IS NOT NULL)

### 2. **Standalone/Independent Users** (Individual Subscriptions)
Users without organization affiliation (`preschool_id` IS NULL)

---

## 📊 User Type Matrix

| User Type | Organization Type | `preschool_id` | Subscription | Dashboard Features |
|-----------|-------------------|----------------|--------------|-------------------|
| **School Parent** | `preschool` | ✅ EXISTS | School pays | Messages, attendance, school calendar, fees |
| **Standalone Parent** | `individual` | ❌ NULL | Parent pays (R49-R149) | Homework help, exam prep, progress tracking |
| **School Teacher** | `preschool` | ✅ EXISTS | School pays | Class management, attendance, assignments |
| **Private Teacher** | `individual` | ❌ NULL | Teacher pays (R299) | Private tutoring, lesson planning, grading |
| **Principal** | `preschool` | ✅ EXISTS | School pays | School analytics, financials, staff management |

---

## 💰 Subscription Tiers

### For Standalone Parents (Individual Subscription)

**Parent Starter** - R49/month (R470/year)
- ✅ 30 AI Homework Helper queries/month
- ✅ Child-safe AI explanations
- ✅ Progress tracking (1 child)
- ✅ Email support
- ❌ No school features (messages, attendance, etc.)
- ❌ No teacher communication

**Parent Plus** - R149/month (R1,430/year)
- ✅ 100 AI Homework Helper queries/month
- ✅ Priority processing
- ✅ Progress tracking (up to 3 children)
- ✅ Advanced learning insights
- ✅ WhatsApp Connect
- ✅ Learning resources
- ❌ Still no school features

### For Private Teachers (Individual Subscription)

**Private Teacher** - R299/month (R2,990/year)
- ✅ 200 AI queries/month
- ✅ Unlimited lesson generation (50/month)
- ✅ AI grading assistant (25/month)
- ✅ STEM activity generator (25/month)
- ✅ Student progress tracking
- ✅ Assignment management
- ❌ No school admin features
- ❌ No class/school management

### For Organizations (School/Preschool Subscription)

**Free** - R0
- Basic features
- School affiliation required

**Starter** - R299/month
- School management features
- 2+ teachers minimum
- Parent portal included

**Premium** - R599/month
- Advanced analytics
- API access
- Custom branding

**Enterprise** - Custom pricing
- White-label
- Dedicated support
- Unlimited seats

---

## 🏗️ Database Schema

### Key Fields

```sql
-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  preschool_id UUID REFERENCES preschools(id), -- NULL for standalone users
  organization_id UUID REFERENCES organizations(id), -- NULL for standalone
  role TEXT, -- 'parent', 'teacher', 'principal', etc.
  subscription_tier TEXT, -- 'parent-starter', 'parent-plus', 'private-teacher', etc.
  ...
);

-- Standalone users have:
-- preschool_id = NULL
-- organization_id = NULL
-- subscription_tier IN ('parent-starter', 'parent-plus', 'private-teacher')
```

### Detection Logic

```typescript
// From /lib/subscriptionRules.ts
export async function getOrgType(): Promise<OrgType> {
  // Check user metadata
  const orgTypeMeta = user?.user_metadata?.org_type
  if (orgTypeMeta === 'k12' || orgTypeMeta === 'school') return 'k12'
  if (orgTypeMeta === 'preschool') return 'preschool'

  // Check profile
  if (profile?.preschool_id) return 'preschool'
  
  // Default to individual
  return 'individual'
}
```

---

## 🎨 Dashboard Differences

### Standalone Parent Dashboard

**Features AVAILABLE:**
- ✅ AI Homework Helper
- ✅ Exam Prep (CAPS-aligned practice tests)
- ✅ Child progress tracking
- ✅ CAPS Activities (educational games)
- ✅ Learning resources
- ✅ Progress analytics

**Features NOT AVAILABLE:**
- ❌ School messages (no teachers to message)
- ❌ School calendar (no school events)
- ❌ Attendance tracking (no school to attend)
- ❌ Fee payments (no school fees)
- ❌ Teacher communication

**UI Differences:**
```tsx
// Standalone parent dashboard should show:
- "Welcome to EduDash Pro" (not "Welcome to [School Name]")
- Self-study tools prominent
- Upgrade prompts to Parent Plus
- No school selector/switcher
- No "Link to School" CTA
```

### Affiliated Parent Dashboard

**Features AVAILABLE:**
- ✅ All standalone features PLUS:
- ✅ Messages with teachers
- ✅ School calendar/events
- ✅ Attendance records
- ✅ Fee payments/POP uploads
- ✅ School announcements
- ✅ Teacher-assigned homework (in addition to AI-generated)

**UI Differences:**
```tsx
// Affiliated parent dashboard should show:
- School name prominently
- Messages icon with unread count
- School calendar widget
- Attendance summary
- Fee status banner (if overdue)
```

### Private Teacher Dashboard

**Features AVAILABLE:**
- ✅ Create lessons
- ✅ Generate worksheets
- ✅ AI grading assistant
- ✅ Track student progress (private students)
- ✅ Generate reports

**Features NOT AVAILABLE:**
- ❌ School class management
- ❌ School attendance system
- ❌ School calendar
- ❌ Principal approvals
- ❌ School-wide analytics

**UI Differences:**
```tsx
// Private teacher dashboard should show:
- "My Students" (not "My Classes")
- Individual student cards
- Private tutoring schedule
- No school branding
- Upgrade prompts to Pro tier
```

### School Teacher Dashboard

**Features AVAILABLE:**
- ✅ All private teacher features PLUS:
- ✅ Class management
- ✅ School attendance marking
- ✅ School calendar integration
- ✅ Bulk actions (assign to class)
- ✅ School communication tools
- ✅ Principal oversight

---

## 🔍 How to Detect User Type (Web App)

### In Components

```typescript
import { createClient } from '@/lib/supabase/client'

export function useUserType() {
  const [userType, setUserType] = useState<'standalone' | 'affiliated'>('standalone')
  
  useEffect(() => {
    async function detectUserType() {
      const supabase = createClient()
      
      // Get profile
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('preschool_id, organization_id, subscription_tier')
        .eq('id', user.id)
        .single()
      
      // Determine type
      if (profile?.preschool_id || profile?.organization_id) {
        setUserType('affiliated')
      } else {
        setUserType('standalone')
      }
    }
    
    detectUserType()
  }, [])
  
  return userType
}
```

### Routing Logic

```typescript
// In parent dashboard
if (userType === 'standalone') {
  // Redirect to standalone parent dashboard
  router.push('/dashboard/parent/standalone')
} else {
  // Show affiliated parent dashboard
  router.push('/dashboard/parent')
}
```

---

## 📋 Dashboard Implementation Matrix

### Parent Dashboards Needed

| Route | User Type | Features |
|-------|-----------|----------|
| `/dashboard/parent` | Affiliated | School features (messages, attendance, fees) |
| `/dashboard/parent/standalone` | Standalone | Self-study features (homework help, exam prep) |

**Shared Features:**
- Child progress tracking
- CAPS Activities
- Exam Prep
- AI Homework Helper (quota-based)

**Different Features:**
- Affiliated: School communication, attendance, fees
- Standalone: No school features, direct payment, upgrade prompts

### Teacher Dashboards Needed

| Route | User Type | Features |
|-------|-----------|----------|
| `/dashboard/teacher` | Affiliated | Class management, school attendance, school calendar |
| `/dashboard/teacher/private` | Standalone | Private tutoring, individual students, billing |

---

## 🚀 Implementation Strategy

### Phase 1: Detect User Type (1 day)

1. Create `useUserType()` hook
2. Create `useIsAffiliated()` hook
3. Add user type to auth context
4. Test detection logic

### Phase 2: Split Dashboards (1 week)

#### Standalone Parent Dashboard
```
/dashboard/parent/standalone/
├── page.tsx                    # Main dashboard
├── homework-helper/page.tsx   # AI homework help
├── exam-prep/page.tsx         # Practice tests
├── progress/page.tsx          # Child progress
└── settings/page.tsx          # Subscription, billing
```

#### Affiliated Parent Dashboard
```
/dashboard/parent/
├── page.tsx                    # School-connected dashboard
├── messages/page.tsx          # Teacher messages
├── calendar/page.tsx          # School calendar
├── attendance/page.tsx        # School attendance
├── payments/page.tsx          # School fees
├── homework/page.tsx          # School assignments
└── settings/page.tsx          # Profile settings
```

### Phase 3: Conditional Rendering (2-3 days)

Add conditional logic to existing pages:

```typescript
export default function ParentDashboard() {
  const { isAffiliated } = useUserType()
  
  if (!isAffiliated) {
    // Redirect to standalone dashboard
    router.push('/dashboard/parent/standalone')
    return null
  }
  
  // Show affiliated features
  return <AffiliatedParentDashboard />
}
```

---

## ⚠️ Critical Considerations

### 1. Feature Gating

Always check organization type before showing features:

```typescript
// DON'T show school features to standalone users
{isAffiliated && (
  <Link href="/dashboard/parent/messages">Messages</Link>
)}

// DO show upgrade prompts to standalone users
{!isAffiliated && subscription === 'parent-starter' && (
  <UpgradePrompt tier="parent-plus" />
)}
```

### 2. Data Queries

Filter queries based on user type:

```typescript
// For affiliated users - query by preschool_id
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('preschool_id', profile.preschool_id)

// For standalone users - skip preschool-specific queries
// (or they'll return empty results)
```

### 3. Subscription Management

Different payment flows:

```typescript
// Affiliated: School pays, no individual billing
// Standalone: Individual subscription, direct payment

if (isAffiliated) {
  // Show "Managed by [School Name]"
  // No upgrade buttons
} else {
  // Show subscription tier
  // Show upgrade options
  // Show billing page
}
```

---

## 📊 Current Implementation Status

### Mobile App (React Native)

✅ **Fully Implemented**:
- Subscription tier detection
- Feature gating based on tier
- Different AI quotas per tier
- Upgrade prompts for standalone users

### Web App (Next.js)

⏳ **Needs Implementation**:
- Separate dashboard routes for standalone vs affiliated
- Conditional feature rendering
- Subscription management UI
- Upgrade flow for standalone users

---

## 🎯 Next Steps for Web App

### Immediate (This Week)

1. **Create `useUserType()` hook**
   - Detect standalone vs affiliated
   - Cache in context
   - Expose to all components

2. **Add user type routing logic**
   - Redirect standalone parents to `/standalone`
   - Keep affiliated parents on main dashboard

3. **Hide school features from standalone users**
   - Messages
   - Attendance
   - Calendar
   - Fees

### Short-term (Next 2 Weeks)

4. **Build standalone parent dashboard**
   - Homework Helper prominent
   - Exam Prep widget
   - Progress tracking
   - Upgrade prompts

5. **Build private teacher dashboard**
   - Private student management
   - Lesson generation
   - Billing section

### Long-term (1 Month)

6. **Subscription management**
   - Payment flow (Payfast)
   - Upgrade/downgrade
   - Usage tracking
   - Billing history

---

## 📝 Testing Checklist

### Test Standalone Parent

- [ ] Sign up without school affiliation
- [ ] Verify `preschool_id` is NULL
- [ ] Access homework helper
- [ ] Try to access school features (should be hidden/disabled)
- [ ] See upgrade prompts
- [ ] Track usage quota

### Test Affiliated Parent

- [ ] Sign up with school affiliation
- [ ] Verify `preschool_id` is populated
- [ ] Access all school features
- [ ] No upgrade prompts (school pays)
- [ ] School name displayed prominently

### Test Private Teacher

- [ ] Sign up as private teacher
- [ ] Verify `preschool_id` is NULL
- [ ] Access tutoring features
- [ ] No school management features
- [ ] Subscription management visible

---

**Last Updated**: 2025-11-02  
**Status**: Documentation Complete - Implementation Pending  
**Priority**: HIGH - Core architectural requirement
