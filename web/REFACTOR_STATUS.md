# Web App Refactor Status

**Branch**: `cursor/fix-inconsistent-hook-order-in-parent-dashboard-265a`  
**Date**: 2025-11-02  
**Status**: ? Core Parent Features Complete

---

## ? **COMPLETED** - Parent Dashboard Pages

### 1. Messages Page (`/dashboard/parent/messages`)
**Status**: ? Fully Functional  
**Features**:
- Real-time message thread listing
- Unread message counts with badges
- Search functionality (filter by participant, student, content)
- Teacher/Principal avatars and roles
- Last message preview
- Timestamp formatting (Just now, Today, etc.)
- Click to view thread details
- Empty state handling
- Error handling with retry

**Hook**: `useParentMessaging.ts`
- `useParentThreads()` - Fetches threads with participants & unread counts
- `useThreadMessages()` - Fetches messages for specific thread
- `useSendMessage()` - Sends new message
- `useCreateThread()` - Creates new thread

---

### 2. Homework Page (`/dashboard/parent/homework`)
**Status**: ? Fully Functional with Conditional UI  
**Features**:
- **For School-Affiliated Parents (`hasOrganization=true`)**:
  - View all homework assignments
  - Stats cards (Pending, Overdue, Completed, Total)
  - Organized sections: Overdue, Pending, Completed
  - Due date formatting with urgency indicators
  - Teacher feedback display
  - Subject and class info
  - Estimated time display
  
- **For Standalone Parents (`hasOrganization=false`)**:
  - AI Homework Helper CTA
  - Feature list for AI assistance
  - Link to AI Help page

**Hook**: `useHomework.ts`
- `useChildHomework()` - Fetches assignments with submissions
- `useHomeworkStats()` - Calculates stats (total, completed, pending, overdue)

---

### 3. Calendar Page (`/dashboard/parent/calendar`)
**Status**: ? Fully Functional with Conditional UI  
**Features**:
- **For School-Affiliated Parents (`hasOrganization=true`)**:
  - Grouped by date (Today, Tomorrow, specific dates)
  - Class events display
  - Homework due dates as calendar items
  - Event type icons (homework, class, school, exam)
  - Time display with start/end
  - Class context for each event
  - Empty state when no events
  
- **For Standalone Parents (`hasOrganization=false`)**:
  - Personal learning calendar concept
  - Feature preview (study sessions, reminders, goals)
  - "Coming soon" messaging

**Hook**: `useCalendar.ts`
- `useChildCalendarEvents()` - Fetches events + homework due dates

---

## ?? **INFRASTRUCTURE ALREADY BUILT**

### Conditional Rendering System
All pages use the **existing** `hasOrganization` flag from `useParentDashboardData()`:

```typescript
const { hasOrganization } = useParentDashboardData();

// Show school features
{hasOrganization && <SchoolOnlyFeature />}

// Show standalone features
{!hasOrganization && <StandaloneFeature />}
```

**No new routing or user type hooks needed!** The conditional UI is built into each page.

---

## ?? **HOW IT WORKS**

### User Type Detection (Existing!)
Located in: `/web/src/lib/hooks/useParentDashboardData.ts`

```typescript
const hasOrganization = !!profile?.preschoolId;
```

**Logic**:
- `preschool_id` exists ? `hasOrganization = true` ? Show school features
- `preschool_id` is NULL ? `hasOrganization = false` ? Show standalone features

### Navigation (Already Adaptive!)
Located in: `/web/src/components/dashboard/parent/ParentShell.tsx`

```typescript
if (hasOrganization) {
  // Messages, Calendar, Progress, Payments
} else {
  // AI Help, Lessons, Homework, Progress
}
```

---

## ? **REMAINING WORK**

### 1. Payments Page (In Progress)
**Current State**: Mock UI with hardcoded data  
**Needs**:
- Real proof-of-payment upload
- Fetch actual fee data from database
- Display payment history
- Only show for `hasOrganization=true`

### 2. Progress Page
**Current State**: Placeholder  
**Needs**: Port progress tracking from mobile app

### 3. Children Management Page
**Current State**: Basic UI  
**Needs**: Full CRUD operations for children

### 4. Settings Page
**Current State**: Basic UI  
**Needs**: Profile editing, preferences, notifications

---

## ?? **FILES CREATED/MODIFIED**

### New Hooks
- ? `/web/src/lib/hooks/parent/useParentMessaging.ts`
- ? `/web/src/lib/hooks/parent/useHomework.ts`
- ? `/web/src/lib/hooks/parent/useCalendar.ts`

### Updated Pages
- ? `/web/src/app/dashboard/parent/messages/page.tsx`
- ? `/web/src/app/dashboard/parent/homework/page.tsx`
- ? `/web/src/app/dashboard/parent/calendar/page.tsx`
- ? `/web/src/app/dashboard/parent/payments/page.tsx` (needs real data)

### Already Existing (No Changes Needed)
- ? `/web/src/lib/hooks/useParentDashboardData.ts` (has `hasOrganization`)
- ? `/web/src/components/dashboard/parent/ParentShell.tsx` (adaptive nav)
- ? `/web/src/components/dashboard/parent/QuickActionsGrid.tsx` (conditional)
- ? `/web/src/components/dashboard/parent/OrganizationBanner.tsx` (conditional)

---

## ?? **NEXT STEPS**

### Phase 1: Complete Parent Dashboard (1-2 days)
1. ? Finish Payments page with real data
2. ? Port Progress detail page
3. ? Complete Children management
4. ? Enhance Settings page

### Phase 2: Teacher Dashboards (3-5 days)
1. ? Split teacher routes (school vs private)
2. ? Build school teacher dashboard
3. ? Build private teacher dashboard

### Phase 3: Testing (2 days)
1. ? Test standalone parent flow
2. ? Test affiliated parent flow
3. ? Test private teacher flow
4. ? Test school teacher flow

---

## ?? **KEY INSIGHTS**

### What Worked Well
1. ? **Porting, not rebuilding** - Copied logic from mobile, replaced UI
2. ? **Reusing hooks** - `useParentDashboardData` already had everything
3. ? **Conditional rendering** - Simple `{hasOrganization && ...}` checks
4. ? **No new routes needed** - Same route, different UI based on user type

### What to Avoid
1. ? **Don't create new user type detection hooks** - Already exists!
2. ? **Don't create separate routes** - Use conditional rendering
3. ? **Don't rebuild from scratch** - Port existing mobile logic

---

## ?? **Progress**

**Parent Dashboard**: ~65% Complete
- ? Main dashboard (100%)
- ? Messages (100%)
- ? Homework (100%)
- ? Calendar (100%)
- ? Payments (40%)
- ? Progress (20%)
- ? Children (50%)
- ? Settings (30%)

**Overall Web App**: ~60% Complete

---

**Last Updated**: 2025-11-02  
**Next Session**: Continue with Payments page real data integration
