begin;

-- A task can only be assigned to somebody who belongs to the same household.
create or replace function private.validate_task_assignee_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1
    from public.household_members membership
    where membership.household_id = new.household_id
      and membership.user_id = new.assigned_to
  ) then
    raise exception 'Task assignee must belong to the household';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_validate_assignee_household on public.tasks;
create trigger tasks_validate_assignee_household
before insert or update of household_id, assigned_to on public.tasks
for each row execute function private.validate_task_assignee_household();

revoke all on function private.validate_task_assignee_household() from public, anon, authenticated;

-- E-mail reminders stay opt-in until the Resend channel is enabled and tested.
alter table public.notification_preferences alter column email_enabled set default false;
update public.notification_preferences set email_enabled = false where email_enabled = true;

commit;
