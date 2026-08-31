
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  locale text not null default 'da' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  appearance text not null default 'system' check (appearance in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  currency text not null default 'DKK' check (currency ~ '^[A-Z]{3}$'),
  locale text not null default 'da-DK',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'adult', 'child', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, name)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  name text not null default 'Månedsbudget' check (char_length(name) between 1 and 100),
  income_target numeric(12,2) not null default 0 check (income_target >= 0),
  spending_target numeric(12,2) not null default 0 check (spending_target >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, month)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  budget_id uuid not null,
  category_id uuid not null,
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category_id),
  foreign key (budget_id, household_id) references public.budgets(id, household_id) on delete cascade,
  foreign key (category_id, household_id) references public.budget_categories(id, household_id) on delete restrict
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid,
  direction text not null check (direction in ('expense', 'income')),
  amount numeric(12,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  merchant text not null check (char_length(merchant) between 1 and 160),
  note text,
  source text not null default 'manual' check (source in ('manual', 'email', 'document', 'bank_import')),
  status text not null default 'approved' check (status in ('suggested', 'approved', 'rejected')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, household_id) references public.budget_categories(id, household_id) on delete set null
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  recurrence jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recurrence is null or jsonb_typeof(recurrence) = 'object')
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'other' check (kind in ('invoice', 'receipt', 'insurance', 'payslip', 'contract', 'warranty', 'other')),
  visibility text not null default 'household' check (visibility in ('household', 'private')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 20971520),
  processing_status text not null default 'ready' check (processing_status in ('uploaded', 'processing', 'ready', 'failed')),
  extracted_text text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility <> 'private' or owner_user_id = created_by)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  quantity text,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, week_start)
);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_plan_id uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  title text not null check (char_length(title) between 1 and 200),
  duration_minutes smallint check (duration_minutes is null or duration_minutes between 1 and 600),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, day_of_week),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete cascade
);

create index household_members_user_id_idx on public.household_members(user_id, household_id);
create index budget_categories_household_sort_idx on public.budget_categories(household_id, archived_at, sort_order);
create index budgets_household_month_idx on public.budgets(household_id, month desc);
create index budget_items_household_budget_idx on public.budget_items(household_id, budget_id);
create index budget_items_category_id_idx on public.budget_items(category_id);
create index transactions_household_date_idx on public.transactions(household_id, occurred_on desc);
create index transactions_category_id_idx on public.transactions(category_id);
create index transactions_created_by_idx on public.transactions(created_by);
create index tasks_household_due_idx on public.tasks(household_id, completed_at, due_at);
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_created_by_idx on public.tasks(created_by);
create index documents_household_created_idx on public.documents(household_id, created_at desc);
create index documents_owner_user_id_idx on public.documents(owner_user_id);
create index documents_created_by_idx on public.documents(created_by);
create index shopping_items_household_open_idx on public.shopping_items(household_id, completed_at, created_at);
create index shopping_items_created_by_idx on public.shopping_items(created_by);
create index meal_plans_household_week_idx on public.meal_plans(household_id, week_start desc);
create index meal_plans_created_by_idx on public.meal_plans(created_by);
create index meal_plan_items_household_plan_idx on public.meal_plan_items(household_id, meal_plan_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger households_set_updated_at before update on public.households for each row execute function private.set_updated_at();
create trigger budget_categories_set_updated_at before update on public.budget_categories for each row execute function private.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function private.set_updated_at();
create trigger budget_items_set_updated_at before update on public.budget_items for each row execute function private.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function private.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function private.set_updated_at();
create trigger shopping_items_set_updated_at before update on public.shopping_items for each row execute function private.set_updated_at();
create trigger meal_plans_set_updated_at before update on public.meal_plans for each row execute function private.set_updated_at();
create trigger meal_plan_items_set_updated_at before update on public.meal_plan_items for each row execute function private.set_updated_at();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.household_members hm
      where hm.household_id = target_household_id
        and hm.user_id = (select auth.uid())
    );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.household_members hm
      where hm.household_id = target_household_id
        and hm.user_id = (select auth.uid())
        and hm.role = 'owner'
    );
$$;

create or replace function public.can_manage_finances(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.household_members hm
      where hm.household_id = target_household_id
        and hm.user_id = (select auth.uid())
        and hm.role in ('owner', 'adult')
    );
$$;

create or replace function public.shares_household_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = target_user_id
    );
$$;

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
revoke all on function public.can_manage_finances(uuid) from public, anon;
revoke all on function public.shares_household_with(uuid) from public, anon;
revoke all on function public.try_uuid(text) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.can_manage_finances(uuid) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;
grant execute on function public.try_uuid(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;
alter table public.transactions enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.shopping_items enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.budget_categories to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.budget_items to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.meal_plan_items to authenticated;

create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.shares_household_with(id)));
create policy profiles_insert on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy households_select on public.households for select to authenticated
using ((select public.is_household_member(id)) or created_by = (select auth.uid()));
create policy households_insert on public.households for insert to authenticated
with check (created_by = (select auth.uid()));
create policy households_update on public.households for update to authenticated
using ((select public.is_household_owner(id)) or created_by = (select auth.uid()))
with check ((select public.is_household_owner(id)) or created_by = (select auth.uid()));
create policy households_delete on public.households for delete to authenticated
using ((select public.is_household_owner(id)));

create policy household_members_select on public.household_members for select to authenticated
using ((select public.is_household_member(household_id)));
create policy household_members_insert on public.household_members for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (
    (select public.is_household_owner(household_id))
    or (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1 from public.households h
        where h.id = household_id and h.created_by = (select auth.uid())
      )
    )
  )
);
create policy household_members_update on public.household_members for update to authenticated
using ((select public.is_household_owner(household_id)))
with check ((select public.is_household_owner(household_id)));
create policy household_members_delete on public.household_members for delete to authenticated
using ((select public.is_household_owner(household_id)));

create policy budget_categories_select on public.budget_categories for select to authenticated
using ((select public.can_manage_finances(household_id)));
create policy budget_categories_insert on public.budget_categories for insert to authenticated
with check ((select public.can_manage_finances(household_id)) and created_by = (select auth.uid()));
create policy budget_categories_update on public.budget_categories for update to authenticated
using ((select public.can_manage_finances(household_id)))
with check ((select public.can_manage_finances(household_id)));
create policy budget_categories_delete on public.budget_categories for delete to authenticated
using ((select public.can_manage_finances(household_id)));

create policy budgets_select on public.budgets for select to authenticated
using ((select public.can_manage_finances(household_id)));
create policy budgets_insert on public.budgets for insert to authenticated
with check ((select public.can_manage_finances(household_id)) and created_by = (select auth.uid()));
create policy budgets_update on public.budgets for update to authenticated
using ((select public.can_manage_finances(household_id)))
with check ((select public.can_manage_finances(household_id)));
create policy budgets_delete on public.budgets for delete to authenticated
using ((select public.can_manage_finances(household_id)));

create policy budget_items_select on public.budget_items for select to authenticated
using ((select public.can_manage_finances(household_id)));
create policy budget_items_insert on public.budget_items for insert to authenticated
with check ((select public.can_manage_finances(household_id)));
create policy budget_items_update on public.budget_items for update to authenticated
using ((select public.can_manage_finances(household_id)))
with check ((select public.can_manage_finances(household_id)));
create policy budget_items_delete on public.budget_items for delete to authenticated
using ((select public.can_manage_finances(household_id)));

create policy transactions_select on public.transactions for select to authenticated
using ((select public.can_manage_finances(household_id)));
create policy transactions_insert on public.transactions for insert to authenticated
with check ((select public.can_manage_finances(household_id)) and created_by = (select auth.uid()));
create policy transactions_update on public.transactions for update to authenticated
using ((select public.can_manage_finances(household_id)))
with check ((select public.can_manage_finances(household_id)));
create policy transactions_delete on public.transactions for delete to authenticated
using ((select public.can_manage_finances(household_id)));

create policy tasks_select on public.tasks for select to authenticated
using ((select public.is_household_member(household_id)));
create policy tasks_insert on public.tasks for insert to authenticated
with check ((select public.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
using ((select public.is_household_member(household_id)))
with check ((select public.is_household_member(household_id)));
create policy tasks_delete on public.tasks for delete to authenticated
using (created_by = (select auth.uid()) or (select public.is_household_owner(household_id)));

create policy documents_select on public.documents for select to authenticated
using (
  (select public.is_household_member(household_id))
  and (visibility = 'household' or owner_user_id = (select auth.uid()))
);
create policy documents_insert on public.documents for insert to authenticated
with check (
  (select public.is_household_member(household_id))
  and created_by = (select auth.uid())
  and (visibility = 'household' or owner_user_id = (select auth.uid()))
);
create policy documents_update on public.documents for update to authenticated
using (created_by = (select auth.uid()) or (select public.is_household_owner(household_id)))
with check (
  (select public.is_household_member(household_id))
  and (visibility = 'household' or owner_user_id = (select auth.uid()) or (select public.is_household_owner(household_id)))
);
create policy documents_delete on public.documents for delete to authenticated
using (created_by = (select auth.uid()) or (select public.is_household_owner(household_id)));

create policy shopping_items_select on public.shopping_items for select to authenticated
using ((select public.is_household_member(household_id)));
create policy shopping_items_insert on public.shopping_items for insert to authenticated
with check ((select public.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy shopping_items_update on public.shopping_items for update to authenticated
using ((select public.is_household_member(household_id)))
with check ((select public.is_household_member(household_id)));
create policy shopping_items_delete on public.shopping_items for delete to authenticated
using (created_by = (select auth.uid()) or (select public.is_household_owner(household_id)));

create policy meal_plans_select on public.meal_plans for select to authenticated
using ((select public.is_household_member(household_id)));
create policy meal_plans_insert on public.meal_plans for insert to authenticated
with check ((select public.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy meal_plans_update on public.meal_plans for update to authenticated
using ((select public.is_household_member(household_id)))
with check ((select public.is_household_member(household_id)));
create policy meal_plans_delete on public.meal_plans for delete to authenticated
using (created_by = (select auth.uid()) or (select public.is_household_owner(household_id)));

create policy meal_plan_items_select on public.meal_plan_items for select to authenticated
using ((select public.is_household_member(household_id)));
create policy meal_plan_items_insert on public.meal_plan_items for insert to authenticated
with check ((select public.is_household_member(household_id)));
create policy meal_plan_items_update on public.meal_plan_items for update to authenticated
using ((select public.is_household_member(household_id)))
with check ((select public.is_household_member(household_id)));
create policy meal_plan_items_delete on public.meal_plan_items for delete to authenticated
using ((select public.is_household_member(household_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'household-documents',
  'household-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy household_documents_select on storage.objects for select to authenticated
using (
  bucket_id = 'household-documents'
  and (select public.is_household_member(public.try_uuid(split_part(name, '/', 1))))
);
create policy household_documents_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'household-documents'
  and (select public.is_household_member(public.try_uuid(split_part(name, '/', 1))))
);
create policy household_documents_update on storage.objects for update to authenticated
using (
  bucket_id = 'household-documents'
  and (
    owner_id = (select auth.uid())::text
    or (select public.is_household_owner(public.try_uuid(split_part(name, '/', 1))))
  )
)
with check (
  bucket_id = 'household-documents'
  and (select public.is_household_member(public.try_uuid(split_part(name, '/', 1))))
);
create policy household_documents_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'household-documents'
  and (
    owner_id = (select auth.uid())::text
    or (select public.is_household_owner(public.try_uuid(split_part(name, '/', 1))))
  )
);

