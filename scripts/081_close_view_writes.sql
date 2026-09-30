-- 081: the public key may read views, never write through them.
--
-- 072 locked down every table (relkind 'r'/'p') but not views, so a view
-- kept Supabase's default grants: INSERT, UPDATE, DELETE and TRUNCATE for
-- anon and authenticated. scripts/080 found one, bonus_hunt_kpis.
--
-- Why it matters: a simple view is automatically updatable, and a write
-- through it runs with the view OWNER's rights, which skips the row level
-- security on the table underneath. bonus_hunt_kpis is built from aggregates
-- and is probably not updatable, but nothing on the site writes to any view
-- (they are only read), so there is no reason to find out.
--
-- SELECT is kept: the hunt pages and OBS overlays read bonus_hunt_kpis.
-- Safe to run more than once.

DO $views$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('v', 'm')
       -- Views that belong to an extension are the extension's business.
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
       )
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM PUBLIC, anon, authenticated',
      v.relname
    );
  END LOOP;
END
$views$;

-- Check: expected no rows.
select table_name, grantee, string_agg(privilege_type, ', ') as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated', 'PUBLIC')
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
   and table_name in (
     select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm')
   )
 group by table_name, grantee
 order by 1, 2;
