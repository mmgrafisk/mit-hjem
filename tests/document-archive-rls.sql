-- Run against the migrated database. All fixtures and mutations roll back.
begin;
create temporary table archive_qa_ids (key text primary key, id uuid not null) on commit drop;
insert into archive_qa_ids select key, gen_random_uuid() from unnest(array['owner','member','outsider','house','other_house','shared','private','other_doc','transaction','task','folder','other_folder']) as k(key);
grant select on archive_qa_ids to authenticated, anon;
insert into auth.users(id, email, aud, role)
select id, id::text || '@archive-qa.invalid', 'authenticated', 'authenticated' from archive_qa_ids where key in ('owner','member','outsider');
insert into public.households(id, name, created_by)
values ((select id from archive_qa_ids where key='house'), 'Archive QA', (select id from archive_qa_ids where key='owner')),
       ((select id from archive_qa_ids where key='other_house'), 'Other archive QA', (select id from archive_qa_ids where key='outsider'));
insert into public.household_members(household_id,user_id,role)
values ((select id from archive_qa_ids where key='house'),(select id from archive_qa_ids where key='owner'),'owner'),
       ((select id from archive_qa_ids where key='house'),(select id from archive_qa_ids where key='member'),'member'),
       ((select id from archive_qa_ids where key='other_house'),(select id from archive_qa_ids where key='outsider'),'owner');
insert into public.document_folders(id,household_id,name,created_by)
values ((select id from archive_qa_ids where key='folder'),(select id from archive_qa_ids where key='house'),'Bolig',(select id from archive_qa_ids where key='owner')),
       ((select id from archive_qa_ids where key='other_folder'),(select id from archive_qa_ids where key='other_house'),'Other',(select id from archive_qa_ids where key='outsider'));
insert into public.documents(id,household_id,title,visibility,owner_user_id,created_by,storage_path,mime_type,size_bytes)
select d.id, h.id, 'Archive QA ' || d.key, case when d.key='private' then 'private' else 'household' end,
       u.id,u.id,'archive-qa/' || d.id::text,'application/pdf',100
from archive_qa_ids d
join archive_qa_ids h on h.key=case when d.key='other_doc' then 'other_house' else 'house' end
join archive_qa_ids u on u.key=case when d.key='other_doc' then 'outsider' else 'owner' end
where d.key in ('shared','private','other_doc');
insert into public.transactions(id,household_id,amount,direction,merchant,created_by)
values ((select id from archive_qa_ids where key='transaction'),(select id from archive_qa_ids where key='house'),100,'expense','Archive QA',(select id from archive_qa_ids where key='owner'));
insert into public.tasks(id,household_id,title,created_by)
values ((select id from archive_qa_ids where key='task'),(select id from archive_qa_ids where key='house'),'Archive QA',(select id from archive_qa_ids where key='owner'));
select set_config('request.jwt.claim.sub',(select id::text from archive_qa_ids where key='owner'),true);
set local role authenticated;
do $$
declare h uuid := (select id from archive_qa_ids where key='house');
        d uuid := (select id from archive_qa_ids where key='shared');
        p uuid := (select id from archive_qa_ids where key='private');
begin
  if (select count(*) from public.documents where id in (select id from archive_qa_ids where key in ('shared','private','other_doc'))) <> 2 then raise exception 'Owner document visibility failed'; end if;
  perform public.update_document_archive_metadata(d,h,'Saved title','invoice','household',(select id from archive_qa_ids where key='folder'),'2026-09-01','2026-10-01','Note',array['Bolig','bolig'],array[(select id from archive_qa_ids where key='transaction')],'{}',array[(select id from archive_qa_ids where key='task')]);
  if (select count(*) from public.document_tag_links where document_id=d) <> 1 then raise exception 'Tag deduplication failed'; end if;
  if (select count(*) from public.task_documents where document_id=d) <> 1 then raise exception 'Task relation failed'; end if;
  if not exists(select 1 from public.documents where id=d and title='Saved title' and notes='Note') then raise exception 'Metadata save failed'; end if;
  begin
    perform public.update_document_archive_metadata(d,h,'Must roll back','invoice','household',(select id from archive_qa_ids where key='other_folder'),null,null,null,'{}','{}','{}','{}');
    raise exception 'Cross-household folder was accepted';
  exception when foreign_key_violation then null;
  end;
  if not exists(select 1 from public.documents where id=d and title='Saved title') then raise exception 'Failed save was not atomic'; end if;
  if (select count(*) from public.task_documents where document_id=d) <> 1 then raise exception 'Failed save lost relations'; end if;
  perform public.update_document_archive_metadata(p,h,'Private QA','other','private',null,null,null,null,array['Private tag'],array[(select id from archive_qa_ids where key='transaction')],'{}',array[(select id from archive_qa_ids where key='task')]);
  update public.documents set archived_at=now() where id=d;
  if not exists(select 1 from public.documents where id=d and archived_at is not null) then raise exception 'Archive failed'; end if;
  update public.documents set archived_at=null where id=d;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from archive_qa_ids where key='member'),true);
set local role authenticated;
do $$
declare h uuid := (select id from archive_qa_ids where key='house');
        p uuid := (select id from archive_qa_ids where key='private');
        d uuid := (select id from archive_qa_ids where key='shared');
begin
  if (select count(*) from public.documents where id in (select id from archive_qa_ids where key in ('shared','private','other_doc'))) <> 1 then raise exception 'Member visibility failed'; end if;
  if exists(select 1 from public.document_tag_links where document_id=p) then raise exception 'Private tag links leaked'; end if;
  if exists(select 1 from public.transaction_documents where document_id=p) then raise exception 'Private transaction links leaked'; end if;
  if exists(select 1 from public.task_documents where document_id=p) then raise exception 'Private task links leaked'; end if;
  begin
    perform public.update_document_archive_metadata(d,h,'Forbidden','other','household',null,null,null,null,'{}','{}','{}','{}');
    raise exception 'Non-creator edited document';
  exception when raise_exception then
    if sqlerrm <> 'Document not found or not editable' then raise; end if;
  end;
  begin
    insert into public.task_documents(task_id,document_id,household_id,created_by)
    values ((select id from archive_qa_ids where key='task'),p,h,auth.uid());
    raise exception 'Private task relation accepted';
  exception when insufficient_privilege then null;
  end;
  insert into public.document_folders(household_id,name,created_by) values(h,'Member folder',auth.uid());
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from archive_qa_ids where key='outsider'),true);
set local role authenticated;
do $$
declare h uuid := (select id from archive_qa_ids where key='house');
begin
  if exists(select 1 from public.documents where household_id=h) then raise exception 'Cross-household documents leaked'; end if;
  if exists(select 1 from public.document_folders where household_id=h) then raise exception 'Cross-household folders leaked'; end if;
  if exists(select 1 from public.document_tag_links where household_id=h) then raise exception 'Cross-household tags leaked'; end if;
  if exists(select 1 from public.task_documents where household_id=h) then raise exception 'Cross-household task links leaked'; end if;
  begin
    perform public.update_document_archive_metadata((select id from archive_qa_ids where key='shared'),h,'Forbidden','other','household',null,null,null,null,'{}','{}','{}','{}');
    raise exception 'Cross-household write accepted';
  exception when raise_exception then
    if sqlerrm <> 'Document not found or not editable' then raise; end if;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  if has_function_privilege(current_user,'public.update_document_archive_metadata(uuid,uuid,text,text,text,uuid,date,date,text,text[],uuid[],uuid[],uuid[])','EXECUTE') then raise exception 'Anonymous RPC access'; end if;
  begin
    perform 1 from public.document_folders;
    if found then raise exception 'Anonymous data access'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'PASS: owner/member/outsider/anon, metadata, relations, privacy, archive/restore and atomic rollback; fixtures rolled back' as result;
