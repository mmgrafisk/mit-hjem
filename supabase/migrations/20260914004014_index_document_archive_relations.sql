-- Cover composite foreign keys used by document relations and folder lookups.
create index document_tag_links_document_household_fk_idx
  on public.document_tag_links(document_id, household_id);
create index document_tag_links_tag_household_fk_idx
  on public.document_tag_links(tag_id, household_id);
create index documents_folder_household_fk_idx
  on public.documents(folder_id, household_id);
create index task_documents_document_household_fk_idx
  on public.task_documents(document_id, household_id);
create index task_documents_task_household_fk_idx
  on public.task_documents(task_id, household_id);
