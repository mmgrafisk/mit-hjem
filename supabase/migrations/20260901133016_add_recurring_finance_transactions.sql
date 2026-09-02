alter table public.transactions
  add column recurrence_interval_months smallint,
  add column recurrence_group_id uuid;

alter table public.transactions
  add constraint transactions_recurrence_interval_check
  check (recurrence_interval_months is null or recurrence_interval_months in (1, 2, 3, 6));

alter table public.transactions drop constraint transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check
  check (status in ('suggested', 'approved', 'scheduled', 'rejected'));

create index transactions_recurrence_group_idx
  on public.transactions (household_id, recurrence_group_id, occurred_on)
  where recurrence_group_id is not null;
