-- Payout details: crypto only, and the network recorded properly.
--
-- The profile offered PayPal, bank, Skrill and "other" alongside crypto. None
-- of them are paid out, so they were four ways to save a detail nobody acts on
-- — and an email address or an IBAN sitting in a table for no reason is a
-- liability rather than a feature.
--
-- The network was the real gap. A wallet's coin lived in `label` as free text
-- ("BTC", "Bitcoin", "ETH main") and the chain was not stored at all, so a USDT
-- address had nothing saying whether it meant Tron or Ethereum. Sending to the
-- wrong network loses the money. redemption_payouts in 057 already records
-- chain for exactly this reason; this brings the saved wallets in line.
--
-- Safe to run more than once. Nothing is deleted — existing non-crypto rows are
-- left where they are and the profile simply no longer offers to add more. They
-- are listed at the bottom so you can decide about them yourself.

ALTER TABLE user_payment_methods
  -- The coin code: BTC, ETH, SOL, LTC, USDC, USDT. Its own column rather than
  -- free text in `label`, which is what the buy dialog had to guess at.
  ADD COLUMN IF NOT EXISTS crypto TEXT,
  -- The chain id from CRYPTOS in lib/payout.ts: ethereum, tron, solana, …
  -- Stored even for single-network coins, so nobody has to work out later which
  -- network BTC meant on the day.
  ADD COLUMN IF NOT EXISTS chain TEXT;

-- Carry across what the free-text label already said, where it said it plainly.
-- Anything else is left null and the owner re-picks it; guessing which network
-- "ETH main" meant is exactly the mistake this is meant to stop.
UPDATE user_payment_methods
   SET crypto = upper(trim(label))
 WHERE method = 'crypto'
   AND crypto IS NULL
   AND upper(trim(coalesce(label, ''))) IN ('BTC', 'ETH', 'SOL', 'LTC', 'USDC', 'USDT');

-- Single-network coins have only one answer, so that one is safe to fill in.
UPDATE user_payment_methods
   SET chain = CASE crypto
                 WHEN 'BTC' THEN 'bitcoin'
                 WHEN 'LTC' THEN 'litecoin'
                 WHEN 'SOL' THEN 'solana'
                 WHEN 'ETH' THEN 'ethereum'
               END
 WHERE method = 'crypto'
   AND chain IS NULL
   AND crypto IN ('BTC', 'LTC', 'SOL', 'ETH');

-- The old index was (user_id, method, value). An EVM address is the same string
-- on Ethereum, Polygon and Base, so saving it for two networks — which is a
-- real thing to want — was rejected as a duplicate.
--
-- coalesce, not the bare column: NULLs count as distinct in a unique index, so
-- rows whose chain never got filled in would not be de-duplicated at all.
DROP INDEX IF EXISTS idx_user_payment_methods_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_payment_methods_unique
  ON user_payment_methods (user_id, method, value, coalesce(chain, ''));

COMMENT ON COLUMN user_payment_methods.crypto IS
  'Coin code from CRYPTOS in lib/payout.ts. Supersedes the free-text label.';
COMMENT ON COLUMN user_payment_methods.chain IS
  'Chain id from CRYPTOS in lib/payout.ts. Sending to the wrong network loses the funds, so it is recorded even when the coin has only one.';

-- --- verify ------------------------------------------------------------------
-- Crypto rows still missing a coin or a network. Their owners are asked to pick
-- again the next time they open the profile; nothing breaks in the meantime.
SELECT count(*) AS crypto_rows_needing_attention
  FROM user_payment_methods
 WHERE method = 'crypto' AND (crypto IS NULL OR chain IS NULL);

-- Methods that can no longer be added. Left in place deliberately — deleting
-- someone's saved details is your call, not a migration's.
SELECT method, count(*) AS rows
  FROM user_payment_methods
 WHERE method <> 'crypto'
 GROUP BY method
 ORDER BY method;
