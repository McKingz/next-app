-- Fix Missing Subscription Functions
-- Run this in Supabase SQL Editor with service role permissions

-- 1. First, let's create the admin_create_school_subscription function
CREATE OR REPLACE FUNCTION public.admin_create_school_subscription(
  p_school_id uuid,
  p_plan_id text,
  p_billing_frequency text,
  p_seats_total int DEFAULT 1,
  p_start_trial boolean DEFAULT FALSE
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare 
  v_id uuid; 
  v_start timestamptz := now(); 
  v_end timestamptz; 
  v_status text; 
  v_school_tier text;
  v_is_paid_plan boolean;
begin
  -- Check authorization
  if not exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','superadmin','principal_admin')
  ) then
    raise exception 'not authorized';
  end if;

  if p_billing_frequency not in ('monthly','annual') then
    raise exception 'invalid billing_frequency';
  end if;

  -- Calculate end date
  if p_billing_frequency = 'annual' then 
    v_end := v_start + interval '1 year'; 
  else 
    v_end := v_start + interval '1 month'; 
  end if;

  -- Determine if this is a paid plan
  v_is_paid_plan := p_plan_id not in ('free', 'trial');

  -- Set status: paid plans start as 'pending_payment', free plans as 'active'
  if v_is_paid_plan then
    v_status := 'pending_payment';
  else
    v_status := case when p_start_trial then 'trial' else 'active' end;
  end if;

  -- Upsert school subscription
  select id into v_id 
  from public.subscriptions 
  where owner_type = 'school' and school_id = p_school_id 
  limit 1;

  if v_id is null then
    insert into public.subscriptions(
      id, school_id, plan_id, status, owner_type, billing_frequency, 
      start_date, end_date, next_billing_date, trial_end_date, 
      seats_total, seats_used, metadata
    )
    values (
      gen_random_uuid(), p_school_id, p_plan_id, v_status, 'school', p_billing_frequency, 
      v_start, v_end, v_end, 
      (case when v_status = 'trial' then v_start + interval '14 days' else null end), 
      greatest(1, coalesce(p_seats_total,1)), 0, 
      jsonb_build_object(
        'created_by', 'admin_create',
        'created_at', now(),
        'requires_payment', v_is_paid_plan
      )
    )
    returning id into v_id;
  else
    update public.subscriptions
    set 
      plan_id = p_plan_id,
      status = v_status,
      billing_frequency = p_billing_frequency,
      start_date = v_start,
      end_date = v_end,
      next_billing_date = v_end,
      trial_end_date = (case when v_status = 'trial' then v_start + interval '14 days' else null end),
      seats_total = greatest(1, coalesce(p_seats_total,1)),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'updated_by', 'admin_update',
        'updated_at', now(),
        'requires_payment', v_is_paid_plan
      )
    where id = v_id;
  end if;

  -- Map plan tier to allowed preschools.subscription_tier values
  v_school_tier := case lower(p_plan_id)
    when 'basic' then 'basic'
    when 'premium' then 'premium'
    when 'enterprise' then 'enterprise'
    when 'starter' then 'basic'
    when 'pro' then 'premium'
    when 'free' then 'trial'
    else 'trial'
  end;

  -- Update preschool tier (safe update)
  begin
    update public.preschools 
    set subscription_tier = v_school_tier 
    where id = p_school_id;
  exception when others then
    -- Ignore constraint issues but keep subscription
    perform 1;
  end;

  return v_id;
end; 
$$;

-- 2. Update the admin_update_subscription_plan function with correct parameter order
CREATE OR REPLACE FUNCTION public.admin_update_subscription_plan(
  p_billing_frequency text,
  p_metadata jsonb,
  p_new_plan_id text,
  p_reason text,
  p_seats_total int,
  p_subscription_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_is_admin boolean;
  v_sub record;
  v_plan record;
  v_new_freq text;
  v_price numeric;
  v_updated_metadata jsonb;
  v_is_paid_plan boolean;
  v_new_status text;
begin
  -- Authorization
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','superadmin','principal_admin')
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'not authorized';
  end if;

  if p_subscription_id is null then
    raise exception 'subscription_id is required';
  end if;

  -- Load current subscription
  select * into v_sub
  from public.subscriptions s
  where s.id = p_subscription_id
  for update;

  if not found then
    raise exception 'subscription not found';
  end if;

  -- Validate frequency if provided
  if p_billing_frequency is not null and p_billing_frequency not in ('monthly','annual') then
    raise exception 'invalid billing_frequency';
  end if;

  v_new_freq := coalesce(p_billing_frequency, v_sub.billing_frequency);

  -- Resolve plan by tier text or UUID text
  select sp.*
  into v_plan
  from public.subscription_plans sp
  where sp.tier = p_new_plan_id
     or sp.id::text = p_new_plan_id;

  if not found then
    raise exception 'plan not found for %', p_new_plan_id;
  end if;

  -- Determine if this is a paid plan
  v_is_paid_plan := p_new_plan_id not in ('free', 'trial');
  
  -- Set status: if changing to paid plan, set pending_payment
  if v_is_paid_plan and v_sub.status = 'active' and v_sub.plan_id in ('free', 'trial') then
    v_new_status := 'pending_payment';
  else
    v_new_status := v_sub.status; -- Keep current status for other changes
  end if;

  -- Compute current price for metadata snapshot
  select case v_new_freq
    when 'annual' then sp.price_annual
    else sp.price_monthly
  end into v_price
  from public.subscription_plans sp
  where sp.id = v_plan.id;

  -- Build metadata with audit history append
  v_updated_metadata := coalesce(v_sub.metadata, '{}'::jsonb);

  v_updated_metadata := jsonb_set(
    v_updated_metadata,
    '{history}',
    coalesce(v_updated_metadata->'history','[]'::jsonb) || jsonb_build_object(
      'event', 'plan_changed',
      'changed_at', now(),
      'changed_by', auth.uid(),
      'reason', p_reason,
      'old_plan_id', v_sub.plan_id,
      'new_plan_id', p_new_plan_id,
      'old_billing_frequency', v_sub.billing_frequency,
      'new_billing_frequency', v_new_freq,
      'old_seats_total', v_sub.seats_total,
      'new_seats_total', coalesce(p_seats_total, v_sub.seats_total),
      'price_at_change', v_price,
      'requires_payment', v_is_paid_plan,
      'plan_ref', jsonb_build_object(
        'plan_uuid', v_plan.id,
        'tier', v_plan.tier,
        'name', v_plan.name
      )
    ),
    true
  );

  -- Merge in any extra metadata passed by caller
  v_updated_metadata := v_updated_metadata || coalesce(p_metadata, '{}'::jsonb);

  -- Update the subscription
  update public.subscriptions s
  set
    plan_id = p_new_plan_id,
    status = v_new_status,
    billing_frequency = v_new_freq,
    seats_total = coalesce(p_seats_total, s.seats_total),
    metadata = v_updated_metadata,
    updated_at = now()
  where s.id = p_subscription_id;

  -- Keep preschool tier in sync
  update public.preschools ps
  set subscription_tier = case lower(p_new_plan_id)
    when 'basic' then 'basic'
    when 'premium' then 'premium'
    when 'enterprise' then 'enterprise'
    when 'starter' then 'basic'
    when 'pro' then 'premium'
    when 'free' then 'trial'
    else 'trial'
  end
  where ps.id = v_sub.school_id;

  return p_subscription_id;
end;
$$;

-- 3. Grant proper permissions
REVOKE ALL ON FUNCTION public.admin_create_school_subscription FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_school_subscription(uuid, text, text, int, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_subscription_plan FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_plan(text, jsonb, text, text, int, uuid) TO authenticated;

-- 4. Add subscription status enum if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'inactive', 'trial', 'pending_payment', 'cancelled', 'expired');
    
    -- Update subscriptions table to use the enum
    ALTER TABLE public.subscriptions 
    ALTER COLUMN status TYPE subscription_status_enum 
    USING status::subscription_status_enum;
  END IF;
END $$;

-- Verify functions exist
SELECT
  routine_name,
  routine_type,
  specific_name
FROM information_schema.routines
WHERE
  routine_schema = 'public'
  AND routine_name IN ('admin_create_school_subscription', 'admin_update_subscription_plan')
ORDER BY routine_name;
