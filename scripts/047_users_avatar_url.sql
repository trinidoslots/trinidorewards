-- The Kick profile picture, on the user row.
--
-- It was only ever kept in a cookie. Nothing reading the database — the admin
-- user page, the winner dialog — had a picture to show, and the login callback
-- now writes it, so the column has to exist.
--
-- No migration ever created the users table (it was made in the dashboard), so
-- there is no guarantee about what is on it. This is written to be safe either
-- way.
--
-- Safe to run more than once.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- --- verify ------------------------------------------------------------------
-- Expect one row back.
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url';
