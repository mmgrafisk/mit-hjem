begin;

create or replace function private.validate_calendar_event_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = new.timezone
  ) then
    raise exception 'Ugyldig tidszone';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_calendar_event_timezone() from public, anon, authenticated;

drop trigger if exists calendar_events_validate_timezone on public.calendar_events;
create trigger calendar_events_validate_timezone
before insert or update of timezone on public.calendar_events
for each row execute function private.validate_calendar_event_timezone();

do $$
begin
  if exists (
    select 1
    from public.calendar_events calendar_event
    where not exists (
      select 1
      from pg_catalog.pg_timezone_names timezone_name
      where timezone_name.name = calendar_event.timezone
    )
  ) then
    raise exception 'Eksisterende kalenderaftale har ugyldig tidszone';
  end if;
end;
$$;

commit;
