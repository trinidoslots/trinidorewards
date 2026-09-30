-- 080: check the lockdown. Read-only: it changes nothing.
--
-- The Supabase SQL editor shows only the LAST query's result when you run the
-- whole file, so this is one query that labels every finding. Expected result:
-- no rows at all. Each row names a check and what failed it:
--
--   rls off         a table without row level security
--   public read     a private table with a policy that lets the public key read
--   public write    a table the public key has write privileges on
--   public execute  a database function the public key may run, other than
--                   is_admin / is_moderator (which the policies need)
--
-- Functions that belong to an extension (pg_trgm's similarity() and friends,
-- from scripts/077) are left out: they only compare text they are given and
-- cannot read any table.

with private_tables(name) as (
  values ('users'), ('redemptions'), ('redemption_payouts'), ('user_payment_methods'),
         ('user_site_usernames'), ('admin_accounts'), ('chat_activity'), ('points_grants'),
         ('points_grant_entries'), ('advent_calendar_claims'), ('discord_state'),
         ('promo_code_redemptions')
),
tables as (
  select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
)
select 'rls off' as check_name, relname as object, null::text as detail
  from tables
 where not relrowsecurity

union all
select 'public read', p.tablename, p.policyname
  from pg_policies p
  join private_tables t on t.name = p.tablename
 where p.schemaname = 'public'
   and p.cmd in ('SELECT', 'ALL')
   and ('anon' = any(p.roles) or 'public' = any(p.roles))

union all
select 'public write', g.table_name, string_agg(g.privilege_type, ', ')
  from information_schema.role_table_grants g
 where g.table_schema = 'public'
   and g.grantee = 'anon'
   and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
 group by g.table_name

union all
select 'public execute', p.proname, pg_get_function_identity_arguments(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
   and p.proname not in ('is_admin', 'is_moderator')
   and not exists (
     select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
   )

order by 1, 2;
