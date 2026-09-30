-- 080: check the lockdown. Read-only: it changes nothing.
--
-- Paste into the Supabase SQL editor and run. Each query should come back as
-- described; anything else is a table or function the public (anon) key can
-- reach and should not.

-- 1) Tables without row level security, or private tables with a policy that
--    lets the public key in.
--    Expected: no rows.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       string_agg(distinct p.policyname, ', ')
         filter (where 'anon' = any(p.roles) or 'public' = any(p.roles)) as public_policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
 where n.nspname = 'public'
   and c.relkind = 'r'
 group by c.relname, c.relrowsecurity
having not c.relrowsecurity
    or (c.relname in ('users', 'redemptions', 'redemption_payouts', 'user_payment_methods',
                      'user_site_usernames', 'admin_accounts', 'chat_activity', 'points_grants',
                      'points_grant_entries', 'advent_calendar_claims', 'discord_state',
                      'promo_code_redemptions')
        and count(p.policyname) filter (where 'anon' = any(p.roles) or 'public' = any(p.roles)) > 0)
 order by 1;

-- 2) Tables the public key could write to, whatever the policies say.
--    Expected: no rows.
select table_name, string_agg(privilege_type, ', ') as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee = 'anon'
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
 group by table_name
 order by 1;

-- 3) Database functions the public key may run.
--    Expected: only is_admin and is_moderator.
select p.proname as function_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1;
