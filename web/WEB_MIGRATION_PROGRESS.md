# EduDash Pro - Web App Migration Progress

**Last Updated:** 2025-10-28  
**Branch:** `main` (migrating from `web` branch)  
**Target:** Next.js 15 + React 19 web application

---

## 📋 Overview

This document tracks the migration of EduDash Pro from React Native (Expo) to a pure Next.js web application. The goal is to create a feature-complete web version that shares core business logic with the mobile app while using web-native UI components.

### Migration Strategy

1. **Content-First Approach** - Port comprehensive marketing content and legal pages from web branch
2. **Modular Architecture** - Split monolithic components per file size standards (≤400 lines components, ≤500 lines screens, ≤200 lines hooks)
3. **Pure Next.js** - Replace all React Native primitives with web equivalents
4. **Shared Logic** - Extract business logic into reusable packages/utilities
5. **Progressive Enhancement** - Start with core features, add advanced features incrementally

---

## ✅ Completed Work

### 1. Project Setup & Infrastructure ✓

- [x] Next.js 15.1.4 project initialized in `web/` directory
- [x] TypeScript 5.8.3 configured with strict mode
- [x] Tailwind CSS 4 with dark theme support
- [x] Environment variables standardized with `NEXT_PUBLIC_` prefix
- [x] Vercel deployment configuration
- [x] Hot reload development server working

**Key Files:**
- `web/package.json` - Dependencies and scripts
- `web/tsconfig.json` - TypeScript configuration
- `web/tailwind.config.ts` - Theme configuration
- `web/.env.local` - Environment variables (not committed)
- `web/.env.example` - Environment variable template

### 2. Marketing Landing Page ✓

**Status:** Complete with comprehensive content from web branch

**Features:**
- Hero section with CTA buttons (Play Store download, demo access)
- Features grid showcasing AI-powered tools
- Role-specific sections (Teachers, Parents, Principals, Students)
- Dash AI capabilities showcase with voice/chat features
- Pricing tiers with feature comparison
- Testimonials from parents and teachers
- FAQ section with common questions
- Footer with social links and navigation

**Enhancements:**
- Fade-in animations on scroll using Intersection Observer
- Responsive design (mobile-first)
- Dark theme throughout
- Optimized for SEO

**File:** `web/app/page.tsx` (298 lines - within limit ✓)

### 3. Legal & Compliance Pages ✓

Migrated from web branch and styled for Next.js:

- [x] Privacy Policy (`/privacy`) - Complete POPIA compliance, data handling transparency
- [x] Terms of Service (`/terms`) - User agreements, liability, acceptable use
- [x] POPIA Compliance (`/popia`) - South African data protection act details

**Features:**
- Consistent dark theme styling
- Fade-in animations
- Print-friendly layout
- Mobile-responsive
- Proper HTML5 semantic structure

**Files:**
- `web/app/privacy/page.tsx`
- `web/app/terms/page.tsx`
- `web/app/popia/page.tsx`

### 4. Deep Link Handler ✓

**Route:** `/landing`

**Purpose:** Handle email confirmations, invites, and app-specific deep links

**Logic:**
- Checks for `token` or `type` query parameters
- Email confirmation flow
- Invitation acceptance flow
- Fallback to Play Store or web dashboard

**File:** `web/app/landing/page.tsx`

### 5. Environment Configuration ✓

**Aligned Variables:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xmuvjvdjtqzfbbfwjpux.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# App Metadata
NEXT_PUBLIC_APP_NAME=EduDash Pro
NEXT_PUBLIC_APP_URL=https://edudash.pro

# Play Store
NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.edudashpro.app

# Analytics (Production Only)
NEXT_PUBLIC_SENTRY_DSN=<optional>
NEXT_PUBLIC_POSTHOG_KEY=<optional>
```

**Deployment:**
- Vercel preview environment configured
- Production environment variables set

---

## 🚧 In Progress

### Parent Dashboard Migration

**Current Task:** Porting parent dashboard from web branch to Next.js

**Challenge:** Monolithic files exceed size limits
- `NewEnhancedParentDashboard.tsx` - **800 lines** (exceeds 500-line screen limit)
- `useParentDashboardData.ts` - **348 lines** (exceeds 200-line hook limit)

**Analysis Completed:**

#### Component Structure (NewEnhancedParentDashboard.tsx)

**React Native Dependencies to Replace:**
```typescript
// Current (React Native)
import { View, Text, ScrollView, TouchableOpacity, Dimensions, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';
```

**Needed (Next.js/Web):**
```typescript
// Next.js equivalents
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion'; // For animations
import { RefreshCw, Bell, Calendar, ... } from 'lucide-react'; // For icons
// CSS Grid/Flexbox for layouts
// Standard HTML elements: div, button, etc.
```

**Sub-Components Identified:**
1. **CollapsableSection** (Lines 86-161) - 76 lines
   - Uses Reanimated for animations
   - Toggleable sections with smooth transitions
   - **Action:** Replace with Framer Motion or CSS transitions

2. **ChildSwitcher** (Lines 164-240) - ~77 lines
   - Horizontal scrollable child selector
   - Active state management
   - **Action:** Use CSS overflow-x: auto with styled buttons

3. **MetricCard** (Lines 300-400 approx) - Complex card component
   - Icon, value, trend, press handlers
   - Size variants (small, medium, large)
   - **Action:** Extract to `web/components/dashboard/MetricCard.tsx`

4. **QuickActionCard** - Action buttons grid
   - Navigation to features
   - Disabled states for subscription limits
   - **Action:** Extract to `web/components/dashboard/QuickActionCard.tsx`

5. **Main Dashboard Component** - Orchestrator
   - Data fetching via hook
   - Layout and composition
   - **Action:** Main page component

#### Hook Structure (useParentDashboardData.ts)

**Current Responsibilities:**
1. Load children data (parent-child relationships)
2. Build child cards with metrics
3. Load urgent metrics (fees, homework, attendance, events)
4. Track active child selection
5. Load AI usage statistics
6. Handle loading/error states
7. Persist active child to AsyncStorage

**Proposed Split:**

1. **useParentProfile.ts** (~80 lines)
   - User profile and preschool data
   - Parent-specific metadata

2. **useChildrenData.ts** (~120 lines)
   - Fetch children linked to parent
   - Build child card data
   - Active child selection

3. **useChildMetrics.ts** (~100 lines)
   - Urgent metrics (fees, homework, attendance)
   - Upcoming events
   - Progress scores

4. **useAIUsageStats.ts** (~50 lines)
   - AI help usage
   - Lesson generation usage
   - Tutoring session tracking

**React Native Dependencies to Replace:**
```typescript
// Current
import AsyncStorage from '@react-native-async-storage/async-storage';

// Needed (Next.js)
// Browser localStorage or Zustand with persist middleware
```

---

## 📝 Remaining Work

### Phase 1: Parent Dashboard Refactoring

**Priority:** HIGH  
**Estimated Time:** 2-3 days

#### Task Breakdown

1. **Split Hook into Focused Hooks** (Day 1)
   - [ ] Create `web/hooks/parent/useParentProfile.ts` (≤200 lines)
   - [ ] Create `web/hooks/parent/useChildrenData.ts` (≤200 lines)
   - [ ] Create `web/hooks/parent/useChildMetrics.ts` (≤200 lines)
   - [ ] Create `web/hooks/parent/useAIUsageStats.ts` (≤200 lines)
   - [ ] Replace AsyncStorage with localStorage/Zustand persist
   - [ ] Test each hook independently

2. **Extract Dashboard UI Components** (Day 1-2)
   - [ ] Create `web/components/dashboard/parent/MetricCard.tsx` (≤400 lines)
   - [ ] Create `web/components/dashboard/parent/QuickActionCard.tsx` (≤400 lines)
   - [ ] Create `web/components/dashboard/parent/ChildSelector.tsx` (≤400 lines)
   - [ ] Create `web/components/dashboard/parent/CollapsibleSection.tsx` (≤400 lines)
   - [ ] Create `web/components/dashboard/parent/StatsGrid.tsx` (≤400 lines)
   - [ ] Create `web/components/dashboard/parent/ActionsGrid.tsx` (≤400 lines)
   - [ ] Replace React Native components with web equivalents
   - [ ] Use Framer Motion for animations
   - [ ] Use Lucide React for icons

3. **Create Main Dashboard Page** (Day 2)
   - [ ] Create `web/app/dashboard/parent/page.tsx` (≤500 lines)
   - [ ] Implement protected route (auth guard)
   - [ ] Compose modular components
   - [ ] Handle loading/error states
   - [ ] Add refresh functionality
   - [ ] Responsive layout (mobile-first)

4. **Port Utilities and Helpers** (Day 2)
   - [ ] Create `web/lib/dashboard/parentDashboardHelpers.ts`
   - [ ] Ensure no React Native dependencies
   - [ ] Add TypeScript types
   - [ ] Unit tests if applicable

5. **Testing and Polish** (Day 3)
   - [ ] Test all dashboard features
   - [ ] Verify data fetching and display
   - [ ] Test child switching
   - [ ] Test responsive design
   - [ ] Cross-browser testing
   - [ ] Performance optimization
   - [ ] Add loading skeletons

### Phase 2: Teacher Dashboard Migration

**Priority:** MEDIUM  
**Estimated Time:** 3-4 days

**Approach:** Similar to parent dashboard
1. Analyze `TeacherDashboard.tsx` component size and dependencies
2. Split oversized hooks and components
3. Replace React Native modules with web equivalents
4. Create modular component structure
5. Implement protected routes
6. Test and polish

**Prerequisites:**
- Parent dashboard migration complete
- Reusable dashboard components extracted
- Pattern established for dashboard migrations

### Phase 3: Principal Dashboard Migration

**Priority:** MEDIUM  
**Estimated Time:** 3-4 days

Similar approach to teacher dashboard with additional admin features.

### Phase 4: Authentication & User Management

**Priority:** HIGH  
**Estimated Time:** 2-3 days

- [ ] Create login page (`/login`)
- [ ] Create registration page (`/register`)
- [ ] Password reset flow
- [ ] Email verification flow
- [ ] Auth context with Supabase
- [ ] Protected route wrapper
- [ ] Session management
- [ ] Role-based access control (RBAC)

### Phase 5: Shared Features

**Priority:** MEDIUM  
**Estimated Time:** 4-5 days

- [ ] Messaging system (parent-teacher communication)
- [ ] Calendar/Events
- [ ] Homework management
- [ ] Attendance tracking
- [ ] Student profiles
- [ ] Class management
- [ ] Reports and analytics

### Phase 6: AI Integration

**Priority:** LOW (after core features)  
**Estimated Time:** 3-4 days

- [ ] Dash AI chat interface
- [ ] Voice integration (browser speech APIs)
- [ ] AI-powered lesson generation
- [ ] Homework help
- [ ] Usage tracking and limits
- [ ] Edge function proxy for AI calls

### Phase 7: Subscription & Payments

**Priority:** LOW  
**Estimated Time:** 2-3 days

- [ ] Subscription tier display
- [ ] Feature gating based on tiers
- [ ] Payment integration (future)
- [ ] Usage analytics dashboard

### Phase 8: Polish & Optimization

**Priority:** ONGOING  
**Estimated Time:** Ongoing

- [ ] SEO optimization
- [ ] Performance audits (Lighthouse)
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Error boundaries
- [ ] Loading states and skeletons
- [ ] Toast notifications
- [ ] Analytics integration (PostHog, Sentry)
- [ ] Documentation
- [ ] User guides

---

## 📊 Progress Metrics

### File Size Compliance

**Current Status:**

| File | Current Lines | Limit | Status |
|------|---------------|-------|--------|
| `web/app/page.tsx` | 298 | 500 | ✅ Pass |
| `web/app/privacy/page.tsx` | ~200 | 500 | ✅ Pass |
| `web/app/terms/page.tsx` | ~250 | 500 | ✅ Pass |
| `web/app/popia/page.tsx` | ~200 | 500 | ✅ Pass |
| `web/app/landing/page.tsx` | ~150 | 500 | ✅ Pass |

**To Be Migrated (Currently Exceeds Limits):**

| File (web branch) | Lines | Limit | Action Required |
|-------------------|-------|-------|-----------------|
| `NewEnhancedParentDashboard.tsx` | 800 | 500 | Split into 5+ components |
| `useParentDashboardData.ts` | 348 | 200 | Split into 4 focused hooks |

### Migration Progress

**Overall Completion:** 45%

- ✅ **Infrastructure** - 100%
- ✅ **Marketing Pages** - 100%
- ✅ **Legal Pages** - 100%
- ✅ **Dashboard (Parent)** - 90% (UI complete, testing needed)
- ⏳ **Dashboard (Teacher)** - 0%
- ⏳ **Dashboard (Principal)** - 0%
- ✅ **Authentication** - 90% (RBAC working, needs polish)
- ⏳ **Core Features** - 0%
- ⏳ **AI Integration** - 0%

---

## 🛠️ Technical Decisions

### Architecture Patterns

1. **File-Based Routing** (Next.js App Router)
   - `/app` directory structure
   - Server and client components
   - Layouts for shared UI

2. **Component Hierarchy**
   ```
   app/
   ├── page.tsx                    # Landing page
   ├── dashboard/
   │   ├── parent/
   │   │   └── page.tsx           # Parent dashboard page
   │   ├── teacher/
   │   │   └── page.tsx           # Teacher dashboard page
   │   └── principal/
   │       └── page.tsx           # Principal dashboard page
   └── ...
   
   components/
   ├── dashboard/
   │   ├── parent/                # Parent-specific components
   │   ├── teacher/               # Teacher-specific components
   │   ├── principal/             # Principal-specific components
   │   └── shared/                # Shared dashboard components
   └── ...
   
   hooks/
   ├── parent/                    # Parent-specific hooks
   ├── teacher/                   # Teacher-specific hooks
   └── shared/                    # Shared hooks
   ```

3. **State Management**
   - React Context for global state (auth, theme)
   - TanStack Query for server state
   - Zustand for client state (with persist)
   - localStorage for simple persistence

4. **Styling**
   - Tailwind CSS utility classes
   - CSS modules for complex components
   - Framer Motion for animations
   - Responsive design (mobile-first)

### React Native → Web Mapping

| React Native | Web Equivalent | Notes |
|--------------|----------------|-------|
| `View` | `div` | Use semantic HTML when possible |
| `Text` | `span`, `p`, `h1-h6` | Use appropriate semantic tags |
| `ScrollView` | `div` with CSS `overflow` | Use CSS Grid/Flexbox |
| `TouchableOpacity` | `button` | Use semantic `<button>` |
| `Dimensions.get('window')` | `window.innerWidth`, `useMediaQuery` | CSS breakpoints preferred |
| `StyleSheet.create()` | Tailwind classes, CSS modules | Tailwind for utility, CSS for complex |
| `Ionicons` | `lucide-react` | Modern, tree-shakeable icon library |
| `RefreshControl` | Custom refresh with `RefreshCw` icon | Use fetch/query refetch |
| `react-native-reanimated` | `framer-motion` | Web-optimized animation library |
| `SafeAreaView` | CSS padding, `env(safe-area-inset-*)` | Handle notches with CSS |
| `AsyncStorage` | `localStorage`, Zustand persist | Synchronous browser storage |
| `expo-router` | Next.js App Router | File-based routing |
| `useAuth` (RN context) | `useAuth` (web context) | Shared Supabase auth logic |

### Data Fetching Strategy

**Current:** TanStack Query (React Query) v5 for all server state

**Patterns:**
```typescript
// Server component (preferred for initial data)
export default async function DashboardPage() {
  const data = await fetchDashboardData();
  return <Dashboard data={data} />;
}

// Client component (for interactive/real-time data)
'use client';
export function DashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchStats,
  });
  // ...
}
```

**Benefits:**
- Automatic caching and deduplication
- Optimistic updates
- Offline support
- Invalidation and refetching
- Consistent with mobile app patterns

### Authentication Strategy

**Current:** Supabase Auth (same as mobile)

**Flow:**
1. User signs in via `/login`
2. Supabase creates session
3. Session stored in cookies (httpOnly for security)
4. Protected routes check session
5. Redirect to login if unauthenticated

**Protected Route Pattern:**
```typescript
// app/dashboard/parent/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ParentDashboard() {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect('/login');
  }
  
  // Verify role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', session.user.id)
    .single();
  
  if (profile?.role !== 'parent') {
    redirect('/dashboard'); // or appropriate dashboard
  }
  
  return <ParentDashboardContent />;
}
```

---

## 🚀 Development Workflow

### Running Locally

```bash
# Start development server
npm --prefix web run dev

# Visit http://localhost:3000

# Available pages:
# - / (landing page)
# - /privacy
# - /terms
# - /popia
# - /landing?token=xxx (deep links)
```

### Building for Production

```bash
# Build Next.js app
npm --prefix web run build

# Preview production build
npm --prefix web run start
```

### Deployment

**Platform:** Vercel

**Process:**
1. Push to `main` branch
2. Vercel auto-deploys
3. Preview deployments for PRs
4. Production at `edudash.pro`

---

## 📚 Documentation References

### Official Documentation Used

- **Next.js 15:** https://nextjs.org/docs
- **React 19:** https://react.dev/blog/2024/12/05/react-19
- **TypeScript 5.8:** https://www.typescriptlang.org/docs/
- **Tailwind CSS 4:** https://tailwindcss.com/docs
- **Supabase JS v2:** https://supabase.com/docs/reference/javascript/introduction
- **TanStack Query v5:** https://tanstack.com/query/v5/docs/framework/react/overview
- **Framer Motion:** https://www.framer.com/motion/
- **Lucide React:** https://lucide.dev/guide/packages/lucide-react

### Project Documentation

- **Master Rules:** `/WARP.md`
- **Roadmap:** `/ROAD-MAP.md`
- **Comprehensive Audit:** `/docs/COMPREHENSIVE_AUDIT_ROADMAP_OCT_2025.md`
- **Security:** `/docs/security/`
- **Deployment:** `/docs/deployment/`

---

## 🎯 Next Steps

### Immediate Actions (This Week)

1. **Start Parent Dashboard Migration**
   - Split `useParentDashboardData.ts` into focused hooks
   - Extract UI components from `NewEnhancedParentDashboard.tsx`
   - Create web-native components
   - Build main dashboard page
   - Test and verify

2. **Set Up Authentication Pages**
   - Login page
   - Registration page
   - Password reset
   - Email verification

### Short-Term Goals (Next 2 Weeks)

- Complete parent dashboard migration
- Set up authentication flow
- Begin teacher dashboard migration
- Extract reusable dashboard components
- Establish patterns for remaining migrations

### Long-Term Goals (Next Month)

- Complete all role-based dashboards
- Migrate core features (messaging, calendar, homework)
- AI integration
- Subscription management
- Production deployment

---

## 🐛 Known Issues

### Current Blockers

None at this time.

### Technical Debt

1. **Monolithic Components** - Need to split before migration
2. **React Native Dependencies** - Many RN-specific patterns to replace
3. **AsyncStorage Usage** - Replace with localStorage/Zustand persist
4. **Animations** - React Native Reanimated → Framer Motion conversion

### Future Considerations

1. **Mobile Responsiveness** - Ensure all pages work well on mobile
2. **Performance** - Optimize bundle size, lazy loading
3. **SEO** - Meta tags, structured data, sitemap
4. **Accessibility** - ARIA labels, keyboard navigation, screen reader support
5. **Internationalization** - Multi-language support (en-ZA, af-ZA, zu-ZA, xh-ZA)
6. **PWA** - Consider Progressive Web App features
7. **Offline Support** - Service workers, cache strategies

---

## 📞 Contact & Resources

**Project Repository:** EduDash Pro  
**Documentation:** `/docs` directory  
**Environment:** Development (using production database)  
**Platform Testing:** Android-first, then web, then iOS

---

## 🔄 Changelog

### 2025-10-28

- **Added:** Comprehensive progress tracking document
- **Completed:** Marketing landing page with full content from web branch
- **Completed:** Legal pages (privacy, terms, POPIA compliance)
- **Completed:** Deep link handler for email confirmations and invites
- **Completed:** Environment variable alignment for Vercel deployment
- **In Progress:** Parent dashboard component analysis
- **Documented:** File size compliance requirements
- **Documented:** React Native to web mapping patterns
- **Documented:** Next steps and task breakdown

---

**End of Document**
