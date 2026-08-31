alter table public.budget_categories
  add column category_type text not null default 'variable_expense'
  check (category_type in ('fixed_expense', 'variable_expense', 'saving', 'debt'));

update public.budget_categories
set category_type = case
  when lower(name) in ('bolig', 'transport', 'forsikring', 'forsikringer', 'abonnementer') then 'fixed_expense'
  when lower(name) in ('opsparing', 'opsparinger') then 'saving'
  when lower(name) in ('gæld', 'lån', 'afdrag') then 'debt'
  else 'variable_expense'
end;

create or replace function public.ensure_budget_months(
  p_household_id uuid,
  p_months date[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_month date;
  current_budget_id uuid;
  previous_budget public.budgets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  foreach requested_month in array p_months loop
    if requested_month <> date_trunc('month', requested_month)::date then
      raise exception 'Budget month must be the first day of a month';
    end if;

    select id into current_budget_id
    from public.budgets
    where household_id = p_household_id and month = requested_month;

    if current_budget_id is null then
      select * into previous_budget
      from public.budgets
      where household_id = p_household_id and month < requested_month
      order by month desc
      limit 1;

      insert into public.budgets (
        household_id,
        created_by,
        month,
        name,
        income_target,
        spending_target
      ) values (
        p_household_id,
        auth.uid(),
        requested_month,
        to_char(requested_month, 'TMMon YYYY'),
        coalesce(previous_budget.income_target, 0),
        coalesce(previous_budget.spending_target, 0)
      )
      on conflict (household_id, month) do nothing
      returning id into current_budget_id;

      if current_budget_id is null then
        select id into strict current_budget_id
        from public.budgets
        where household_id = p_household_id and month = requested_month;
      end if;
    end if;

    insert into public.budget_items (
      household_id,
      budget_id,
      category_id,
      planned_amount
    )
    select
      p_household_id,
      current_budget_id,
      category.id,
      coalesce((
        select previous_item.planned_amount
        from public.budget_items previous_item
        join public.budgets previous_month on previous_month.id = previous_item.budget_id
        where previous_item.household_id = p_household_id
          and previous_item.category_id = category.id
          and previous_month.month < requested_month
        order by previous_month.month desc
        limit 1
      ), 0)
    from public.budget_categories category
    where category.household_id = p_household_id
      and category.archived_at is null
    on conflict (budget_id, category_id) do nothing;

    update public.budgets budget
    set spending_target = coalesce((
      select sum(item.planned_amount)
      from public.budget_items item
      where item.budget_id = current_budget_id
        and item.household_id = p_household_id
    ), 0)
    where budget.id = current_budget_id
      and budget.household_id = p_household_id;
  end loop;
end;
$$;

create or replace function public.update_budget_plans(
  p_household_id uuid,
  p_category_id uuid,
  p_budget_ids uuid[],
  p_amount numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed_count integer;
  expected_count integer;
begin
  expected_count := coalesce(cardinality(p_budget_ids), 0);
  if expected_count = 0 then
    raise exception 'At least one budget is required';
  end if;
  if p_amount < 0 or p_amount > 9999999999.99 then
    raise exception 'Amount is outside the supported range';
  end if;

  update public.budget_items
  set planned_amount = p_amount
  where household_id = p_household_id
    and category_id = p_category_id
    and budget_id = any(p_budget_ids);

  get diagnostics changed_count = row_count;
  if changed_count <> expected_count then
    raise exception 'Not all budget items could be updated';
  end if;

  update public.budgets budget
  set spending_target = coalesce((
    select sum(item.planned_amount)
    from public.budget_items item
    where item.household_id = p_household_id
      and item.budget_id = budget.id
  ), 0)
  where budget.household_id = p_household_id
    and budget.id = any(p_budget_ids);
end;
$$;

create or replace function public.add_budget_category(
  p_household_id uuid,
  p_budget_ids uuid[],
  p_name text,
  p_color text,
  p_category_type text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_category_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(p_name)) not between 1 and 80 then
    raise exception 'Category name must contain between 1 and 80 characters';
  end if;
  if p_category_type not in ('fixed_expense', 'variable_expense', 'saving', 'debt') then
    raise exception 'Unsupported category type';
  end if;

  insert into public.budget_categories (
    household_id,
    created_by,
    name,
    color,
    category_type,
    sort_order
  ) values (
    p_household_id,
    auth.uid(),
    trim(p_name),
    p_color,
    p_category_type,
    coalesce((select max(sort_order) + 1 from public.budget_categories where household_id = p_household_id), 0)
  )
  returning id into new_category_id;

  insert into public.budget_items (household_id, budget_id, category_id, planned_amount)
  select p_household_id, budget.id, new_category_id, 0
  from public.budgets budget
  where budget.household_id = p_household_id
    and budget.id = any(p_budget_ids);

  if (select count(*) from public.budget_items where category_id = new_category_id) <> coalesce(cardinality(p_budget_ids), 0) then
    raise exception 'Not all category budget items could be created';
  end if;

  return new_category_id;
end;
$$;

revoke execute on function public.ensure_budget_months(uuid, date[]) from public, anon;
revoke execute on function public.update_budget_plans(uuid, uuid, uuid[], numeric) from public, anon;
revoke execute on function public.add_budget_category(uuid, uuid[], text, text, text) from public, anon;

grant execute on function public.ensure_budget_months(uuid, date[]) to authenticated, service_role;
grant execute on function public.update_budget_plans(uuid, uuid, uuid[], numeric) to authenticated, service_role;
grant execute on function public.add_budget_category(uuid, uuid[], text, text, text) to authenticated, service_role;
