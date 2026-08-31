
create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.household_members hm
      where hm.household_id = target_household_id
        and hm.user_id = (select auth.uid())
    );
$$;

create or replace function private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.household_members hm
      where hm.household_id = target_household_id
        and hm.user_id = (select auth.uid())
        and hm.role = 'owner'
    );
$$;

create or replace function private.can_manage_finances(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.household_members hm
      where hm.household_id = target_household_id
        and hm.user_id = (select auth.uid())
        and hm.role in ('owner', 'adult')
    );
$$;

create or replace function private.shares_household_with(target_user_id uuid)
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

create or replace function private.try_uuid(value text)
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

revoke all on function private.is_household_member(uuid) from public, anon;
revoke all on function private.is_household_owner(uuid) from public, anon;
revoke all on function private.can_manage_finances(uuid) from public, anon;
revoke all on function private.shares_household_with(uuid) from public, anon;
revoke all on function private.try_uuid(text) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;
grant execute on function private.can_manage_finances(uuid) to authenticated;
grant execute on function private.shares_household_with(uuid) to authenticated;
grant execute on function private.try_uuid(text) to authenticated;

alter policy profiles_select on public.profiles
using (id = (select auth.uid()) or (select private.shares_household_with(id)));

alter policy households_select on public.households
using ((select private.is_household_member(id)) or created_by = (select auth.uid()));
alter policy households_update on public.households
using ((select private.is_household_owner(id)) or created_by = (select auth.uid()))
with check ((select private.is_household_owner(id)) or created_by = (select auth.uid()));
alter policy households_delete on public.households
using ((select private.is_household_owner(id)));

alter policy household_members_select on public.household_members
using ((select private.is_household_member(household_id)));
alter policy household_members_insert on public.household_members
with check (
  (select auth.uid()) is not null
  and (
    (select private.is_household_owner(household_id))
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
alter policy household_members_update on public.household_members
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));
alter policy household_members_delete on public.household_members
using ((select private.is_household_owner(household_id)));

alter policy budget_categories_select on public.budget_categories
using ((select private.can_manage_finances(household_id)));
alter policy budget_categories_insert on public.budget_categories
with check ((select private.can_manage_finances(household_id)) and created_by = (select auth.uid()));
alter policy budget_categories_update on public.budget_categories
using ((select private.can_manage_finances(household_id)))
with check ((select private.can_manage_finances(household_id)));
alter policy budget_categories_delete on public.budget_categories
using ((select private.can_manage_finances(household_id)));

alter policy budgets_select on public.budgets
using ((select private.can_manage_finances(household_id)));
alter policy budgets_insert on public.budgets
with check ((select private.can_manage_finances(household_id)) and created_by = (select auth.uid()));
alter policy budgets_update on public.budgets
using ((select private.can_manage_finances(household_id)))
with check ((select private.can_manage_finances(household_id)));
alter policy budgets_delete on public.budgets
using ((select private.can_manage_finances(household_id)));

alter policy budget_items_select on public.budget_items
using ((select private.can_manage_finances(household_id)));
alter policy budget_items_insert on public.budget_items
with check ((select private.can_manage_finances(household_id)));
alter policy budget_items_update on public.budget_items
using ((select private.can_manage_finances(household_id)))
with check ((select private.can_manage_finances(household_id)));
alter policy budget_items_delete on public.budget_items
using ((select private.can_manage_finances(household_id)));

alter policy transactions_select on public.transactions
using ((select private.can_manage_finances(household_id)));
alter policy transactions_insert on public.transactions
with check ((select private.can_manage_finances(household_id)) and created_by = (select auth.uid()));
alter policy transactions_update on public.transactions
using ((select private.can_manage_finances(household_id)))
with check ((select private.can_manage_finances(household_id)));
alter policy transactions_delete on public.transactions
using ((select private.can_manage_finances(household_id)));

alter policy tasks_select on public.tasks
using ((select private.is_household_member(household_id)));
alter policy tasks_insert on public.tasks
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
alter policy tasks_update on public.tasks
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
alter policy tasks_delete on public.tasks
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

alter policy documents_select on public.documents
using (
  (select private.is_household_member(household_id))
  and (visibility = 'household' or owner_user_id = (select auth.uid()))
);
alter policy documents_insert on public.documents
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
  and (visibility = 'household' or owner_user_id = (select auth.uid()))
);
alter policy documents_update on public.documents
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)))
with check (
  (select private.is_household_member(household_id))
  and (visibility = 'household' or owner_user_id = (select auth.uid()) or (select private.is_household_owner(household_id)))
);
alter policy documents_delete on public.documents
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

alter policy shopping_items_select on public.shopping_items
using ((select private.is_household_member(household_id)));
alter policy shopping_items_insert on public.shopping_items
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
alter policy shopping_items_update on public.shopping_items
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
alter policy shopping_items_delete on public.shopping_items
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

alter policy meal_plans_select on public.meal_plans
using ((select private.is_household_member(household_id)));
alter policy meal_plans_insert on public.meal_plans
with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
alter policy meal_plans_update on public.meal_plans
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
alter policy meal_plans_delete on public.meal_plans
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

alter policy meal_plan_items_select on public.meal_plan_items
using ((select private.is_household_member(household_id)));
alter policy meal_plan_items_insert on public.meal_plan_items
with check ((select private.is_household_member(household_id)));
alter policy meal_plan_items_update on public.meal_plan_items
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
alter policy meal_plan_items_delete on public.meal_plan_items
using ((select private.is_household_member(household_id)));

alter policy household_documents_select on storage.objects
using (
  bucket_id = 'household-documents'
  and (select private.is_household_member(private.try_uuid(split_part(name, '/', 1))))
);
alter policy household_documents_insert on storage.objects
with check (
  bucket_id = 'household-documents'
  and (select private.is_household_member(private.try_uuid(split_part(name, '/', 1))))
);
alter policy household_documents_update on storage.objects
using (
  bucket_id = 'household-documents'
  and (
    owner_id = (select auth.uid())::text
    or (select private.is_household_owner(private.try_uuid(split_part(name, '/', 1))))
  )
)
with check (
  bucket_id = 'household-documents'
  and (select private.is_household_member(private.try_uuid(split_part(name, '/', 1))))
);
alter policy household_documents_delete on storage.objects
using (
  bucket_id = 'household-documents'
  and (
    owner_id = (select auth.uid())::text
    or (select private.is_household_owner(private.try_uuid(split_part(name, '/', 1))))
  )
);

drop function public.is_household_member(uuid);
drop function public.is_household_owner(uuid);
drop function public.can_manage_finances(uuid);
drop function public.shares_household_with(uuid);
drop function public.try_uuid(text);

create index households_created_by_idx on public.households(created_by);
create index budget_categories_created_by_idx on public.budget_categories(created_by);
create index budgets_created_by_idx on public.budgets(created_by);
create index budget_items_budget_household_fk_idx on public.budget_items(budget_id, household_id);
create index budget_items_category_household_fk_idx on public.budget_items(category_id, household_id);
create index transactions_category_household_fk_idx on public.transactions(category_id, household_id);
create index meal_plan_items_plan_household_fk_idx on public.meal_plan_items(meal_plan_id, household_id);

