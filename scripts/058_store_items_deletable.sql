-- Let a store item be deleted once somebody has bought it.
--
-- redemptions.item_id points at store_items with the default ON DELETE
-- behaviour, which is RESTRICT. So the moment an item had ever been bought,
-- deleting it failed with:
--
--   update or delete on table "store_items" violates foreign key constraint
--   "redemptions_item_id_fkey" on table "redemptions"
--
-- Nothing is actually lost by letting it go: a redemption already copies
-- item_name and cost at the time of purchase, precisely so the record survives
-- the item changing or disappearing. Only the link back to a row that no longer
-- exists goes, so the reference is nulled rather than the history deleted.
--
-- Safe to run more than once.

-- SET NULL needs the column to accept one. It may already be nullable.
ALTER TABLE redemptions ALTER COLUMN item_id DROP NOT NULL;

DO $fk$
DECLARE
  v_name TEXT;
BEGIN
  -- Found by what it does rather than by name: the constraint is called
  -- redemptions_item_id_fkey on this database, but that is Postgres's default
  -- naming and not something to rely on.
  SELECT con.conname INTO v_name
    FROM pg_constraint con
    JOIN pg_class child  ON child.oid  = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
   WHERE con.contype = 'f'
     AND child.relname  = 'redemptions'
     AND parent.relname = 'store_items'
     AND att.attname    = 'item_id'
   LIMIT 1;

  IF v_name IS NULL THEN
    RAISE NOTICE 'No redemptions -> store_items foreign key found; nothing to change.';
    RETURN;
  END IF;

  -- Already correct: confdeltype 'n' is ON DELETE SET NULL.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = v_name AND confdeltype = 'n') THEN
    RAISE NOTICE 'Foreign key % already uses ON DELETE SET NULL.', v_name;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE redemptions DROP CONSTRAINT %I', v_name);
  EXECUTE format(
    'ALTER TABLE redemptions ADD CONSTRAINT %I FOREIGN KEY (item_id) '
    'REFERENCES store_items(id) ON DELETE SET NULL', v_name);

  RAISE NOTICE 'Foreign key % now uses ON DELETE SET NULL.', v_name;
END
$fk$;

-- --- verify -----------------------------------------------------------------
-- Expect on_delete = 'n' (SET NULL) and item_id_nullable = 'YES'.
SELECT
  con.conname                                                      AS constraint_name,
  con.confdeltype                                                  AS on_delete,
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'redemptions' AND column_name = 'item_id')  AS item_id_nullable
FROM pg_constraint con
JOIN pg_class child  ON child.oid  = con.conrelid
JOIN pg_class parent ON parent.oid = con.confrelid
WHERE con.contype = 'f'
  AND child.relname = 'redemptions'
  AND parent.relname = 'store_items';
