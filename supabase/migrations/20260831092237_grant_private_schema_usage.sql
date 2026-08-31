-- RLS helper functions live in the private schema. Authenticated clients need
-- schema usage before Postgres can execute the individually granted helpers.
grant usage on schema private to authenticated;
