-- RLS-safe RPC for SuperAdmin to update subscription plans
-- Run this in Supabase SQL editor with service role or via CLI

-- Safely change an existing subscription's plan and related metadata
CREATE OR REPLACE FUNCTION public.admin_update_subscription_plan(
  p_subscription_id uuid,
  p_new_plan_id text,
  p_billing_frequency text DEFAULT NULL, -- 'monthly' | 'annual' | null (keep current)
  p_seats_total int DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
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
begin
  -- Authorization (match create RPC roles)
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
    billing_frequency = v_new_freq,
    seats_total = coalesce(p_seats_total, s.seats_total),
    metadata = v_updated_metadata,
    updated_at = now()
  where s.id = p_subscription_id;

  -- Keep preschool tier in sync
  update public.preschools ps
  set subscription_tier = p_new_plan_id
  where ps.id = v_sub.school_id;

  return p_subscription_id;
end;
$$;

-- Grant execute permissions
REVOKE ALL ON FUNCTION public.admin_update_subscription_plan FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_plan(uuid, text, text, int, text, jsonb) TO authenticated;
