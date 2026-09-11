begin;

create or replace function private.is_household_member_user(target_household_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is null or exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = target_user_id
  );
$$;

revoke all on function private.is_household_member_user(uuid, uuid) from public, anon;
grant execute on function private.is_household_member_user(uuid, uuid) to authenticated;

alter policy calendar_events_insert on public.calendar_events
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
  and (select private.is_household_member_user(household_id, assigned_to))
);

alter policy calendar_events_update on public.calendar_events
using ((select private.is_household_member(household_id)))
with check (
  (select private.is_household_member(household_id))
  and (select private.is_household_member_user(household_id, assigned_to))
);

-- Invitation acceptance is only callable by the server-side Edge Function.
-- The function intentionally relies on the already privileged service-role caller.
drop function if exists public.accept_household_invitation(text);

create function public.accept_household_invitation(
  target_token_hash text,
  accepting_user_id uuid,
  accepting_email text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invitation public.household_invitations%rowtype;
begin
  if accepting_user_id is null or btrim(coalesce(accepting_email, '')) = '' then
    raise exception 'Authentication required';
  end if;

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
  if lower(invitation.email) <> lower(btrim(accepting_email)) then
    raise exception 'Invitationen tilhører en anden e-mailadresse';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, accepting_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invitations
  set accepted_at = now()
  where id = invitation.id;

  return invitation.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_household_invitation(text, uuid, text) to service_role;

commit;
