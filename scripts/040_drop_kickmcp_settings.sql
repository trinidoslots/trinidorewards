-- Remove the KickMCP integration.
--
-- Nothing in the app consumed these any more: the service that used them was
-- deleted earlier, leaving only a settings form that wrote credentials nothing
-- read back. The admin form is gone too (app/admin/settings/page.tsx).
--
-- This also closes a live exposure. The settings table is readable with the
-- public anon key, so kickmcp_client_secret was fetchable by anyone; deleting
-- the row is the only way to stop that short of tightening RLS. Rotate the
-- secret on Kick's side as well — deleting it here does not invalidate it.
--
-- Safe to run more than once.
DELETE FROM settings
 WHERE key IN ('kickmcp_client_id', 'kickmcp_client_secret', 'kickmcp_channel_monitoring');

-- --- verify: should return no rows ------------------------------------------
SELECT key FROM settings WHERE key LIKE 'kickmcp%';
