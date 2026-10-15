-- Step 1 of 2 for splitting the old "administracion" role in two:
-- "administrador" (user management — exactly what "administracion" could
-- do until now) keeps that capability, while "administracion" (renamed in
-- the UI to the accounting-focused profile) keeps only the read-only
-- portfolio view and loses access to user management. This has to be its
-- own migration, run and committed on its own: Postgres refuses to use a
-- brand-new enum value in the same transaction that added it. See the
-- next migration for the actual policy changes.
alter type public.app_role add value 'administrador';
