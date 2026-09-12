begin;

-- pg_cron executes the helper as its database owner. Browser roles do not
-- need direct access to the Vault-backed scheduler entrypoint.
revoke all on function private.invoke_calendar_reminders() from public, anon, authenticated;

commit;
