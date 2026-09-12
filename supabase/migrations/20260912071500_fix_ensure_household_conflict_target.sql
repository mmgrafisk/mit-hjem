begin;

create or replace function public.ensure_current_user_household(p_full_name text default null)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_household_id uuid;
  selected_household_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));

  insert into public.profiles (id, full_name, locale)
  values (current_user_id, coalesce(nullif(trim(p_full_name), ''), 'Bruger'), 'da-DK')
  on conflict (id) do update
    set full_name = excluded.full_name;

  select household.id, household.name
    into selected_household_id, selected_household_name
  from public.household_members membership
  join public.households household on household.id = membership.household_id
  where membership.user_id = current_user_id
  order by membership.joined_at desc
  limit 1;

  if selected_household_id is null then
    select household.id, household.name
      into selected_household_id, selected_household_name
    from public.households household
    where household.created_by = current_user_id
    order by household.created_at asc
    limit 1;
  end if;

  if selected_household_id is null then
    insert into public.households (created_by, name, locale, currency)
    values (current_user_id, 'Mit hjem', 'da-DK', 'DKK')
    returning id, name into selected_household_id, selected_household_name;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (selected_household_id, current_user_id, 'owner')
  on conflict on constraint household_members_pkey do nothing;

  return query select selected_household_id, selected_household_name;
end;
$$;

revoke all on function public.ensure_current_user_household(text) from public, anon;
grant execute on function public.ensure_current_user_household(text) to authenticated;

commit;
