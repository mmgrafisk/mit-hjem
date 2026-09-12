begin;

-- The cron secret remains in Vault. The Edge Function can validate an incoming
-- value through its service-role client without duplicating the secret in its
-- own environment or exposing it through the Data API.
create or replace function public.verify_calendar_reminder_cron_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate is not null and exists (
    select 1
    from vault.decrypted_secrets
    where name = 'calendar_reminder_cron_secret'
      and decrypted_secret = candidate
  );
$$;

revoke all on function public.verify_calendar_reminder_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_calendar_reminder_cron_secret(text) to service_role;

commit;
