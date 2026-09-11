begin;

-- Hjemblik now uses the intentionally simple owner/member model.
update public.household_members
set role = 'member'
where role <> 'owner';

alter table public.household_members
  drop constraint if exists household_members_role_check;
alter table public.household_members
  add constraint household_members_role_check check (role in ('owner', 'member'));

create or replace function private.can_manage_finances(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.can_manage_finances(uuid) from public, anon;
grant execute on function private.can_manage_finances(uuid) to authenticated;

alter table public.meal_plan_items
  drop constraint if exists meal_plan_items_meal_plan_id_day_of_week_key;
alter table public.meal_plan_items
  add column if not exists meal_slot smallint not null default 1 check (meal_slot between 1 and 6),
  add column if not exists servings smallint not null default 2 check (servings between 1 and 50);
alter table public.meal_plan_items
  add constraint meal_plan_items_plan_day_slot_key unique (meal_plan_id, day_of_week, meal_slot);
alter table public.meal_plan_items
  add constraint meal_plan_items_id_household_key unique (id, household_id);

create table public.meal_plan_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_plan_item_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  quantity numeric(10, 2) check (quantity is null or quantity > 0),
  unit text check (unit is null or char_length(unit) <= 30),
  created_at timestamptz not null default now(),
  unique (meal_plan_item_id, name, unit),
  foreign key (meal_plan_item_id, household_id) references public.meal_plan_items(id, household_id) on delete cascade
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text,
  location text check (location is null or char_length(location) <= 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'Europe/Copenhagen' check (char_length(timezone) between 1 and 80),
  assigned_to uuid references auth.users(id) on delete set null,
  recurrence text not null default 'once' check (recurrence in ('once', 'daily', 'weekly', 'monthly', 'yearly')),
  recurrence_interval smallint not null default 1 check (recurrence_interval between 1 and 24),
  recurrence_end_on date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (recurrence_end_on is null or recurrence_end_on >= (starts_at at time zone timezone)::date),
  unique (id, household_id)
);

create table public.calendar_event_exceptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null,
  occurrence_start timestamptz not null,
  cancelled boolean not null default false,
  title text check (title is null or char_length(btrim(title)) between 1 and 180),
  starts_at timestamptz,
  ends_at timestamptz,
  description text,
  location text check (location is null or char_length(location) <= 180),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, occurrence_start),
  foreign key (event_id, household_id) references public.calendar_events(id, household_id) on delete cascade,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.calendar_event_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null,
  minutes_before integer not null default 60 check (minutes_before in (0, 15, 60, 1440)),
  channels text[] not null default array['in_app', 'email']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id),
  foreign key (event_id, household_id) references public.calendar_events(id, household_id) on delete cascade,
  check (channels <@ array['in_app', 'email']::text[] and cardinality(channels) > 0)
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.calendar_events(id) on delete cascade,
  occurrence_start timestamptz,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_id, occurrence_start)
);

create table public.calendar_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  occurrence_start timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempted_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (event_id, occurrence_start, user_id, channel)
);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (char_length(btrim(email)) between 3 and 320),
  token_hash text not null unique check (char_length(token_hash) = 64),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accepted_at is null or revoked_at is null)
);

create index calendar_events_household_start_idx on public.calendar_events(household_id, starts_at);
create index calendar_events_household_recurrence_idx on public.calendar_events(household_id, recurrence, recurrence_end_on);
create index calendar_event_exceptions_period_idx on public.calendar_event_exceptions(household_id, occurrence_start);
create index meal_plan_ingredients_item_idx on public.meal_plan_ingredients(household_id, meal_plan_item_id);
create index notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);
create index reminder_deliveries_queue_idx on public.calendar_reminder_deliveries(status, created_at);
create index household_invitations_household_idx on public.household_invitations(household_id, expires_at desc);
create unique index household_invitations_open_email_idx
  on public.household_invitations(household_id, lower(email))
  where accepted_at is null and revoked_at is null;

create trigger calendar_events_set_updated_at before update on public.calendar_events
for each row execute function private.set_updated_at();
create trigger calendar_event_exceptions_set_updated_at before update on public.calendar_event_exceptions
for each row execute function private.set_updated_at();
create trigger calendar_event_reminders_set_updated_at before update on public.calendar_event_reminders
for each row execute function private.set_updated_at();
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function private.set_updated_at();
create trigger household_invitations_set_updated_at before update on public.household_invitations
for each row execute function private.set_updated_at();

alter table public.meal_plan_ingredients enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_event_exceptions enable row level security;
alter table public.calendar_event_reminders enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.calendar_reminder_deliveries enable row level security;
alter table public.household_invitations enable row level security;

create policy meal_plan_ingredients_select on public.meal_plan_ingredients for select to authenticated
using ((select private.is_household_member(household_id)));
create policy meal_plan_ingredients_insert on public.meal_plan_ingredients for insert to authenticated
with check ((select private.is_household_member(household_id)));
create policy meal_plan_ingredients_update on public.meal_plan_ingredients for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy meal_plan_ingredients_delete on public.meal_plan_ingredients for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy calendar_events_select on public.calendar_events for select to authenticated
using ((select private.is_household_member(household_id)));
create policy calendar_events_insert on public.calendar_events for insert to authenticated
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy calendar_events_update on public.calendar_events for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy calendar_events_delete on public.calendar_events for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy calendar_event_exceptions_select on public.calendar_event_exceptions for select to authenticated
using ((select private.is_household_member(household_id)));
create policy calendar_event_exceptions_insert on public.calendar_event_exceptions for insert to authenticated
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy calendar_event_exceptions_update on public.calendar_event_exceptions for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy calendar_event_exceptions_delete on public.calendar_event_exceptions for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy calendar_event_reminders_select on public.calendar_event_reminders for select to authenticated
using ((select private.is_household_member(household_id)));
create policy calendar_event_reminders_insert on public.calendar_event_reminders for insert to authenticated
with check ((select private.is_household_member(household_id)));
create policy calendar_event_reminders_update on public.calendar_event_reminders for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy calendar_event_reminders_delete on public.calendar_event_reminders for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy notification_preferences_select on public.notification_preferences for select to authenticated
using (user_id = (select auth.uid()));
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated
with check (user_id = (select auth.uid()));
create policy notification_preferences_update on public.notification_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notifications_select on public.notifications for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_household_member(household_id)));
create policy notifications_insert on public.notifications for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_household_member(household_id)));
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
using (user_id = (select auth.uid()));

create policy reminder_deliveries_select on public.calendar_reminder_deliveries for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_household_member(household_id)));

create policy household_invitations_select on public.household_invitations for select to authenticated
using ((select private.is_household_owner(household_id)));

grant select, insert, update, delete on public.meal_plan_ingredients to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.calendar_event_exceptions to authenticated;
grant select, insert, update, delete on public.calendar_event_reminders to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select on public.calendar_reminder_deliveries to authenticated;
grant select on public.household_invitations to authenticated;

create or replace function public.accept_household_invitation(target_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.household_invitations%rowtype;
  current_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  current_email := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  select * into invitation
  from public.household_invitations
  where token_hash = target_token_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;
  if invitation.id is null then
    raise exception 'Invitationen er udløbet eller ugyldig';
  end if;
  if lower(invitation.email) <> current_email then
    raise exception 'Invitationen tilhører en anden e-mailadresse';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, (select auth.uid()), 'member')
  on conflict (household_id, user_id) do update set role = excluded.role;
  update public.household_invitations set accepted_at = now() where id = invitation.id;
  return invitation.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.accept_household_invitation(text) to authenticated;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.invoke_calendar_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint text;
  cron_secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'calendar_reminder_url' limit 1;
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'calendar_reminder_cron_secret' limit 1;
  if endpoint is null or cron_secret is null then return; end if;
  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', cron_secret),
    body := jsonb_build_object('scheduled_at', now())
  );
end;
$$;

select cron.schedule(
  'hjemblik-calendar-reminders',
  '*/5 * * * *',
  'select private.invoke_calendar_reminders();'
)
where not exists (select 1 from cron.job where jobname = 'hjemblik-calendar-reminders');

commit;
