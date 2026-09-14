create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default '#5b6ee1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, name)
);

create table public.document_tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  normalized_name text generated always as (lower(btrim(name))) stored,
  color text not null default '#7c6ee6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, normalized_name)
);

alter table public.documents
  add column folder_id uuid,
  add column document_date date,
  add column expires_on date,
  add column notes text check (notes is null or char_length(notes) <= 4000),
  add column archived_at timestamptz,
  add constraint documents_folder_household_fkey
    foreign key (folder_id, household_id)
    references public.document_folders(id, household_id)
    on delete restrict,
  add constraint documents_date_order_check
    check (expires_on is null or document_date is null or expires_on >= document_date);

create table public.document_tag_links (
  document_id uuid not null,
  tag_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id),
  foreign key (document_id, household_id)
    references public.documents(id, household_id) on delete cascade,
  foreign key (tag_id, household_id)
    references public.document_tags(id, household_id) on delete cascade
);

alter table public.tasks
  add constraint tasks_id_household_unique unique (id, household_id);

create table public.task_documents (
  task_id uuid not null,
  document_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, document_id),
  foreign key (task_id, household_id)
    references public.tasks(id, household_id) on delete cascade,
  foreign key (document_id, household_id)
    references public.documents(id, household_id) on delete cascade
);

create index document_folders_created_by_idx on public.document_folders(created_by);
create index document_tags_created_by_idx on public.document_tags(created_by);
create index documents_archive_folder_created_idx on public.documents(household_id, archived_at, folder_id, created_at desc);
create index documents_expiry_idx on public.documents(household_id, expires_on) where archived_at is null and expires_on is not null;
create index document_tag_links_household_document_idx on public.document_tag_links(household_id, document_id);
create index document_tag_links_household_tag_idx on public.document_tag_links(household_id, tag_id);
create index document_tag_links_created_by_idx on public.document_tag_links(created_by);
create index task_documents_household_task_idx on public.task_documents(household_id, task_id);
create index task_documents_household_document_idx on public.task_documents(household_id, document_id);
create index task_documents_created_by_idx on public.task_documents(created_by);

create trigger document_folders_set_updated_at
before update on public.document_folders
for each row execute function private.set_updated_at();

alter table public.document_folders enable row level security;
alter table public.document_tags enable row level security;
alter table public.document_tag_links enable row level security;
alter table public.task_documents enable row level security;

grant select, insert, update, delete on public.document_folders to authenticated;
grant select, insert, update, delete on public.document_tags to authenticated;
grant select, insert, delete on public.document_tag_links to authenticated;
grant select, insert, delete on public.task_documents to authenticated;

create policy document_folders_select on public.document_folders
for select to authenticated
using ((select private.is_household_member(household_id)));

create policy document_folders_insert on public.document_folders
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy document_folders_update on public.document_folders
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy document_folders_delete on public.document_folders
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy document_tags_select on public.document_tags
for select to authenticated
using ((select private.is_household_member(household_id)));

create policy document_tags_insert on public.document_tags
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy document_tags_update on public.document_tags
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create policy document_tags_delete on public.document_tags
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy document_tag_links_select on public.document_tag_links
for select to authenticated
using (
  (select private.is_household_member(household_id))
  and exists (
    select 1
    from public.documents document
    where document.id = document_tag_links.document_id
      and document.household_id = document_tag_links.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy document_tag_links_insert on public.document_tag_links
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.documents document
    where document.id = document_tag_links.document_id
      and document.household_id = document_tag_links.household_id
      and (document.created_by = (select auth.uid()) or (select private.is_household_owner(document_tag_links.household_id)))
  )
  and exists (
    select 1 from public.document_tags tag
    where tag.id = document_tag_links.tag_id and tag.household_id = document_tag_links.household_id
  )
);

create policy document_tag_links_delete on public.document_tag_links
for delete to authenticated
using (
  exists (
    select 1
    from public.documents document
    where document.id = document_tag_links.document_id
      and document.household_id = document_tag_links.household_id
      and (document.created_by = (select auth.uid()) or (select private.is_household_owner(document_tag_links.household_id)))
  )
);

create policy task_documents_select on public.task_documents
for select to authenticated
using (
  (select private.is_household_member(household_id))
  and exists (
    select 1
    from public.documents document
    where document.id = task_documents.document_id
      and document.household_id = task_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy task_documents_insert on public.task_documents
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_household_member(household_id))
  and exists (
    select 1
    from public.documents document
    where document.id = task_documents.document_id
      and document.household_id = task_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy task_documents_delete on public.task_documents
for delete to authenticated
using (
  (select private.is_household_member(household_id))
  and exists (
    select 1
    from public.documents document
    where document.id = task_documents.document_id
      and document.household_id = task_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists transaction_documents_select on public.transaction_documents;
drop policy if exists transaction_documents_insert on public.transaction_documents;
drop policy if exists transaction_documents_update on public.transaction_documents;
drop policy if exists transaction_documents_delete on public.transaction_documents;

create policy transaction_documents_select on public.transaction_documents
for select to authenticated
using (
  (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = transaction_documents.document_id
      and document.household_id = transaction_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy transaction_documents_insert on public.transaction_documents
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = transaction_documents.document_id
      and document.household_id = transaction_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy transaction_documents_update on public.transaction_documents
for update to authenticated
using ((select private.is_household_member(household_id)))
with check (
  (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = transaction_documents.document_id
      and document.household_id = transaction_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy transaction_documents_delete on public.transaction_documents
for delete to authenticated
using (
  (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = transaction_documents.document_id
      and document.household_id = transaction_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists subscription_documents_select on public.subscription_documents;
drop policy if exists subscription_documents_insert on public.subscription_documents;
drop policy if exists subscription_documents_update on public.subscription_documents;
drop policy if exists subscription_documents_delete on public.subscription_documents;

create policy subscription_documents_select on public.subscription_documents
for select to authenticated
using (
  (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = subscription_documents.document_id
      and document.household_id = subscription_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy subscription_documents_insert on public.subscription_documents
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = subscription_documents.document_id
      and document.household_id = subscription_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy subscription_documents_update on public.subscription_documents
for update to authenticated
using ((select private.is_household_member(household_id)))
with check (
  (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = subscription_documents.document_id
      and document.household_id = subscription_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create policy subscription_documents_delete on public.subscription_documents
for delete to authenticated
using (
  (select private.is_household_member(household_id))
  and exists (
    select 1 from public.documents document
    where document.id = subscription_documents.document_id
      and document.household_id = subscription_documents.household_id
      and (document.visibility = 'household' or document.owner_user_id = (select auth.uid()))
  )
);

create or replace function public.update_document_archive_metadata(
  p_document_id uuid,
  p_household_id uuid,
  p_title text,
  p_kind text,
  p_visibility text,
  p_folder_id uuid,
  p_document_date date,
  p_expires_on date,
  p_notes text,
  p_tag_names text[],
  p_transaction_ids uuid[],
  p_subscription_ids uuid[],
  p_task_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_household_member(p_household_id) then
    raise exception 'Document not found or not editable';
  end if;
  perform 1 from public.documents
  where id = p_document_id and household_id = p_household_id
    and (created_by = (select auth.uid()) or private.is_household_owner(p_household_id))
  for update;
  if not found then
    raise exception 'Document not found or not editable';
  end if;
  if coalesce(cardinality(p_tag_names), 0) > 12 then
    raise exception 'At most 12 tags are allowed';
  end if;
  update public.documents
  set title = btrim(p_title),
      kind = p_kind,
      visibility = p_visibility,
      folder_id = p_folder_id,
      document_date = p_document_date,
      expires_on = p_expires_on,
      notes = nullif(btrim(p_notes), '')
  where id = p_document_id and household_id = p_household_id;

  if not found then
    raise exception 'Document not found or not editable';
  end if;

  insert into public.document_tags (household_id, name, created_by)
  select p_household_id, cleaned.name, (select auth.uid())
  from (
    select distinct btrim(value) as name
    from unnest(coalesce(p_tag_names, '{}'::text[])) as value
    where char_length(btrim(value)) between 1 and 40
  ) as cleaned
  on conflict (household_id, normalized_name) do nothing;

  delete from public.document_tag_links
  where document_id = p_document_id and household_id = p_household_id;

  insert into public.document_tag_links (document_id, tag_id, household_id, created_by)
  select p_document_id, tag.id, p_household_id, (select auth.uid())
  from public.document_tags tag
  join (
    select distinct lower(btrim(value)) as normalized_name
    from unnest(coalesce(p_tag_names, '{}'::text[])) as value
    where char_length(btrim(value)) between 1 and 40
  ) requested on requested.normalized_name = tag.normalized_name
  where tag.household_id = p_household_id;

  delete from public.transaction_documents
  where document_id = p_document_id and household_id = p_household_id;

  insert into public.transaction_documents (household_id, transaction_id, document_id, created_by)
  select p_household_id, requested.transaction_id, p_document_id, (select auth.uid())
  from unnest(coalesce(p_transaction_ids, '{}'::uuid[])) as requested(transaction_id);

  delete from public.subscription_documents
  where document_id = p_document_id and household_id = p_household_id;

  insert into public.subscription_documents (household_id, subscription_id, document_id, created_by)
  select p_household_id, requested.subscription_id, p_document_id, (select auth.uid())
  from unnest(coalesce(p_subscription_ids, '{}'::uuid[])) as requested(subscription_id);

  delete from public.task_documents
  where document_id = p_document_id and household_id = p_household_id;

  insert into public.task_documents (household_id, task_id, document_id, created_by)
  select p_household_id, requested.task_id, p_document_id, (select auth.uid())
  from unnest(coalesce(p_task_ids, '{}'::uuid[])) as requested(task_id);
end;
$$;

revoke all on function public.update_document_archive_metadata(
  uuid, uuid, text, text, text, uuid, date, date, text, text[], uuid[], uuid[], uuid[]
) from public, anon;
grant execute on function public.update_document_archive_metadata(
  uuid, uuid, text, text, text, uuid, date, date, text, text[], uuid[], uuid[], uuid[]
) to authenticated;
