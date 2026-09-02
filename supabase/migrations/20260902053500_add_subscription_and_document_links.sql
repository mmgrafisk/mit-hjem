alter table public.transactions add constraint transactions_id_household_unique unique (id, household_id);
alter table public.documents add constraint documents_id_household_unique unique (id, household_id);

create table public.transaction_documents (
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null,
  document_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (transaction_id, document_id),
  foreign key (transaction_id, household_id) references public.transactions(id, household_id) on delete cascade,
  foreign key (document_id, household_id) references public.documents(id, household_id) on delete cascade
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  website_url text,
  account_identifier text,
  password_manager_url text,
  amount numeric(12,2) check (amount is null or amount >= 0),
  billing_interval_months integer not null default 1 check (billing_interval_months between 1 and 120),
  trial_ends_on date,
  cancellation_deadline_on date,
  next_payment_on date,
  status text not null default 'active' check (status in ('trial', 'active', 'cancelled')),
  linked_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (linked_transaction_id, household_id) references public.transactions(id, household_id) on delete set null (linked_transaction_id)
);

create table public.subscription_documents (
  household_id uuid not null references public.households(id) on delete cascade,
  subscription_id uuid not null,
  document_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (subscription_id, document_id),
  foreign key (subscription_id, household_id) references public.subscriptions(id, household_id) on delete cascade,
  foreign key (document_id, household_id) references public.documents(id, household_id) on delete cascade
);

create index transaction_documents_household_idx on public.transaction_documents(household_id, transaction_id);
create index transaction_documents_document_idx on public.transaction_documents(document_id);
create index subscriptions_household_status_idx on public.subscriptions(household_id, status, cancellation_deadline_on);
create index subscriptions_transaction_idx on public.subscriptions(linked_transaction_id) where linked_transaction_id is not null;
create index subscription_documents_household_idx on public.subscription_documents(household_id, subscription_id);
create index subscription_documents_document_idx on public.subscription_documents(document_id);

create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function private.set_updated_at();

alter table public.transaction_documents enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_documents enable row level security;

grant select, insert, update, delete on public.transaction_documents to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscription_documents to authenticated;

create policy transaction_documents_select on public.transaction_documents for select to authenticated
using ((select private.is_household_member(household_id)));
create policy transaction_documents_insert on public.transaction_documents for insert to authenticated
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy transaction_documents_update on public.transaction_documents for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy transaction_documents_delete on public.transaction_documents for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy subscriptions_select on public.subscriptions for select to authenticated
using ((select private.is_household_member(household_id)));
create policy subscriptions_insert on public.subscriptions for insert to authenticated
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy subscriptions_update on public.subscriptions for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy subscriptions_delete on public.subscriptions for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy subscription_documents_select on public.subscription_documents for select to authenticated
using ((select private.is_household_member(household_id)));
create policy subscription_documents_insert on public.subscription_documents for insert to authenticated
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy subscription_documents_update on public.subscription_documents for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy subscription_documents_delete on public.subscription_documents for delete to authenticated
using ((select private.is_household_member(household_id)));
