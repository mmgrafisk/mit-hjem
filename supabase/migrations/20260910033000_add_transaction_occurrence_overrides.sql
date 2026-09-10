create table public.transaction_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null,
  occurred_on date not null,
  amount numeric(12,2),
  is_skipped boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id, occurred_on),
  foreign key (transaction_id, household_id) references public.transactions(id, household_id) on delete cascade,
  check (
    (is_skipped and amount is null)
    or (not is_skipped and amount > 0 and amount <= 9999999999.99)
  )
);

create index transaction_occurrence_overrides_period_idx
  on public.transaction_occurrence_overrides (household_id, occurred_on, transaction_id);

create trigger transaction_occurrence_overrides_set_updated_at
before update on public.transaction_occurrence_overrides
for each row execute function private.set_updated_at();

alter table public.transaction_occurrence_overrides enable row level security;

revoke all on table public.transaction_occurrence_overrides from anon;
grant select, insert, update, delete on table public.transaction_occurrence_overrides to authenticated;

create policy transaction_occurrence_overrides_select
on public.transaction_occurrence_overrides for select to authenticated
using ((select private.is_household_member(household_id)));

create policy transaction_occurrence_overrides_insert
on public.transaction_occurrence_overrides for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy transaction_occurrence_overrides_update
on public.transaction_occurrence_overrides for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy transaction_occurrence_overrides_delete
on public.transaction_occurrence_overrides for delete to authenticated
using ((select private.is_household_member(household_id)));

create or replace function public.set_transaction_occurrence_override(
  p_household_id uuid,
  p_transaction_id uuid,
  p_occurred_on date,
  p_amount numeric,
  p_skip boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_transaction public.transactions%rowtype;
  month_delta integer;
  expected_day integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_skip = (p_amount is not null) then
    raise exception 'Provide either a positive amount or a skipped occurrence';
  end if;
  if p_amount is not null and (p_amount <= 0 or p_amount > 9999999999.99) then
    raise exception 'Amount is outside the supported range';
  end if;

  select * into source_transaction
  from public.transactions
  where id = p_transaction_id and household_id = p_household_id;
  if not found then
    raise exception 'Transaction not found';
  end if;

  if source_transaction.recurrence_interval_months is null then
    if p_occurred_on <> source_transaction.occurred_on then
      raise exception 'Date is not a transaction occurrence';
    end if;
  else
    month_delta :=
      (extract(year from p_occurred_on)::integer * 12 + extract(month from p_occurred_on)::integer)
      - (extract(year from source_transaction.occurred_on)::integer * 12 + extract(month from source_transaction.occurred_on)::integer);
    expected_day := least(
      extract(day from source_transaction.occurred_on)::integer,
      extract(day from (date_trunc('month', p_occurred_on) + interval '1 month - 1 day'))::integer
    );
    if month_delta < 0
      or mod(month_delta, source_transaction.recurrence_interval_months) <> 0
      or extract(day from p_occurred_on)::integer <> expected_day
      or (source_transaction.recurrence_end_on is not null and p_occurred_on > source_transaction.recurrence_end_on)
    then
      raise exception 'Date is not a transaction occurrence';
    end if;
  end if;

  insert into public.transaction_occurrence_overrides (
    household_id, transaction_id, occurred_on, amount, is_skipped, created_by
  ) values (
    p_household_id, p_transaction_id, p_occurred_on, p_amount, p_skip, auth.uid()
  )
  on conflict (transaction_id, occurred_on) do update
  set amount = excluded.amount,
      is_skipped = excluded.is_skipped;
end;
$$;

create or replace function public.split_recurring_transaction(
  p_household_id uuid,
  p_transaction_id uuid,
  p_effective_on date,
  p_amount numeric,
  p_stop boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_transaction public.transactions%rowtype;
  successor_id uuid;
  effective_group_id uuid;
  month_delta integer;
  expected_day integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_stop = (p_amount is not null) then
    raise exception 'Provide either a positive amount or stop the series';
  end if;
  if p_amount is not null and (p_amount <= 0 or p_amount > 9999999999.99) then
    raise exception 'Amount is outside the supported range';
  end if;

  select * into source_transaction
  from public.transactions
  where id = p_transaction_id and household_id = p_household_id
  for update;
  if not found or source_transaction.recurrence_interval_months is null then
    raise exception 'Recurring transaction not found';
  end if;
  effective_group_id := coalesce(source_transaction.recurrence_group_id, gen_random_uuid());

  month_delta :=
    (extract(year from p_effective_on)::integer * 12 + extract(month from p_effective_on)::integer)
    - (extract(year from source_transaction.occurred_on)::integer * 12 + extract(month from source_transaction.occurred_on)::integer);
  expected_day := least(
    extract(day from source_transaction.occurred_on)::integer,
    extract(day from (date_trunc('month', p_effective_on) + interval '1 month - 1 day'))::integer
  );
  if month_delta < 0
    or mod(month_delta, source_transaction.recurrence_interval_months) <> 0
    or extract(day from p_effective_on)::integer <> expected_day
    or (source_transaction.recurrence_end_on is not null and p_effective_on > source_transaction.recurrence_end_on)
  then
    raise exception 'Date is not a transaction occurrence';
  end if;

  delete from public.transaction_occurrence_overrides
  where household_id = p_household_id
    and transaction_id = p_transaction_id
    and occurred_on >= p_effective_on;

  if p_effective_on = source_transaction.occurred_on then
    if p_stop then
      update public.transactions
      set recurrence_end_on = occurred_on,
          recurrence_group_id = effective_group_id
      where id = p_transaction_id and household_id = p_household_id;
      insert into public.transaction_occurrence_overrides (
        household_id, transaction_id, occurred_on, amount, is_skipped, created_by
      ) values (
        p_household_id, p_transaction_id, p_effective_on, null, true, auth.uid()
      );
    else
      update public.transactions
      set amount = p_amount,
          recurrence_group_id = effective_group_id
      where id = p_transaction_id and household_id = p_household_id;
    end if;
    return p_transaction_id;
  end if;

  update public.transactions
  set recurrence_end_on = p_effective_on - 1,
      recurrence_group_id = effective_group_id
  where id = p_transaction_id and household_id = p_household_id;

  if p_stop then
    return null;
  end if;

  insert into public.transactions (
    household_id,
    created_by,
    merchant,
    amount,
    direction,
    occurred_on,
    category_id,
    note,
    source,
    status,
    recurrence_interval_months,
    recurrence_group_id,
    recurrence_end_on
  ) values (
    p_household_id,
    auth.uid(),
    source_transaction.merchant,
    p_amount,
    source_transaction.direction,
    p_effective_on,
    source_transaction.category_id,
    source_transaction.note,
    source_transaction.source,
    case when p_effective_on <= current_date then 'approved' else 'scheduled' end,
    source_transaction.recurrence_interval_months,
    effective_group_id,
    source_transaction.recurrence_end_on
  )
  returning id into successor_id;

  insert into public.transaction_documents (
    household_id, transaction_id, document_id, created_by
  )
  select household_id, successor_id, document_id, auth.uid()
  from public.transaction_documents
  where household_id = p_household_id and transaction_id = p_transaction_id
  on conflict do nothing;

  return successor_id;
end;
$$;

revoke execute on function public.set_transaction_occurrence_override(uuid, uuid, date, numeric, boolean) from public, anon;
revoke execute on function public.split_recurring_transaction(uuid, uuid, date, numeric, boolean) from public, anon;
grant execute on function public.set_transaction_occurrence_override(uuid, uuid, date, numeric, boolean) to authenticated, service_role;
grant execute on function public.split_recurring_transaction(uuid, uuid, date, numeric, boolean) to authenticated, service_role;
