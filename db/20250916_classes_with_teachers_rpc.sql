-- RPC: get_my_classes_with_teachers
-- Purpose: Safely fetch classes visible to the current user without relying on unrestricted view access
-- Notes:
-- - Uses SECURITY INVOKER (default) so base-table RLS remains in force
-- - Filters by:
--   • teacher_id = auth.uid() for teachers
--   • JWT preschool_id claim for same-tenant visibility
--   • super admin bypass via app_is_super_admin()
-- - Returns setof public.classes_with_teachers (view must exist)

BEGIN;

-- Helper used across policies/RPCs: super admin check
-- Re-create to ensure it exists in environments where prior migration didn't run
CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
declare
  v_is_admin boolean;
begin
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.role) in ('super_admin','superadmin')
  ) into v_is_admin;

  return coalesce(v_is_admin, false);
end;
$$;

REVOKE ALL ON FUNCTION public.app_is_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.app_is_super_admin() TO authenticated, anon;

-- Main RPC: classes with teachers for current user/tenant
CREATE OR REPLACE FUNCTION public.get_my_classes_with_teachers(
  p_limit int DEFAULT 50,
  p_only_active boolean DEFAULT TRUE
)
RETURNS SETOF public.classes_with_teachers
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  select cwt.*
  from public.classes_with_teachers cwt
  where
    (not p_only_active or coalesce(cwt.is_active, true))
    and (
      -- Super admin: full access
      public.app_is_super_admin()
      or
      -- Teacher: own classes
      cwt.teacher_id = auth.uid()
      or
      -- Same-tenant visibility via JWT claim (no circular lookups)
      (
        (auth.jwt() ->> 'preschool_id') is not null
        and cwt.preschool_id::text = auth.jwt() ->> 'preschool_id'
      )
    )
  order by cwt.created_at desc
  limit greatest(1, p_limit);
$$;

REVOKE ALL ON FUNCTION public.get_my_classes_with_teachers(int, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_classes_with_teachers(int, boolean) TO authenticated;

COMMIT;
