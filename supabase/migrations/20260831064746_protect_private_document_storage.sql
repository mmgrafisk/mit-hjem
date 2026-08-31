alter policy household_documents_select on storage.objects
using (
  bucket_id = 'household-documents'
  and (select private.is_household_member(private.try_uuid(split_part(name, '/', 1))))
  and exists (
    select 1
    from public.documents d
    where d.storage_path = storage.objects.name
  )
);
