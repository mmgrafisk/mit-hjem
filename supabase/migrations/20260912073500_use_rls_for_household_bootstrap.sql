begin;

-- The bootstrap function only performs operations that the signed-in user can
-- already perform through RLS. Keep the advisory lock for concurrency, while
-- running with the caller's privileges so no privileged API function is exposed.
alter function public.ensure_current_user_household(text) security invoker;

revoke all on function public.ensure_current_user_household(text) from public, anon;
grant execute on function public.ensure_current_user_household(text) to authenticated;

commit;
