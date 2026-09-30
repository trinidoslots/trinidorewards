-- 082: bonus_hunt_kpis reads as the person asking, not as its owner.
--
-- Supabase lint "Security Definer View". A Postgres view reads its tables with
-- the rights of the role that created it (postgres), so everyone reading
-- bonus_hunt_kpis bypassed the row level security on bonus_hunts and
-- hunt_bonuses. Harmless today, since both tables are public-read (072) and the
-- view holds only hunt statistics, but it would keep leaking if either table
-- were ever made private.
--
-- security_invoker = true (Postgres 15+) makes the view apply the caller's
-- rights and the tables' policies. The public keeps reading it through the
-- "public read" policies 072 put on both tables, so the hunt pages, the
-- predictions and the OBS overlays are unaffected.
--
-- Also repeats 081's revoke for this view, in case 081 has not been run.
-- Safe to run more than once.

ALTER VIEW public.bonus_hunt_kpis SET (security_invoker = true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bonus_hunt_kpis FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bonus_hunt_kpis TO anon, authenticated;

-- Check 1: expected security_invoker=true in the options.
select c.relname, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'bonus_hunt_kpis';

-- Check 2: read it as the public key would. Expected the same number of hunts
-- as the Bonus Hunt history shows; 0 would mean the tables' public-read
-- policies are missing, and the public pages would show no hunt.
set role anon;
select count(*) as hunts_visible_to_public from public.bonus_hunt_kpis;
reset role;
