-- Admin access by Kick account.
--
-- The admin panel used to be an email + password login. It is now "sign in
-- with Kick", and a Kick account gets into the panel when it is tagged here.
--
-- A table of its own rather than a column on users, on purpose: users is
-- written by the site in many places and its policies predate the migrations
-- in this folder. A flag there would be only as safe as the loosest policy on
-- that table. This one has RLS on and no policies at all, so nothing but the
-- service role (the server) can read or change who is an admin.

CREATE TABLE IF NOT EXISTS admin_accounts (
  kick_id     TEXT PRIMARY KEY,
  -- For reading the table by eye; kick_id is what is checked.
  username    TEXT,
  added_by    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
-- Deliberately no CREATE POLICY: the anon and authenticated roles get nothing.

-- --- bootstrap ------------------------------------------------------------------
--
-- Tags your own account, so you are not locked out of the panel the moment
-- this ships. It needs you to have signed in on the site with Kick at least
-- once (that is what creates your row in users). Change the name if yours is
-- different; add more names to the list for more admins. After this, admins
-- are tagged and untagged from /admin/users.

INSERT INTO admin_accounts (kick_id, username, added_by)
SELECT kick_id, username, 'scripts/070'
  FROM users
 WHERE lower(username) IN ('trinidoslots')
   AND kick_id IS NOT NULL
ON CONFLICT (kick_id) DO NOTHING;

-- --- verify -----------------------------------------------------------------------

SELECT
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_accounts')   AS rls_on,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'admin_accounts')    AS policies_should_be_0,
  (SELECT string_agg(username, ', ') FROM admin_accounts)                   AS admins;
