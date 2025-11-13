-- Multi-Organization Dashboard System: Age-Awareness Infrastructure
-- Phase 1: Database schema for age groups, guardian relationships, and feature flags
-- See: /home/king/Desktop/MULTI_ORG_DASHBOARD_IMPLEMENTATION_PLAN.md

-- =====================================================
-- 1) Create age_group_type enum
-- =====================================================
do $$ begin
  create type public.age_group_type as enum ('child', 'teen', 'adult');
exception when duplicate_object then
  raise notice 'age_group_type enum already exists, skipping';
end $$;

comment on type public.age_group_type is 
  'Age classification for age-appropriate UX: child (0-12), teen (13-17), adult (18+)';

-- =====================================================
-- 2) Add age-awareness columns to profiles
-- =====================================================
alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists age_group public.age_group_type,
  add column if not exists guardian_profile_id uuid references public.profiles(id) on delete set null;

-- Indexes for performance
create index if not exists idx_profiles_date_of_birth on public.profiles(date_of_birth);
create index if not exists idx_profiles_age_group on public.profiles(age_group);
create index if not exists idx_profiles_guardian_profile_id on public.profiles(guardian_profile_id);

comment on column public.profiles.date_of_birth is 
  'Date of birth for age computation. Required for age-appropriate features.';
comment on column public.profiles.age_group is 
  'Computed age group maintained by trigger: child, teen, adult';
comment on column public.profiles.guardian_profile_id is 
  'Link to guardian profile for minors (child/teen). Null for adults.';

-- =====================================================
-- 3) Create compute_age_group function
-- =====================================================
create or replace function public.compute_age_group(dob date)
returns public.age_group_type
language plpgsql
stable
security definer
as $$
declare
  years int;
begin
  -- Return null if no date of birth provided
  if dob is null then
    return null;
  end if;
  
  -- Calculate age in years
  years := date_part('year', age(current_date, dob));
  
  -- Classify into age groups
  if years <= 12 then
    return 'child'::public.age_group_type;
  elsif years <= 17 then
    return 'teen'::public.age_group_type;
  else
    return 'adult'::public.age_group_type;
  end if;
end;
$$;

comment on function public.compute_age_group(date) is 
  'Computes age group from date of birth: child (0-12), teen (13-17), adult (18+)';

-- =====================================================
-- 4) Create trigger to auto-maintain age_group
-- =====================================================
create or replace function public.set_profile_age_group()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Auto-compute age_group from date_of_birth
  new.age_group := public.compute_age_group(new.date_of_birth);
  return new;
end;
$$;

drop trigger if exists trg_profiles_age_group on public.profiles;
create trigger trg_profiles_age_group
before insert or update of date_of_birth
on public.profiles
for each row execute function public.set_profile_age_group();

comment on function public.set_profile_age_group() is 
  'Trigger function to keep profiles.age_group in sync with date_of_birth';

-- =====================================================
-- 5) Create org_dashboard_features table
-- =====================================================
create table if not exists public.org_dashboard_features (
  id uuid primary key default gen_random_uuid(),
  
  -- Organization context
  org_type text not null,
  
  -- Role context
  role text not null,
  
  -- Optional age group specificity
  age_group public.age_group_type null,
  
  -- Feature identification
  feature_key text not null,
  
  -- Feature state
  enabled boolean not null default true,
  
  -- Optional version gating
  min_app_version text null,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraints: one feature config per org_type + role + age_group + feature_key
-- For age-specific features (age_group is NOT NULL)
create unique index if not exists idx_org_dash_features_unique_with_age
on public.org_dashboard_features(org_type, role, age_group, feature_key)
where age_group is not null;

-- For age-agnostic features (age_group IS NULL)
create unique index if not exists idx_org_dash_features_unique_no_age
on public.org_dashboard_features(org_type, role, feature_key)
where age_group is null;

-- Indexes for query performance
create index if not exists idx_org_dash_features_org_type on public.org_dashboard_features(org_type);
create index if not exists idx_org_dash_features_role on public.org_dashboard_features(role);
create index if not exists idx_org_dash_features_age_group on public.org_dashboard_features(age_group);
create index if not exists idx_org_dash_features_enabled on public.org_dashboard_features(enabled) where enabled = true;
create index if not exists idx_org_dash_features_lookup on public.org_dashboard_features(org_type, role, age_group, feature_key);

comment on table public.org_dashboard_features is 
  'Per-organization feature flags for dynamic dashboards. Controls feature availability by org type, role, and age group.';

comment on column public.org_dashboard_features.org_type is 
  'Organization type (preschool, k12_school, university, corporate, sports_club, community_org, training_center, tutoring_center)';
comment on column public.org_dashboard_features.role is 
  'Role identifier (learner, instructor, guardian, admin, etc.)';
comment on column public.org_dashboard_features.age_group is 
  'Optional age group filter (child, teen, adult). NULL means applies to all ages.';
comment on column public.org_dashboard_features.feature_key is 
  'Feature identifier (e.g., announcements, chat_messaging, teams_fixtures, certifications)';
comment on column public.org_dashboard_features.min_app_version is 
  'Minimum app version required (semver format). NULL means no version requirement.';

-- =====================================================
-- 6) Enable RLS on org_dashboard_features
-- =====================================================
alter table public.org_dashboard_features enable row level security;

-- Policy: Anyone can read feature flags (they're not sensitive)
-- This allows client-side feature gating based on user's org/role/age
drop policy if exists "Feature flags are readable by all authenticated users" on public.org_dashboard_features;
create policy "Feature flags are readable by all authenticated users"
on public.org_dashboard_features
for select
to authenticated
using (true);

-- Policy: Only superadmins can modify feature flags
drop policy if exists "Only superadmins can manage feature flags" on public.org_dashboard_features;
create policy "Only superadmins can manage feature flags"
on public.org_dashboard_features
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'superadmin'
  )
);

-- =====================================================
-- 7) Create helper RPC for backfilling age_group
-- =====================================================
create or replace function public.backfill_profile_age_groups()
returns table(
  updated_count bigint,
  skipped_count bigint,
  error_message text
)
language plpgsql
security definer
as $$
declare
  v_updated bigint := 0;
  v_skipped bigint := 0;
begin
  -- Update profiles where date_of_birth exists but age_group is null
  update public.profiles
  set age_group = public.compute_age_group(date_of_birth)
  where date_of_birth is not null
  and age_group is null;
  
  get diagnostics v_updated = row_count;
  
  -- Count profiles with null date_of_birth
  select count(*) into v_skipped
  from public.profiles
  where date_of_birth is null;
  
  return query select v_updated, v_skipped, null::text;
exception when others then
  return query select 0::bigint, 0::bigint, sqlerrm;
end;
$$;

comment on function public.backfill_profile_age_groups() is 
  'Backfills age_group for existing profiles. Safe to run multiple times.';

-- =====================================================
-- 8) Seed default feature flags for common scenarios
-- =====================================================

-- Default features for child learners (all org types)
insert into public.org_dashboard_features (org_type, role, age_group, feature_key, enabled)
values
  -- Preschool child defaults
  ('preschool', 'student', 'child', 'announcements', true),
  ('preschool', 'student', 'child', 'schedule_timetable', true),
  ('preschool', 'student', 'child', 'assignments_tasks', false), -- guardian-only
  ('preschool', 'student', 'child', 'chat_messaging', false), -- disabled for children
  
  -- K12 child defaults (similar to preschool)
  ('k12_school', 'student', 'child', 'announcements', true),
  ('k12_school', 'student', 'child', 'schedule_timetable', true),
  ('k12_school', 'student', 'child', 'assignments_tasks', false),
  ('k12_school', 'student', 'child', 'chat_messaging', false),
  
  -- K12 teen defaults (more freedom)
  ('k12_school', 'student', 'teen', 'announcements', true),
  ('k12_school', 'student', 'teen', 'schedule_timetable', true),
  ('k12_school', 'student', 'teen', 'assignments_tasks', true),
  ('k12_school', 'student', 'teen', 'chat_messaging', true), -- safe mode enabled
  ('k12_school', 'student', 'teen', 'grades_reports', true),
  
  -- Sports club defaults
  ('sports_club', 'athlete', 'child', 'teams_fixtures', true),
  ('sports_club', 'athlete', 'child', 'chat_messaging', false),
  ('sports_club', 'athlete', 'teen', 'teams_fixtures', true),
  ('sports_club', 'athlete', 'teen', 'chat_messaging', true),
  
  -- University adult defaults
  ('university', 'student', 'adult', 'announcements', true),
  ('university', 'student', 'adult', 'schedule_timetable', true),
  ('university', 'student', 'adult', 'assignments_tasks', true),
  ('university', 'student', 'adult', 'chat_messaging', true),
  ('university', 'student', 'adult', 'grades_reports', true),
  
  -- Corporate adult defaults
  ('corporate', 'employee', 'adult', 'announcements', true),
  ('corporate', 'employee', 'adult', 'schedule_timetable', true),
  ('corporate', 'employee', 'adult', 'assignments_tasks', true),
  ('corporate', 'employee', 'adult', 'certifications', true),
  ('corporate', 'employee', 'adult', 'chat_messaging', true)

-- Note: No conflict handling needed for initial seed data
-- If re-running, these may fail - that's expected and safe
;

-- =====================================================
-- 9) Run backfill for existing profiles (optional)
-- =====================================================
-- Uncomment the following line to backfill age_group for existing profiles:
-- select * from public.backfill_profile_age_groups();

-- =====================================================
-- Migration complete
-- =====================================================