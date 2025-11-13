# Parent Dashboard Testing Checklist

**Last Updated:** 2025-10-28  
**Environment:** Development  
**URL:** http://localhost:3000/dashboard/parent

---

## 🎯 Pre-Test Setup

### Required Test Accounts
- [ ] Parent account with email/password
- [ ] Parent account with at least 1 child linked
- [ ] Parent account with multiple children (test child selector)
- [ ] Parent account with no children (test empty state)

### Browser Testing
- [ ] Chrome/Chromium (primary)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile Chrome (responsive test)

---

## 🔐 Authentication Flow

### Sign In Page (`/sign-in`)
- [ ] Page loads with dark theme styling
- [ ] Email input field functional
- [ ] Password input field functional
- [ ] "Show/Hide Password" toggle works
- [ ] "Remember me" checkbox works
- [ ] Error messages display for invalid credentials
- [ ] Loading state shows during authentication
- [ ] Successful login redirects based on role:
  - [ ] Parent → `/dashboard/parent`
  - [ ] Teacher → `/dashboard/teacher`
  - [ ] Principal → `/dashboard/principal`
  - [ ] Superadmin → `/dashboard/admin`

### Sign Out
- [ ] User menu dropdown opens on click
- [ ] "Sign Out" button visible
- [ ] Sign out redirects to `/sign-in`
- [ ] Session cleared (can't access dashboard after)

---

## 🏠 Dashboard Layout

### Navigation Header
- [ ] Logo displays correctly
- [ ] "EduDash Pro" text visible
- [ ] Logo links to home page (`/`)
- [ ] User menu button shows user avatar
- [ ] Email displayed in user menu (desktop)
- [ ] Role badge shows "PARENT" in blue
- [ ] Dropdown menu opens/closes correctly
- [ ] Backdrop click closes menu
- [ ] Home link in menu works
- [ ] Settings button present (even if placeholder)

### Footer
- [ ] Footer displays at bottom of page
- [ ] 4-column grid layout (responsive)
- [ ] "EduDash Pro" branding section
- [ ] Quick Links section with working links:
  - [ ] Home
  - [ ] Privacy Policy
  - [ ] Terms of Service
  - [ ] POPIA Compliance
- [ ] Support section with email and hours
- [ ] "Get the App" section with Play Store link
- [ ] Copyright year is current (2025)
- [ ] "Made with ❤️ in South Africa 🇿🇦" displays

---

## 📊 Loading States

### Initial Load
- [ ] Loading skeleton displays before data loads
- [ ] Skeleton shows nav, metric cards, action cards
- [ ] Footer visible during loading
- [ ] Smooth transition from skeleton to real content

### Refresh
- [ ] Refresh button in header works
- [ ] Data refetches when clicked
- [ ] Loading state shows during refresh (optional)

---

## 👶 Child Management

### No Children State
- [ ] "No Children Found" message displays
- [ ] Icon shows (Users icon)
- [ ] Explanation text clear
- [ ] "Claim Your Child" button present
- [ ] Button redirects to `/dashboard/claim-child`

### Single Child
- [ ] Child selector doesn't display (only 1 child)
- [ ] Dashboard shows data for that child
- [ ] Child's name used in context if displayed

### Multiple Children
- [ ] Child selector displays at top
- [ ] "Select Child" label shows
- [ ] Horizontal scrollable list of children
- [ ] Each child shows:
  - [ ] Avatar/icon
  - [ ] First and last name
  - [ ] Grade level
- [ ] Active child highlighted (blue background)
- [ ] Click switches active child
- [ ] Dashboard data updates when child switched
- [ ] Selection persists in localStorage

---

## 📈 Dashboard Sections

### Header Section
- [ ] Greeting displays correct time of day:
  - [ ] "Good Morning!" (< 12pm)
  - [ ] "Good Afternoon!" (12pm - 6pm)
  - [ ] "Good Evening!" (> 6pm)
- [ ] "Welcome to your parent dashboard" subtitle
- [ ] Refresh button visible and functional

### "At a Glance" Metrics
- [ ] Section title displays
- [ ] Collapsible section works (expand/collapse)
- [ ] 4 metric cards in grid (2x2 mobile, 4x1 desktop)

#### Today's Attendance Card
- [ ] Icon shows (CheckCircle for present, AlertCircle for absent/late)
- [ ] Value shows status: Present/Absent/Late/Unknown
- [ ] Color coding:
  - [ ] Green (#10b981) for Present
  - [ ] Red (#ef4444) for Absent
  - [ ] Orange (#f59e0b) for Late/Unknown

#### Pending Homework Card
- [ ] Icon shows (FileText)
- [ ] Number displays correctly
- [ ] Blue color (#3b82f6)
- [ ] Clickable (navigates to `/dashboard/homework`)
- [ ] Hover effect works

#### Upcoming Events Card
- [ ] Icon shows (Calendar)
- [ ] Number displays correctly
- [ ] Purple color (#8b5cf6)
- [ ] Clickable (navigates to `/dashboard/calendar`)
- [ ] Hover effect works

#### Unread Messages Card
- [ ] Icon shows (MessageCircle)
- [ ] Number displays correctly
- [ ] Pink color (#ec4899)
- [ ] Clickable (navigates to `/dashboard/messages`)
- [ ] Hover effect works

### Fees Due Alert (Conditional)
- [ ] Only shows if fees are due
- [ ] Red warning style (red-900/20 background)
- [ ] Dollar icon displays
- [ ] "Overdue Fees" or "Fees Due" title
- [ ] Amount shows in ZAR format: "R X,XXX"
- [ ] Due date shows if available
- [ ] "Pay Now" button present
- [ ] Button navigates to `/dashboard/payments`

### "Quick Actions" Section
- [ ] Section title displays
- [ ] Collapsible section works
- [ ] 6 action cards in grid (2x3 mobile, 4 desktop)

#### Action Cards
1. **View Progress**
   - [ ] TrendingUp icon, green (#10b981)
   - [ ] Navigates to `/dashboard/progress`

2. **Homework**
   - [ ] FileText icon, blue (#3b82f6)
   - [ ] Navigates to `/dashboard/homework`

3. **Messages**
   - [ ] MessageCircle icon, pink (#ec4899)
   - [ ] Shows unread count if > 0
   - [ ] Navigates to `/dashboard/messages`

4. **Calendar**
   - [ ] Calendar icon, purple (#8b5cf6)
   - [ ] Navigates to `/dashboard/calendar`

5. **AI Help**
   - [ ] Brain icon, orange (#f59e0b)
   - [ ] Shows usage count: "X uses this month"
   - [ ] Navigates to `/dashboard/ai-help`

6. **Lessons**
   - [ ] GraduationCap icon, cyan (#06b6d4)
   - [ ] Navigates to `/dashboard/lessons`

### "Child Information" Section
- [ ] Section title displays
- [ ] Collapsible section works
- [ ] Default collapsed on load
- [ ] When expanded shows:
  - [ ] Full Name (first + last)
  - [ ] Grade level
  - [ ] Class name (if available)
  - [ ] Date of Birth (formatted)
- [ ] Data in 2-column grid (1 column mobile)

---

## 🎨 Visual & UX

### Dark Theme
- [ ] Background: gray-900 (#111827)
- [ ] Cards: gray-800 (#1f2937)
- [ ] Text: white (#ffffff)
- [ ] Secondary text: gray-400 (#9ca3af)

### Typography
- [ ] System font stack loads
- [ ] Headings bold and clear
- [ ] Body text readable
- [ ] Font sizes appropriate for hierarchy

### Spacing & Layout
- [ ] Consistent padding (16px, 24px, 32px)
- [ ] Card gaps even (16px)
- [ ] No overlapping elements
- [ ] Content within max-width container (7xl)

### Animations
- [ ] Card hover effects smooth
- [ ] Collapsible sections animate open/close
- [ ] Framer Motion transitions work
- [ ] No jank or stuttering
- [ ] Page transitions smooth

### Responsive Design
- [ ] Desktop (≥1024px): 4-column grids
- [ ] Tablet (768-1023px): 2-3 columns
- [ ] Mobile (<768px): 1-2 columns
- [ ] Navigation collapses on mobile
- [ ] Footer stacks vertically on mobile
- [ ] No horizontal scroll on any screen size

### Icons
- [ ] All Lucide icons render correctly
- [ ] Icon colors match design
- [ ] Icon sizes consistent
- [ ] No missing/broken icons

### Scrolling
- [ ] Custom scrollbar shows (webkit)
- [ ] Smooth scrolling behavior
- [ ] Footer stays at bottom (sticky footer pattern)
- [ ] No double scrollbars

---

## ⚠️ Error Handling

### Error Boundary
- [ ] Catches component errors
- [ ] Shows error UI with "Oops!" message
- [ ] Displays error details in collapsible section
- [ ] "Refresh Page" button works
- [ ] Doesn't crash entire app

### Network Errors
- [ ] Handles Supabase connection errors
- [ ] Shows error messages to user
- [ ] Retry functionality works
- [ ] Graceful degradation (shows what data is available)

### Missing Data
- [ ] Empty states show when no data
- [ ] No console errors for undefined data
- [ ] Null-safe rendering throughout

---

## 🔒 Security

### Authentication
- [ ] Can't access dashboard without login
- [ ] Session validated on page load
- [ ] Redirects to sign-in if not authenticated
- [ ] Role verified (parent-only access)

### Data Privacy
- [ ] Only shows data for linked children
- [ ] No data leakage between users
- [ ] preschool_id filters applied (check Network tab)

---

## ⚡ Performance

### Load Time
- [ ] Initial page load < 2 seconds
- [ ] Time to Interactive (TTI) < 3 seconds
- [ ] Largest Contentful Paint (LCP) < 2.5s

### Runtime
- [ ] No memory leaks (check DevTools)
- [ ] Smooth 60fps animations
- [ ] No unnecessary re-renders
- [ ] Efficient data fetching (check Network tab)

### Bundle Size
- [ ] JavaScript bundle reasonable size
- [ ] CSS bundle loads quickly
- [ ] Images optimized (if any)

---

## 🐛 Known Issues

### To Fix
- [ ] Supabase client warning in console (GoTrueClient)
- [ ] ~~Tailwind CSS not loading~~ ✅ FIXED
- [ ] ~~404 on /login route~~ ✅ FIXED (now /sign-in)

### Future Improvements
- [ ] Add loading skeleton for child selector
- [ ] Add optimistic UI updates
- [ ] Add toast notifications
- [ ] Add keyboard shortcuts
- [ ] Add offline support
- [ ] Add PWA features

---

## 📱 Mobile-Specific Tests

### Touch Interactions
- [ ] All buttons tappable (44x44px minimum)
- [ ] Swipe gestures work (if implemented)
- [ ] Pull-to-refresh works (if implemented)
- [ ] No accidental double-taps

### Mobile Browser
- [ ] Works in mobile Chrome
- [ ] Works in mobile Safari
- [ ] Address bar auto-hides on scroll
- [ ] No viewport zoom issues

---

## ✅ Test Results

### Date: ___________
### Tester: ___________
### Browser: ___________
### Passed: ___ / ___
### Failed: ___ / ___

### Critical Issues Found:
1. 
2. 
3. 

### Notes:


---

**Status Key:**
- ✅ Pass
- ❌ Fail
- ⚠️ Warning
- 🔧 Needs Fix
- ⏳ Pending
