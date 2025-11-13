# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## 🎯 Project Overview

EduDash Pro is a React Native (Expo) mobile-first educational platform for South African learners, parents, and educators. It serves multiple organization types (schools, preschools, districts, tutoring centers) and supports **independent users** (parents without school affiliation). Architected as a multi-tenant SaaS with PostgreSQL/Supabase backend, focusing on student-teacher-parent engagement with AI enhancement.

**Golden Rule**: Always design with students, teachers, and parents at the center. Every feature must make education simpler, smarter, and more engaging.

**User Types**:
- **Affiliated Users**: Connected to schools, preschools, or organizations
- **Independent Users**: Parents/students using the app for self-study and exam prep (no organization)
- **Guest Users**: Temporary access for app evaluation before signup

## 🔨 Common Development Commands

### Project Setup & Development
```bash
# Install dependencies
npm ci

# Start development server (with dev client)
npm run start
npm run start:clear  # with cache cleared

# Android development (physical device preferred)
npm run dev:android  # starts server + opens on Android
npm run android      # run on Android simulator

# iOS development
npm run ios

# Web development (React Native Web)
npm run web
```

### Code Quality & Linting
```bash
# TypeScript type checking
npm run typecheck

# ESLint code linting (max 200 warnings allowed)
npm run lint
npm run lint:fix

# SQL linting (PostgreSQL/Supabase)
npm run lint:sql
npm run fix:sql
./scripts/lint-sql.sh lint   # direct script usage
```

### Database Operations
```bash
# CRITICAL: Never use local Docker or direct SQL execution
# Always use Supabase migrations for schema changes

# Create new migration
supabase migration new <descriptive-name>

# Apply migrations to remote (NO --local flag)
supabase db push

# Verify no schema drift
supabase db diff  # Must show no changes after push

# Lint SQL before push
npm run lint:sql

# Database inspection scripts
npm run inspect-db        # standard inspection
npm run inspect-db-full   # with service role
npm run setup-rls         # RLS policies setup
```

### Testing & Quality Assurance
```bash
# Development testing primarily targets Android-only
# Production database used in development environment
# AdMob test IDs enforced for ad testing

# No formal unit test framework currently configured
# Quality gates enforced via CI/CD pipeline
```

## 🏗️ High-Level Architecture

### Technology Stack
- **Frontend**: React Native 0.79.5 (New Architecture enabled) + Expo SDK 53 + React 19.0.0
- **Navigation**: Expo Router v5 (file-based routing)
- **Backend**: Supabase JS v2.57.4 (PostgreSQL) with Row-Level Security (RLS)
- **State Management**: TanStack Query v5.87.4 with AsyncStorage 2.1.2 persistence
- **Authentication**: Supabase Auth with biometric support (expo-local-authentication)
- **AI Integration**: Anthropic Claude (server-side only via Edge Functions)
- **Voice**: Microsoft Azure Cognitive Services Speech SDK 1.46.0
- **Monitoring**: Sentry Expo 7.0.0 + PostHog React Native 4.3.2 (production only)
- **UI Performance**: Shopify FlashList 1.7.6, React Native Reanimated 3.17.4
- **TypeScript**: 5.8.3 with strict mode
- **Ads**: Google AdMob (test IDs in development)

### Core Architecture Patterns

**Multi-Tenant Security Model**
- **Organization-Agnostic**: Supports `organization_id` (schools, preschools, districts) AND independent users (null organization)
- **Flexible RLS Policies**: Data isolation by organization when applicable, personal data isolation for independent users
- **Role-Based Access Control (RBAC)**: superadmin, principal, teacher, parent, independent_user
- **Tenant Isolation Strategy**:
  - Affiliated users: Filter by `organization_id` (or legacy `preschool_id`)
  - Independent users: Filter by `user_id` only (organization_id is NULL)
  - Guest users: Access to public/demo data only
- Superadmin operations use service role server-side only

**Mobile-First Design**
- 5.5" screen baseline with responsive scaling
- Optimized for low-end Android devices
- Offline-first with TanStack Query caching
- FlashList for performance with large datasets
- Touch targets minimum 44x44 pixels

**AI Integration Security**
- All AI calls via Supabase Edge Function `ai-proxy`
- Usage tracking in `ai_usage_logs` table
- Subscription limits enforced server-side
- PII redaction before AI service calls
- Never expose AI keys client-side

### Directory Structure
```
/
├── app/                    # Expo Router screens and layouts
│   ├── (auth)/            # Authentication flows
│   ├── (parent)/          # Parent role screens
│   ├── screens/           # Shared screen components
│   └── _layout.tsx        # Root layout with providers
├── components/             # Reusable UI components
├── lib/                   # Core libraries and utilities
│   ├── supabase/         # Database client configuration
│   ├── ai-gateway/       # AI integration utilities
│   ├── hooks/            # Custom React hooks
│   └── tenant/           # Multi-tenant utilities
├── services/              # Business logic and API services
├── contexts/              # React contexts (Theme, Auth)
├── assets/               # Static assets and images
├── supabase/             # Database migrations and Edge Functions
├── scripts/              # Development and maintenance scripts
└── docs/                 # Comprehensive documentation
    ├── governance/       # Project rules and policies
    ├── security/         # RLS and authentication docs  
    └── deployment/       # Release procedures
```

## 📋 Project Roadmap & Progression

### Comprehensive Audit Roadmap (Source of Truth)
**File**: `docs/COMPREHENSIVE_AUDIT_ROADMAP_OCT_2025.md`

This document is the **authoritative source** for all Phase 0-7 implementations. All quick wins, onboarding improvements, AI performance optimizations, and language detection features must align with the phases and success metrics defined in this roadmap.

**Phase Overview**:
- **Phase 0** (Days 0-2): Lightning quick wins - onboarding skip, streaming UI, language picker, AI speed
- **Phase 1** (Week 1): Onboarding foundation - reduce friction, personalize, build trust
- **Phase 2** (Weeks 1-2): Dash AI performance - streaming, concurrency, memory optimization
- **Phase 3** (Week 2): Language system - unified UI/voice, proactive suggestions
- **Phase 4** (Parallel): Code quality - TS/ESLint fixes, CI/CD, testing
- **Phase 5** (Weeks 2-4): Complete planned features - Calendar UI, SMS UI, multimodal
- **Phase 6** (Weeks 2-3): Production readiness - DB guardrails, monitoring, secrets
- **Phase 7** (Weeks 3-4): UX polish - accessibility, animations, error handling

**Priority Focus Areas** (from audit):
1. Onboarding adoption (skip/demo mode, progress indicators)
2. Dash AI performance and speed (streaming, remove delays, concurrency)
3. Language detection and use (picker prominence, voice/UI sync)

**Success Metrics** are defined per phase in the comprehensive audit document.

## 📚 Official Documentation References

### Critical: Always Reference Current API Versions
**Master Reference**: `docs/governance/DOCUMENTATION_SOURCES.md`

Before implementing any feature, verify code suggestions are compatible with these versions:

**Core Framework**:

#### React Native 0.79.5
**Documentation**: https://reactnative.dev/docs/0.79/getting-started  
**New Architecture**: https://reactnative.dev/docs/the-new-architecture/landing-page

- ✅ **New Architecture ENABLED** (Fabric + TurboModules)
- ✅ **Functional components with hooks only**
- ❌ **NEVER use deprecated lifecycle methods** (componentWillMount, componentWillReceiveProps, componentWillUpdate)
- ✅ **Use Platform-specific code**: `Platform.OS === 'android'` or `.android.tsx`/`.ios.tsx` files
- ✅ **Performance**: Use React.memo, useCallback, useMemo for expensive operations

**Critical Pattern Example**:
```typescript path=null start=null
// ✅ CORRECT: Functional component with hooks (RN 0.79)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, Platform } from 'react-native';

export const MyComponent = () => {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    // Safe effect with cleanup
    return () => { /* cleanup */ };
  }, []);
  
  const handlePress = useCallback(() => {
    console.log('Pressed');
  }, []);
  
  return <View><Text>Hello</Text></View>;
};

// ❌ WRONG: Class components with deprecated lifecycle
class MyComponent extends React.Component {
  componentWillMount() { } // DEPRECATED!
  componentWillReceiveProps() { } // DEPRECATED!
}
```

#### Expo SDK 53
**Documentation**: https://docs.expo.dev/versions/v53.0.0/  
**Version**: ~53.0.23 (from package.json)

**Key Modules Used**:
- **Expo Router**: https://docs.expo.dev/router/introduction/ (v5.1.7)
- **Expo Image**: https://docs.expo.dev/versions/v53.0.0/sdk/image/
- **Expo Local Authentication**: https://docs.expo.dev/versions/v53.0.0/sdk/local-authentication/
- **Expo Localization**: https://docs.expo.dev/versions/v53.0.0/sdk/localization/
- **Expo Notifications**: https://docs.expo.dev/versions/v53.0.0/sdk/notifications/
- **Expo Updates**: https://docs.expo.dev/versions/v53.0.0/sdk/updates/
- **Expo File System**: https://docs.expo.dev/versions/v53.0.0/sdk/filesystem/
- **Expo Image Picker**: https://docs.expo.dev/versions/v53.0.0/sdk/imagepicker/
- **Expo Audio**: https://docs.expo.dev/versions/v53.0.0/sdk/audio/
- **Expo Speech**: https://docs.expo.dev/versions/v53.0.0/sdk/speech/
- **Expo Secure Store**: https://docs.expo.dev/versions/v53.0.0/sdk/securestore/

**Development Builds**: https://docs.expo.dev/develop/development-builds/introduction/

#### React 19.0.0
**Documentation**: https://react.dev/blog/2024/12/05/react-19  
**Reference**: https://react.dev/reference/react

- ✅ **New hooks**: useActionState, useFormStatus, useOptimistic (client-side only for RN)
- ✅ **ref as prop**: No need for forwardRef in many cases
- ✅ **Improved useEffect cleanup**: Stricter cleanup enforcement
- ❌ **Server Components NOT applicable** (React Native is client-only)
- ✅ **Actions and form handling**: Useful patterns for form submission

#### TypeScript 5.8.3
**Documentation**: https://www.typescriptlang.org/docs/handbook/intro.html  
**Release Notes**: https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/

**CRITICAL tsconfig for React Native**:
```json path=null start=null
{
  "compilerOptions": {
    "target": "esnext",
    "lib": ["esnext"],  // ✅ NO "dom" - prevents DOM global errors
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "strict": false,  // Gradually enable strict mode
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  }
}
```

**Why NO "dom" lib?**  
❌ Including "dom" causes TypeScript to expect browser globals (window, document, fetch) which conflict with React Native globals. Always use `"lib": ["esnext"]` only.

**Backend & Data**:

#### Supabase JS v2.57.4
**Documentation**: https://supabase.com/docs/reference/javascript/introduction  
**Version**: ^2.57.4 (from package.json)

**Authentication**: https://supabase.com/docs/reference/javascript/auth-signinwithpassword

✅ **CORRECT v2 Auth Patterns**:
```typescript path=null start=null
// ✅ Sign in (v2)
await supabase.auth.signInWithPassword({ email, password });

// ✅ Sign up (v2)
await supabase.auth.signUp({ email, password });

// ✅ Sign out (v2)
await supabase.auth.signOut();

// ✅ Get session (v2)
const { data: { session } } = await supabase.auth.getSession();

// ❌ WRONG: v1 patterns
await supabase.auth.signIn({ email, password }); // DEPRECATED!
```

**Database Queries**: https://supabase.com/docs/reference/javascript/select

✅ **Multi-Tenant RLS Pattern** (CRITICAL for EduDash Pro):
```typescript path=null start=null
// ✅ ALWAYS filter by preschool_id for tenant isolation
const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('preschool_id', userPreschoolId);  // REQUIRED!

// ✅ Insert with preschool_id
const { data, error } = await supabase
  .from('assignments')
  .insert({ 
    title: 'Math Homework',
    preschool_id: userPreschoolId,  // REQUIRED!
    teacher_id: userId 
  });

// ✅ Update with RLS protection
const { data, error } = await supabase
  .from('students')
  .update({ status: 'active' })
  .eq('id', studentId)
  .eq('preschool_id', userPreschoolId);  // REQUIRED!

// ✅ Delete with RLS protection
const { data, error } = await supabase
  .from('tasks')
  .delete()
  .eq('id', taskId)
  .eq('preschool_id', userPreschoolId);  // REQUIRED!
```

**Storage**: https://supabase.com/docs/reference/javascript/storage-from-upload

```typescript path=null start=null
// ✅ Upload file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${preschoolId}/${userId}/avatar.png`, file);

// ✅ Download file URL
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${preschoolId}/${userId}/avatar.png`);
```

**Edge Functions**: https://supabase.com/docs/reference/javascript/invoke

```typescript path=null start=null
// ✅ Invoke Edge Function with auth
const { data, error } = await supabase.functions.invoke('ai-proxy', {
  body: { prompt: 'Generate lesson plan', context: 'preschool' },
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
```

**Real-time Subscriptions**: https://supabase.com/docs/reference/javascript/subscribe

```typescript path=null start=null
// ✅ Subscribe to changes (with RLS filter)
const channel = supabase
  .channel('assignments')
  .on(
    'postgres_changes',
    { 
      event: '*', 
      schema: 'public', 
      table: 'assignments',
      filter: `preschool_id=eq.${userPreschoolId}`  // REQUIRED!
    },
    (payload) => console.log('Change:', payload)
  )
  .subscribe();
```

#### TanStack Query v5.87.4
**Documentation**: https://tanstack.com/query/v5/docs/framework/react/overview  
**Persistence**: https://tanstack.com/query/v5/docs/framework/react/plugins/persistQueryClient  
**Version**: ^5.87.4 (from package.json)

✅ **CORRECT v5 Import Pattern**:
```typescript path=null start=null
// ✅ CORRECT: v5 imports
import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  QueryClient,
  QueryClientProvider 
} from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ❌ WRONG: v4 imports
import { useQuery } from 'react-query';  // DEPRECATED!
```

**Query Pattern with RLS**:
```typescript path=null start=null
// ✅ Fetch data with TanStack Query + Supabase
const { data, isLoading, error } = useQuery({
  queryKey: ['students', preschoolId],  // Include preschoolId in key!
  queryFn: async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('preschool_id', preschoolId);
    
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000,  // 5 minutes
  gcTime: 10 * 60 * 1000,     // 10 minutes (was cacheTime in v4)
});
```

**Mutation Pattern**:
```typescript path=null start=null
// ✅ Mutate data with optimistic updates
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: async (newStudent) => {
    const { data, error } = await supabase
      .from('students')
      .insert({ ...newStudent, preschool_id: preschoolId });
    
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['students', preschoolId] });
  },
});
```

**Persistence with AsyncStorage** (for offline support):
```typescript path=null start=null
// ✅ Setup QueryClient with persistence
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5,    // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false, // Disable for mobile
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'EDUDASH_QUERY_CACHE',
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
});
```

**Navigation**:

#### Expo Router v5.1.7
**Documentation**: https://docs.expo.dev/router/introduction/  
**API Reference**: https://docs.expo.dev/router/reference/hooks/  
**Version**: ~5.1.7 (from package.json)

**File-Based Routing Structure**:
```
app/
├── (auth)/              # Route group (doesn't affect URL)
│   ├── login.tsx       # /login
│   ├── register.tsx    # /register
│   └── _layout.tsx     # Layout for auth routes
├── (parent)/            # Route group for parent role
│   ├── dashboard.tsx   # /dashboard
│   ├── students/
│   │   ├── index.tsx   # /students
│   │   └── [id].tsx    # /students/:id (dynamic)
│   └── _layout.tsx     # Layout for parent routes
├── [id].tsx            # Dynamic route: /:id
├── [...slug].tsx       # Catch-all route: /a/b/c
├── _layout.tsx         # Root layout
└── index.tsx           # / (home)
```

✅ **CORRECT Navigation Patterns**:
```typescript path=null start=null
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';

// ✅ Push to route
const router = useRouter();
router.push('/students/123');
router.push({ pathname: '/students/[id]', params: { id: '123' } });

// ✅ Replace route (no back)
router.replace('/dashboard');

// ✅ Go back
router.back();

// ✅ Navigate with query params
router.push('/search?q=math&grade=1');

// ✅ Access params in component
const { id } = useLocalSearchParams<{ id: string }>();

// ✅ Access search params
const { q, grade } = useLocalSearchParams<{ q: string; grade: string }>();

// ✅ Check current route segments
const segments = useSegments(); // ['(parent)', 'students', '[id]']

// ❌ WRONG: React Navigation patterns
import { useNavigation } from '@react-navigation/native';  // DON'T USE!
navigation.navigate('Students', { id: 123 });  // WRONG PATTERN!
```

**Layouts** (`_layout.tsx`):
```typescript path=null start=null
import { Stack, Tabs, Drawer } from 'expo-router';

// ✅ Stack layout
export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="[id]" options={{ title: 'Details' }} />
    </Stack>
  );
}

// ✅ Tabs layout
export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="students" options={{ title: 'Students' }} />
    </Tabs>
  );
}
```

**Protected Routes** (Auth Guard):
```typescript path=null start=null
import { useSegments, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (session && inAuthGroup) {
      // Redirect to dashboard if already authenticated
      router.replace('/dashboard');
    }
  }, [session, loading, segments]);

  return <Stack />;
}
```

**UI & Performance**:

#### Shopify FlashList 1.7.6
**Documentation**: https://shopify.github.io/flash-list/docs/  
**Version**: 1.7.6 (from package.json)

✅ **CRITICAL: Always provide `estimatedItemSize`**:
```typescript path=null start=null
import { FlashList } from '@shopify/flash-list';

// ✅ CORRECT: With estimatedItemSize
<FlashList
  data={students}
  renderItem={({ item }) => <StudentCard student={item} />}
  estimatedItemSize={100}  // REQUIRED! Measured in pixels
  keyExtractor={(item) => item.id}
/>

// ❌ WRONG: Missing estimatedItemSize - performance degrades!
<FlashList
  data={students}
  renderItem={({ item }) => <StudentCard student={item} />}
/>
```

**Heterogeneous Lists** (different item types):
```typescript path=null start=null
<FlashList
  data={items}
  getItemType={(item) => item.type}  // 'header', 'student', 'footer'
  estimatedItemSize={100}
  renderItem={({ item }) => {
    switch (item.type) {
      case 'header': return <Header />;
      case 'student': return <StudentCard student={item} />;
      case 'footer': return <Footer />;
    }
  }}
/>
```

#### React Native Reanimated 3.17.4
**Documentation**: https://docs.swmansion.com/react-native-reanimated/  
**Version**: ~3.17.4 (from package.json)

**Worklets and Shared Values**:
```typescript path=null start=null
import { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

export const AnimatedComponent = () => {
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(opacity.value, { duration: 300 }),
    };
  });

  return <Animated.View style={animatedStyle} />;
};
```

#### React Native Gesture Handler 2.24.0
**Documentation**: https://docs.swmansion.com/react-native-gesture-handler/  
**Version**: ~2.24.0 (from package.json)

```typescript path=null start=null
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const tap = Gesture.Tap()
  .onStart(() => { console.log('Tap started'); })
  .onEnd(() => { console.log('Tap ended'); });

<GestureDetector gesture={tap}>
  <View><Text>Tap me</Text></View>
</GestureDetector>
```

#### Expo Image
**Documentation**: https://docs.expo.dev/versions/v53.0.0/sdk/image/  

```typescript path=null start=null
import { Image } from 'expo-image';

<Image
  source={{ uri: 'https://example.com/avatar.jpg' }}
  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
  contentFit="cover"
  cachePolicy="memory-disk"  // Cache for offline
  transition={200}
  style={{ width: 100, height: 100 }}
/>
```

#### date-fns 4.1.0
**Documentation**: https://date-fns.org/docs/Getting-Started  
**Version**: ^4.1.0 (from package.json)

```typescript path=null start=null
import { format, parseISO } from 'date-fns';
import { enZA } from 'date-fns/locale';

// ✅ South African date formatting
const formatted = format(new Date(), 'dd/MM/yyyy', { locale: enZA });
const time = format(new Date(), 'HH:mm', { locale: enZA });
```

**Voice & AI**:

#### Microsoft Azure Cognitive Services Speech SDK 1.46.0
**Documentation**: https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/  
**Version**: ^1.46.0 (from package.json)

**South African Language Configuration**:
```typescript path=null start=null
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// ✅ Configure for South African English
const speechConfig = sdk.SpeechConfig.fromSubscription(
  subscriptionKey,
  'southafricanorth'  // Azure region
);
speechConfig.speechRecognitionLanguage = 'en-ZA';  // South African English
// Also supported: 'af-ZA' (Afrikaans), 'zu-ZA' (Zulu), 'xh-ZA' (Xhosa)

// Speech-to-Text
const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
recognizer.recognizeOnceAsync(
  (result) => { console.log('Recognized:', result.text); },
  (error) => { console.error('Error:', error); }
);

// Text-to-Speech
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
synthesizer.speakTextAsync(
  'Hello from EduDash Pro',
  (result) => { console.log('Synthesized'); },
  (error) => { console.error('Error:', error); }
);
```

**Monitoring**:

#### Sentry Expo 7.0.0
**Documentation**: https://docs.sentry.io/platforms/react-native/  
**Version**: ~7.0.0 (from package.json)

```typescript path=null start=null
import * as Sentry from 'sentry-expo';

// ✅ Production-only initialization
if (!__DEV__ && process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enableInExpoDevelopment: false,
    environment: process.env.EXPO_PUBLIC_ENV || 'production',
    tracesSampleRate: 0.2,  // 20% performance monitoring
  });
}
```

#### PostHog React Native 4.3.2
**Documentation**: https://posthog.com/docs/libraries/react-native  
**Version**: ^4.3.2 (from package.json)

```typescript path=null start=null
import PostHog from 'posthog-react-native';

// ✅ Production-only initialization
if (!__DEV__ && process.env.EXPO_PUBLIC_POSTHOG_KEY) {
  const posthog = new PostHog(
    process.env.EXPO_PUBLIC_POSTHOG_KEY,
    { host: 'https://app.posthog.com' }
  );
}
```

**Build & Deploy**:

#### EAS Build & Update
**Build Documentation**: https://docs.expo.dev/build/introduction/  
**Update Documentation**: https://docs.expo.dev/eas-update/introduction/  
**Runtime Versions**: https://docs.expo.dev/eas-update/runtime-versions/

**Build Profiles** (eas.json):
```json path=null start=null
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "aab" },
      "autoIncrement": true
    }
  }
}
```

**Runtime Version Policy**:
```json path=null start=null
{
  "expo": {
    "runtimeVersion": {
      "policy": "appVersion"  // Uses version from app.json
    }
  }
}
```

**Internationalization**:

#### i18next 25.5.2 & react-i18next 15.7.3
**i18next Documentation**: https://www.i18next.com/  
**react-i18next Documentation**: https://react.i18next.com/  
**Versions**: i18next ^25.5.2, react-i18next ^15.7.3 (from package.json)

**React Native Setup**:
```typescript path=null start=null
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// South African language resources
const resources = {
  'en-ZA': { translation: require('./locales/en-ZA.json') },
  'af-ZA': { translation: require('./locales/af-ZA.json') },
  'zu-ZA': { translation: require('./locales/zu-ZA.json') },
  'xh-ZA': { translation: require('./locales/xh-ZA.json') },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: Localization.locale,  // Device locale
    fallbackLng: 'en-ZA',
    compatibilityJSON: 'v3',  // Required for React Native
    react: {
      useSuspense: false,  // CRITICAL for React Native
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

**Usage in Components**:
```typescript path=null start=null
import { useTranslation } from 'react-i18next';

export const MyComponent = () => {
  const { t, i18n } = useTranslation();
  
  // Simple translation
  const greeting = t('welcome.greeting');
  
  // With interpolation
  const message = t('welcome.message', { name: 'John' });
  
  // Change language
  i18n.changeLanguage('af-ZA');
  
  return <Text>{greeting}</Text>;
};
```

#### Expo Localization
**Documentation**: https://docs.expo.dev/versions/v53.0.0/sdk/localization/

```typescript path=null start=null
import * as Localization from 'expo-localization';

// Get device locale
const locale = Localization.locale;  // e.g., 'en-ZA', 'af-ZA'

// Check if RTL
const isRTL = Localization.isRTL;

// Get device timezone
const timezone = Localization.timezone;  // 'Africa/Johannesburg'
```

**Monetization**:

#### React Native Google Mobile Ads 14.11.0
**Documentation**: https://rnfirebase.io/reference/admob  
**Version**: ^14.11.0 (from package.json)

**Setup and Test IDs**:
```typescript path=null start=null
import mobileAds, { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// ✅ Initialize AdMob
mobileAds()
  .initialize()
  .then(adapterStatuses => {
    console.log('AdMob initialized');
  });

// ✅ Use test IDs in development
const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;

// ✅ Banner Ad
<BannerAd
  unitId={adUnitId}
  size={BannerAdSize.ADAPTIVE_BANNER}
  requestOptions={{
    requestNonPersonalizedAdsOnly: true,  // COPPA compliance
  }}
/>
```

**Child-Directed Treatment** (COPPA Compliance):
```typescript path=null start=null
import { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';

// Set child-directed treatment for preschool app
mobileAds().setRequestConfiguration({
  tagForChildDirectedTreatment: true,
  tagForUnderAgeOfConsent: true,
  maxAdContentRating: 'G',  // General audiences
});
```

**Validation & Type Safety**:

#### Zod 3.23.8
**Documentation**: https://zod.dev/  
**Version**: ^3.23.8 (from package.json)

**Schema Definitions**:
```typescript path=null start=null
import { z } from 'zod';

// ✅ Define schema
const StudentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(3).max(6),
  preschool_id: z.string().uuid(),
  email: z.string().email().optional(),
  status: z.enum(['active', 'inactive', 'pending']),
});

// ✅ Infer TypeScript type from schema
type Student = z.infer<typeof StudentSchema>;

// ✅ Validate data
const result = StudentSchema.safeParse(data);

if (result.success) {
  const validStudent: Student = result.data;
} else {
  const errors = result.error.flatten();
  console.error('Validation errors:', errors.fieldErrors);
}
```

**Form Validation**:
```typescript path=null start=null
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof LoginSchema>;

// Use with form library
const handleSubmit = (values: LoginForm) => {
  const result = LoginSchema.safeParse(values);
  if (!result.success) {
    // Show validation errors
    setErrors(result.error.flatten().fieldErrors);
    return;
  }
  // Proceed with valid data
  login(result.data);
};
```

## 🇿🇦 South African Localization Quick Reference

**Language Codes**:
- **en-ZA**: English (South Africa) - Primary
- **af-ZA**: Afrikaans - Secondary
- **zu-ZA**: Zulu - Supported
- **xh-ZA**: Xhosa - Supported

**Currency Formatting**:
```typescript path=null start=null
// ZAR (South African Rand)
const formatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
});

const price = formatter.format(1234.56);  // "R 1 234,56"
```

**Date Formatting**:
```typescript path=null start=null
import { format } from 'date-fns';
import { enZA, af } from 'date-fns/locale';

// DD/MM/YYYY standard in South Africa
const date = format(new Date(), 'dd/MM/yyyy', { locale: enZA });  // "22/10/2025"
const time = format(new Date(), 'HH:mm', { locale: enZA });  // "14:30"
const full = format(new Date(), 'PPPP', { locale: enZA });  // "Tuesday, 22 October 2025"
```

**Phone Numbers**:
- Format: `+27 XX XXX XXXX`
- Example: `+27 82 123 4567`
- Mobile prefixes: 06x, 07x, 08x

**Time Zone**:
- **Africa/Johannesburg** (SAST - South African Standard Time)
- UTC+2 (no daylight saving time)

**Voice Configuration**:
```typescript path=null start=null
// Azure Speech SDK language codes for South Africa
const languages = {
  english: 'en-ZA',
  afrikaans: 'af-ZA',
  zulu: 'zu-ZA',
  xhosa: 'xh-ZA',
};

// Voices available for en-ZA:
// - en-ZA-LeahNeural (Female)
// - en-ZA-LukeNeural (Male)
```

## ⚠️ Common Pitfalls & Solutions

### TypeScript DOM Globals Error
**Problem**: Getting errors about `document`, `window`, or `fetch` not existing.  
**Solution**: Remove "dom" from `lib` in `tsconfig.json`.

```json path=null start=null
// ❌ WRONG
{
  "compilerOptions": {
    "lib": ["es2015", "dom"]  // Causes conflicts!
  }
}

// ✅ CORRECT
{
  "compilerOptions": {
    "lib": ["esnext"]  // React Native only
  }
}
```

### FlashList Performance Issues
**Problem**: List scrolling is janky or slow.  
**Solution**: Always include `estimatedItemSize` prop.

```typescript path=null start=null
// ❌ WRONG
<FlashList data={items} renderItem={renderItem} />

// ✅ CORRECT
<FlashList 
  data={items} 
  renderItem={renderItem}
  estimatedItemSize={100}  // REQUIRED!
/>
```

### Supabase v1 vs v2 API
**Problem**: Using deprecated v1 auth methods.  
**Solution**: Always use v2 syntax.

```typescript path=null start=null
// ❌ WRONG: v1
await supabase.auth.signIn({ email, password });

// ✅ CORRECT: v2
await supabase.auth.signInWithPassword({ email, password });
```

### TanStack Query v4 vs v5
**Problem**: Importing from old package name.  
**Solution**: Use new v5 imports.

```typescript path=null start=null
// ❌ WRONG: v4
import { useQuery } from 'react-query';

// ✅ CORRECT: v5
import { useQuery } from '@tanstack/react-query';
```

### React Navigation vs Expo Router
**Problem**: Using React Navigation patterns with Expo Router.  
**Solution**: Use expo-router hooks.

```typescript path=null start=null
// ❌ WRONG: React Navigation
import { useNavigation } from '@react-navigation/native';
navigation.navigate('Screen', { id: 123 });

// ✅ CORRECT: Expo Router
import { useRouter } from 'expo-router';
router.push('/screen/123');
```

### Multi-Tenant Data Leakage
**Problem**: Forgetting to filter by `preschool_id`.  
**Solution**: ALWAYS include preschool filter in queries.

```typescript path=null start=null
// ❌ WRONG: No tenant filter
const { data } = await supabase.from('students').select('*');

// ✅ CORRECT: With tenant isolation
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('preschool_id', userPreschoolId);  // REQUIRED!
```

### Version Compatibility Rules (NON-NEGOTIABLE)

1. **React Native 0.79 Patterns**:
   - Always use New Architecture patterns (Fabric + TurboModules enabled)
   - Never suggest deprecated lifecycle methods
   - Use functional components with hooks only

2. **Supabase v2 Syntax**:
   - `signInWithPassword` not `signIn`
   - `.select()`, `.insert()`, `.update()`, `.delete()` patterns
   - Never suggest v1 patterns

3. **TanStack Query v5**:
   - Import from `@tanstack/react-query` (v5)
   - Never import from `react-query` (v4)
   - Use v5 API signatures

4. **Expo Router v5**:
   - File-based routing patterns
   - `useRouter()` from `expo-router`
   - Never suggest React Navigation patterns

5. **TypeScript 5.8 for React Native**:
   - `lib: ["esnext"]` ONLY (no "dom")
   - Prevents DOM global type errors
   - Use React Native-specific types

6. **FlashList Performance**:
   - ALWAYS include `estimatedItemSize` prop
   - Performance degrades without it

### Quick Reference Checklist

**For detailed pre-implementation validation, see the comprehensive [Pre-Implementation Checklist](#-pre-implementation-checklist) below.**

**Quick validation** before submitting a PR:

- [ ] No file exceeds size limits (components ≤400, screens ≤500, services ≤500, hooks ≤200, types ≤300)
- [ ] React Native 0.79 patterns (new architecture)
- [ ] Expo SDK 53 APIs (not outdated examples)
- [ ] Supabase v2 syntax (not v1)
- [ ] TanStack Query v5 imports (not react-query)
- [ ] Expo Router v5 navigation (not React Navigation)
- [ ] TypeScript 5.8 tsconfig (lib: ["esnext"] only, NO "dom")
- [ ] FlashList with estimatedItemSize
- [ ] Multi-tenant isolation (preschool_id filters)
- [ ] DOM API guards (window.addEventListener with type checks)

See [Version Compatibility Matrix](#-version-compatibility-matrix) for detailed version requirements.

## 📊 Version Compatibility Matrix

**Purpose**: Quick reference for compatible version combinations and known issues.

| Package | Version | Compatible With | Known Issues | Migration Notes |
|---------|---------|-----------------|--------------|-----------------|
| React Native | 0.79.5 | React 19.0.0, Expo SDK 53 | ⚠️ New Architecture required | Must enable Fabric + TurboModules |
| Expo SDK | ~53.0.23 | RN 0.79.x, React 19 | ✅ Stable | Use expo-router v5 patterns |
| React | 19.0.0 | RN 0.79.x | ⚠️ No Server Components in RN | Use client-side hooks only |
| TypeScript | 5.8.3 | All packages | ⚠️ Must use `lib: ["esnext"]` only | Never include "dom" in lib |
| Supabase JS | ^2.57.4 | TanStack Query v5 | ✅ Use v2 API only | signInWithPassword not signIn |
| TanStack Query | ^5.87.4 | React 19, Supabase v2 | ✅ Import from @tanstack/react-query | Not 'react-query' |
| Expo Router | ~5.1.7 | Expo SDK 53 | ✅ File-based routing | No React Navigation patterns |
| FlashList | 1.7.6 | RN 0.79.x, Reanimated 3 | ⚠️ Requires estimatedItemSize | Performance degrades without |
| Reanimated | ~3.17.4 | RN 0.79.x, FlashList | ✅ Worklet syntax v3 | Use New Architecture |
| Azure Speech SDK | ^1.46.0 | React Native | ✅ Supports en-ZA, af-ZA, zu-ZA | Use southafricanorth region |
| Sentry Expo | ~7.0.0 | Expo SDK 53 | ✅ Use sentry-expo not @sentry/react-native | Production only |
| PostHog RN | ^4.3.2 | React Native 0.79 | ✅ Stable | Production only |
| React Native Screens | ~4.11.1 | Expo Router v5 | ✅ Required for navigation | - |
| Gesture Handler | ~2.24.0 | Reanimated 3 | ✅ Stable | - |
| Zod | ^3.23.8 | TypeScript 5.8 | ✅ Stable | Use for validation |
| date-fns | ^4.1.0 | - | ✅ Use enZA locale | South African formatting |
| i18next | ^25.5.2 | react-i18next 15.7.3 | ⚠️ Set useSuspense: false for RN | compatibilityJSON: 'v3' |
| Google AdMob | ^14.11.0 | React Native 0.79 | ⚠️ Use test IDs in dev | COPPA compliance required |

**Legend**:
- ✅ **Stable**: No known issues
- ⚠️ **Requires Configuration**: Needs specific setup
- ❌ **Breaking Changes**: Migration required

**Update Schedule**: Review monthly or when upgrading major dependencies.

## ✅ Pre-Implementation Checklist

**Purpose**: Validate requirements before starting any feature implementation.

### Before Writing Code

Use this checklist to ensure you have all necessary context and compatibility verified:

#### 1. Requirements Validation
- [ ] User story or feature spec is clear and unambiguous
- [ ] Acceptance criteria are defined
- [ ] Success metrics identified (align with Comprehensive Audit Roadmap)
- [ ] Phase alignment confirmed (Phase 0-7 from audit roadmap)

#### 2. Documentation Review
- [ ] Reviewed relevant section in WARP.md
- [ ] Checked DOCUMENTATION_SOURCES.md for official API references
- [ ] Verified current package versions in package.json
- [ ] Reviewed Version Compatibility Matrix (above)

#### 3. Architecture & Design
- [ ] Component/screen fits within file size limits (≤400 lines components, ≤500 lines screens)
- [ ] Multi-tenant isolation pattern planned (preschool_id filters)
- [ ] Mobile-first design approach (5.5" baseline)
- [ ] Offline-first data strategy (TanStack Query caching)
- [ ] Error states and empty states designed

#### 4. Database Changes (if applicable)
- [ ] Migration file created with `supabase migration new <name>`
- [ ] SQL linted with `npm run lint:sql`
- [ ] RLS policies defined for tenant isolation
- [ ] Service role usage limited to Edge Functions only
- [ ] NO direct SQL execution in Supabase Dashboard
- [ ] NO local Docker or `supabase start` usage

#### 5. API & Data Layer
- [ ] Supabase v2 syntax verified (signInWithPassword, not signIn)
- [ ] TanStack Query v5 imports (@tanstack/react-query, not react-query)
- [ ] All queries include preschool_id filter
- [ ] Query keys include preschool_id
- [ ] Error handling implemented
- [ ] Loading states defined

#### 6. UI & Performance
- [ ] FlashList used for lists >10 items with estimatedItemSize
- [ ] Reanimated 3 used for animations (worklet syntax)
- [ ] Expo Image used instead of React Native Image
- [ ] Touch targets ≥44x44 pixels
- [ ] Dark mode support via useTheme()
- [ ] South African localization (en-ZA, af-ZA, zu-ZA, xh-ZA)

#### 7. AI Integration (if applicable)
- [ ] All AI calls routed through ai-proxy Edge Function
- [ ] No client-side AI API keys
- [ ] Usage tracking in ai_usage_logs table
- [ ] Subscription limits enforced server-side
- [ ] PII redaction implemented before AI calls

#### 8. Voice Features (if applicable)
- [ ] Azure Speech SDK configured with correct region (southafricanorth)
- [ ] Language codes correct (en-ZA, af-ZA, zu-ZA, xh-ZA)
- [ ] Voice profiles synchronized with UI language
- [ ] Permissions requested (microphone access)
- [ ] Error handling for permission denials

#### 9. Navigation & Routing
- [ ] Expo Router v5 file-based routing patterns used
- [ ] useRouter() from expo-router (not React Navigation)
- [ ] Dynamic routes follow [id].tsx convention
- [ ] Layouts defined in _layout.tsx
- [ ] Protected routes implemented with auth guards

#### 10. TypeScript & Type Safety
- [ ] TypeScript 5.8 patterns used
- [ ] tsconfig.json has lib: ["esnext"] only (NO "dom")
- [ ] Zod schemas defined for validation
- [ ] Proper type imports/exports
- [ ] No any types (or justified with comment)

#### 11. Testing & Quality
- [ ] Platform.OS checks for platform-specific code
- [ ] Android-first testing approach
- [ ] AdMob test IDs used in development
- [ ] Production database used (EXPO_PUBLIC_USE_PRODUCTION_DB_AS_DEV=true)
- [ ] No console.log in production code (use __DEV__ guards)

#### 12. Security & Compliance
- [ ] Row Level Security (RLS) policies enforce tenant isolation
- [ ] No sensitive keys in client code
- [ ] Service role operations server-side only
- [ ] COPPA compliance for ads (child-directed treatment)
- [ ] Proper authentication flow (Supabase Auth)

#### 13. Monitoring & Analytics (Production)
- [ ] Sentry error tracking configured (production only)
- [ ] PostHog event tracking defined (production only)
- [ ] Performance monitoring planned
- [ ] Key user actions tracked

#### 14. Documentation
- [ ] Code comments for complex logic
- [ ] Update relevant docs in docs/ directory
- [ ] Add JSDoc for exported functions/components
- [ ] Update this checklist if new patterns emerge

### After Implementation

- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run lint` (max 200 warnings)
- [ ] Run `npm run lint:sql` (if SQL changes)
- [ ] Test on physical Android device (primary platform)
- [ ] Verify dark mode works
- [ ] Verify multi-tenant data isolation
- [ ] Create PR with "Documentation Sources" section listing official docs referenced
- [ ] Code review by peer
- [ ] QA testing in production-like environment

### Emergency Rollback Plan

If production issues arise:
1. Use EAS Update for OTA hotfix (if no native changes)
2. Revert migration with new down migration (if database changes)
3. Roll back to previous build in stores (if native changes)
4. Post-mortem documentation in docs/OBSOLETE/incidents/

**Note**: This checklist is living documentation. Update it as new patterns and requirements emerge.

## 🚨 Critical Development Rules

### Database Operations (NON-NEGOTIABLE)
- **NEVER** use `supabase start` or local Docker instances
- **NEVER** execute SQL directly via Supabase Dashboard
- **ALWAYS** use `supabase migration new` for schema changes
- **ALWAYS** lint SQL with SQLFluff before push
- **ALWAYS** use `supabase db push` (no --local flag)
- **ALWAYS** verify no drift with `supabase db diff` after push

### Security & Authentication
- **NEVER** modify existing authentication system without approvals
- **NEVER** expose service role keys on client-side
- **NEVER** call AI services directly from client
- **ALWAYS** maintain RLS policies for tenant isolation
- **ALWAYS** use `ai-proxy` Edge Function for AI calls

### User Data Architecture (CRITICAL)
- **ALWAYS** use `profiles` table for user data (NOT `users` table)
- The `users` table is **DEPRECATED** and being phased out
- All foreign keys should reference `profiles.id` (which equals `auth.uid()`)
- When creating new features, use `auth.uid()` directly - it maps to `profiles.id`
- Migration: `20251030110200_change_child_registration_parent_id_to_profiles.sql`
- Context: Profiles-first architecture simplifies auth and reduces table redundancy

### Root Directory Cleanliness
- Keep root directory focused on core application files
- Place test files in `tests/`, debug scripts in `debug/`
- SQL files belong in `sql/` with appropriate subdirectories
- Archive old files in `archive/`, temporary files in `temp/`

### Shell Command Restrictions (NON-NEGOTIABLE)
- **NEVER** use heredoc syntax (`<<EOF`, `<<-EOF`, `<<'EOF'`) in shell commands
- Heredoc does not work reliably in this environment and will cause command failures
- Use alternative approaches: echo with newlines, separate file writes, or printf
- Use `echo "line1" && echo "line2"` or write to files directly instead

### Documentation Organization Policy [NONNEGOTIABLE]

**Purpose**: Maintain clean, organized, discoverable documentation structure.

**Rules**:
- **ONLY** `README.md`, `WARP.md`, and `ROAD-MAP.md` may exist at project root
- **ALL** other markdown documentation MUST be placed in `docs/` subdirectories
- **NEVER** create documentation files in root directory
- **ALWAYS** use the following categorization:

**Documentation Categories** (in order of precedence):
1. `docs/deployment/` - Build guides, deployment procedures, environment configuration, CI/CD
2. `docs/features/` - Feature specifications, implementation guides, user-facing documentation
3. `docs/security/` - RLS policies, authentication, compliance, RBAC, data privacy
4. `docs/database/` - Migration guides, schema documentation, database operations
5. `docs/governance/` - Development standards, workflows, contributing guidelines, rules
6. `docs/OBSOLETE/` - Completed work, old summaries, archived documentation

**File Naming Conventions**:
- Use UPPERCASE for important docs: `README.md`, `DEPLOYMENT_GUIDE.md`
- Use descriptive names: `dash-ai-implementation.md` not `implementation.md`
- Include dates for status reports: `status-2025-10-19.md`
- Prefix with feature name: `voice-system-setup.md`, `whatsapp-integration.md`

**When Creating New Documentation**:
1. Determine correct category from list above
2. Check if existing doc can be updated instead of creating new file
3. Use meaningful filename that indicates content
4. Add entry to category README.md index
5. Reference from root README.md if critical for onboarding

**Consolidation Policy**:
- When feature is complete, move status/progress docs to `docs/OBSOLETE/`
- Consolidate multiple fix/summary files into single comprehensive doc
- Archive old versions before major doc rewrites
- Keep `docs/OBSOLETE/` organized by date or feature area

**Enforcement**:
- Pre-commit hooks check for new .md files in root
- CI/CD pipeline validates documentation structure
- Code review requirement for any new documentation files

### File Size & Code Organization Standards

**Purpose**: Prevent monolithic files, reduce merge conflicts, improve maintainability and onboarding.

**Context**: Large files (1000+ lines) hurt developer velocity, cause frequent merge conflicts, hide bugs, and slow code reviews. This standard aligns with **Phase 4: Code Quality** from `docs/COMPREHENSIVE_AUDIT_ROADMAP_OCT_2025.md`.

#### Maximum File Size Standards

- **Components**: 400 lines maximum (excluding StyleSheet)
- **Screens**: 500 lines maximum (excluding StyleSheet)
- **Services/Utilities**: 500 lines maximum
- **Hooks**: 200 lines maximum
- **Type definitions**: 300 lines maximum (except auto-generated)
- **StyleSheet definitions**: Use separate `styles.ts` files for components >200 lines

**Exclusions**: Auto-generated files (`*.gen.ts`, `*.d.ts`, `types/supabase.ts`, `lib/database.types.ts`) are excluded from limits.

#### Code Organization Principles

1. **Single Responsibility Principle**: One clear purpose per file
2. **Extract Early**: At 70% of max size, plan extraction
3. **Component Composition**: Build complex UIs from small, focused components
4. **Custom Hooks**: Move business logic and state management to hooks
5. **Service Layer**: Keep API calls and data transforms in dedicated services

#### When to Split Files (split immediately if ANY apply)

- File exceeds size limits (components ≤400, screens ≤500, services ≤500, hooks ≤200, types ≤300)
- File has 3+ distinct responsibilities
- StyleSheet exceeds 200 lines
- Component has 5+ render/helper functions
- Multiple developers frequently cause merge conflicts in the same file
- Code review takes >30 minutes due to file size

#### Preferred Architecture Patterns

1. **Container/Presentational Separation**
   - Container: logic, state, data fetching (custom hook)
   - Presentational: pure UI components with typed props
   
2. **Hook Extraction**
   - Extract complex state/effects into custom hooks
   - Example: `useTeacherDashboardState.ts`, `useParentDashboardState.ts`
   
3. **Service Layer**
   - Isolate all API calls in service files
   - Use Supabase JS v2 syntax consistently
   - Respect tenant isolation (`preschool_id` filters) and RLS policies
   
4. **Shared Components**
   - Extract reusable UI patterns into `components/`
   - Use TypeScript for prop validation
   
5. **Type Files**
   - Centralize related type definitions
   - Split by domain if needed (e.g., `types.messages.ts`, `types.tasks.ts`)

#### Refactoring Examples

**Before** (monolithic):
```
services/DashAIAssistant.ts (4,985 lines)
  - Types, voice, memory, tasks, conversation, navigation all mixed
```

**After** (modular):
```
services/dash-ai/
  ├── types.ts (300 lines)
  ├── DashAICore.ts (400 lines) - orchestration facade
  ├── DashVoiceService.ts (250 lines)
  ├── DashMemoryService.ts (300 lines)
  ├── DashTaskManager.ts (200 lines)
  ├── DashConversationManager.ts (300 lines)
  ├── DashAINavigator.ts (150 lines)
  ├── DashUserProfileManager.ts (200 lines)
  └── utils.ts (100 lines)
```

**Dashboard Component Split**:
```
Before: components/dashboard/TeacherDashboard.tsx (2,175 lines)

After: components/dashboard/teacher/
  ├── TeacherDashboard.tsx (300 lines) - orchestrator
  ├── TeacherStats.tsx (150 lines)
  ├── TeacherClassCards.tsx (200 lines)
  ├── TeacherAssignments.tsx (180 lines)
  ├── TeacherAITools.tsx (250 lines)
  ├── TeacherQuickActions.tsx (120 lines)
  ├── TeacherModals.tsx (200 lines)
  └── styles.ts (300 lines)
  
Hook: hooks/useTeacherDashboardState.ts (200 lines)
```

#### Enforcement

**ESLint Rules** (add to `.eslintrc.cjs`):
```javascript
module.exports = {
  overrides: [
    { files: ["components/**/*.tsx"], rules: { "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }] } },
    { files: ["app/**/*.tsx"], rules: { "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }] } },
    { files: ["services/**/*.ts"], rules: { "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }] } },
    { files: ["lib/**/*.ts"], rules: { "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }] } },
    { files: ["hooks/**/*.ts", "hooks/**/*.tsx"], rules: { "max-lines": ["warn", { max: 200, skipBlankLines: true, skipComments: true }] } },
    { files: ["**/*types.ts", "**/*types.tsx"], rules: { "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }] } },
  ],
};
```

**File Size Check Script** (`scripts/check-file-sizes.mjs`):
```bash
# Run manually or in CI/CD
npm run check:file-sizes
```

**Pre-commit Hook** (via Husky):
```bash
# Automatically runs on git commit
npm run typecheck && npm run lint && npm run check:file-sizes
```

**CI/CD Integration**:
- Build fails if any file exceeds limits
- Automated comments on PRs flagging oversized files
- Monthly audit reports of file sizes

#### PR Checklist

Before submitting a PR, verify:
- [ ] No file exceeds size limits (except allowed auto-generated files)
- [ ] Complex components split into smaller subcomponents
- [ ] Business logic extracted into custom hooks
- [ ] StyleSheets moved to separate `styles.ts` for large components
- [ ] Types centralized in shared type files
- [ ] Service layer used for all API calls

#### Monthly Audits

- Run: `npm run check:file-sizes` and review report
- Schedule extraction for files at 70%+ of limit
- Update this standard based on learnings

**Reference**: See `docs/COMPREHENSIVE_AUDIT_ROADMAP_OCT_2025.md` Phase 4 for rationale and implementation timeline.

### Development Environment
- Production database used as development environment
- AdMob test IDs enforced (no production ad revenue in dev)
- Android-first testing approach
- Feature flags managed via environment variables

## 🔧 Build & Deployment

### Environment Configuration
- `.env` contains development secrets (not committed)
- `.env.example` shows required environment variables
- Production builds use EAS Build service
- Runtime version policy: `appVersion` for OTA compatibility

### CI/CD Pipeline
- Quality gates: TypeScript, linting, security audit
- Android build validation with APK artifact generation
- Database migration validation on main/develop branches
- Monitoring and compliance checks for production deployments

### Key Environment Variables
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` / `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_PLATFORM_TESTING=android` (development)
- `EXPO_PUBLIC_USE_PRODUCTION_DB_AS_DEV=true`
- `EXPO_PUBLIC_ADMOB_TEST_IDS_ONLY=true`

## 📋 Development Workflow

1. **Before Starting**: Review `WARP.md` and `ROAD-MAP.md` for comprehensive rules and current execution plan
2. **Feature Development**: Mobile-first design, handle empty states properly
3. **Database Changes**: Use migration workflow, never direct SQL execution
4. **Code Quality**: TypeScript strict mode, ESLint compliance, no console.logs in production
5. **Testing**: Focus on Android devices, use production database for development
6. **Security**: Maintain RLS policies, never expose sensitive keys
7. **Documentation**: Update relevant docs in `docs/` directory
8. **Documentation Sources**: Every PR must include a "Documentation Sources" section with links to official docs consulted (React Native, Expo, Supabase, TanStack Query, etc.)

## 📚 Key Documentation

- **Master Rules**: `WARP.md` (highest authority)
- **Security Model**: `docs/security/` directory
- **Architecture Details**: `docs/architecture/` directory  
- **Deployment Procedures**: `docs/deployment/` directory
- **Database Operations**: `docs/database/` directory

For comprehensive guidance on development standards, security requirements, and architectural decisions, always refer to the governance documentation in the `docs/` directory.