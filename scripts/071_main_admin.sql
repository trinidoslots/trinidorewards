-- Admin tags on the on-site account, and the main admin.
--
-- Safe to run more than once, and whether or not 070 has been run.
--
-- 070 keyed a tag on the Kick id. From here it is keyed on the on-site
-- account (users.id) and keeps a copy of that account's Kick id. Both have to
-- match the login for the panel to open (lib/admin-auth.ts, and is_admin() in
-- 072). The copy is what stops a tag following a users row: if someone
-- managed to point an admin's users row at their own Kick account, the tag
-- would still name the admin's Kick id and would not match.
--
-- The main admin (is_owner) cannot be untagged from the panel by anyone.

CREATE TABLE IF NOT EXISTS admin_accounts (
  user_id     UUID,
  kick_id     TEXT,
  username    TEXT,
  added_by    TEXT,
  is_owner    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- Tags from 070 carry only a Kick id: tie each to its on-site account.
UPDATE admin_accounts a
   SET user_id = u.id
  FROM users u
 WHERE a.user_id IS NULL
   AND u.kick_id::text = a.kick_id;

-- A tag that cannot be tied to an on-site account can no longer be checked.
DELETE FROM admin_accounts WHERE user_id IS NULL OR kick_id IS NULL;

-- Re-key on the on-site account.
DO $key$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'admin_accounts'::regclass
       AND contype = 'p'
       AND pg_get_constraintdef(oid) = 'PRIMARY KEY (user_id)'
  ) THEN
    ALTER TABLE admin_accounts DROP CONSTRAINT IF EXISTS admin_accounts_pkey;
    ALTER TABLE admin_accounts ADD CONSTRAINT admin_accounts_pkey PRIMARY KEY (user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_accounts_user_fk') THEN
    ALTER TABLE admin_accounts
      ADD CONSTRAINT admin_accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$key$;

ALTER TABLE admin_accounts ALTER COLUMN kick_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_accounts_kick_id_key ON admin_accounts (kick_id);

-- Nothing but the server reads or writes this table.
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
DO $pol$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_accounts' LOOP
    EXECUTE format('DROP POLICY %I ON admin_accounts', p.policyname);
  END LOOP;
END
$pol$;
REVOKE ALL ON admin_accounts FROM anon, authenticated;

-- --- the main admin ---------------------------------------------------------------
--
-- On-site account 1ca240ec-6c94-49c0-9718-536a499e59a2 with Kick account
-- 82318740. Only written if that users row really has that Kick id.

INSERT INTO admin_accounts (user_id, kick_id, username, added_by, is_owner)
SELECT u.id, u.kick_id::text, u.username, 'scripts/071', true
  FROM users u
 WHERE u.id = '1ca240ec-6c94-49c0-9718-536a499e59a2'
   AND u.kick_id::text = '82318740'
ON CONFLICT (user_id) DO UPDATE
   SET kick_id = EXCLUDED.kick_id,
       is_owner = true;

-- --- verify -------------------------------------------------------------------------
--
-- The main admin's row must be listed with is_owner = true. If it is missing,
-- check users_kick_id below: that on-site account does not have Kick id
-- 82318740 (or has never signed in with Kick).

SELECT a.user_id, a.kick_id, a.username, a.is_owner,
       (SELECT kick_id FROM users WHERE id = '1ca240ec-6c94-49c0-9718-536a499e59a2') AS users_kick_id
  FROM admin_accounts a
 ORDER BY a.is_owner DESC, a.created_at;
