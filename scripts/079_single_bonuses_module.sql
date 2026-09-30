-- 079: one Bonuses module instead of "Claim Bonuses" and "Active Bonuses".
--
-- The nav had two links, /bonuses/claim and /bonuses/active, and neither page
-- ever existed; the site's one bonuses page is /bonuses. This folds the two
-- rows into a single 'bonuses' row: on if either was on, keeping Active's nav
-- category.
--
-- Optional: the code already treats both old names as 'bonuses'. Without this
-- the Modules page just shows two switches for the one page, and the page only
-- closes when both are off.

begin;

insert into public.modules (module_name, display_name, description, category, is_enabled)
select
  'bonuses',
  'Bonuses',
  'Shows /bonuses in the navigation',
  coalesce(max(category) filter (where module_name = 'active_bonuses'), max(category), 'bonuses'),
  bool_or(coalesce(is_enabled, false))
from public.modules
where module_name in ('claim_bonuses', 'active_bonuses')
having count(*) > 0
on conflict (module_name) do nothing;

delete from public.modules where module_name in ('claim_bonuses', 'active_bonuses');

commit;

select module_name, display_name, category, is_enabled from public.modules order by module_name;
