alter table public.transactions
  add column recurrence_end_on date;

alter table public.transactions
  add constraint transactions_recurrence_end_check
  check (recurrence_end_on is null or recurrence_end_on >= occurred_on);

-- Older versions materialised up to twelve rows for one recurring payment.
-- Keep the first row as the series definition; future occurrences are now derived.
with ranked_series as (
  select
    id,
    row_number() over (
      partition by household_id, recurrence_group_id
      order by occurred_on, created_at, id
    ) as occurrence_number
  from public.transactions
  where recurrence_group_id is not null
)
delete from public.transactions transaction
using ranked_series series
where transaction.id = series.id
  and series.occurrence_number > 1;

update public.transactions
set status = case when occurred_on <= current_date then 'approved' else 'scheduled' end,
    recurrence_end_on = null
where recurrence_group_id is not null;

-- Clear only untouched future example budgets created by the old 23,000 kr. seed.
-- Months containing any custom amount are deliberately left unchanged.
with untouched_seed_budgets as (
  select budget.id
  from public.budgets budget
  join public.budget_items item
    on item.budget_id = budget.id
   and item.household_id = budget.household_id
  join public.budget_categories category
    on category.id = item.category_id
   and category.household_id = item.household_id
  where budget.month > date_trunc('month', current_date)::date
  group by budget.id
  having count(*) filter (where category.name in ('Bolig', 'Mad & husholdning', 'Transport', 'Forsikring', 'Fritid')) = 5
     and sum(item.planned_amount) = 23000
     and bool_and(case category.name
       when 'Bolig' then item.planned_amount = 9000
       when 'Mad & husholdning' then item.planned_amount = 7000
       when 'Transport' then item.planned_amount = 3500
       when 'Forsikring' then item.planned_amount = 1500
       when 'Fritid' then item.planned_amount = 2000
       else item.planned_amount = 0
     end)
)
update public.budget_items item
set planned_amount = 0
where item.budget_id in (select id from untouched_seed_budgets);

update public.budgets budget
set spending_target = coalesce((
  select sum(item.planned_amount)
  from public.budget_items item
  where item.budget_id = budget.id
    and item.household_id = budget.household_id
), 0)
where budget.month > date_trunc('month', current_date)::date;
