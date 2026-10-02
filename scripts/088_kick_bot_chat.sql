-- Kick chat, as the Kick bot hears it.
--
-- Kick sends every chat message in the channel to /api/kick/webhook
-- (chat.message.sent). Each one is kept here for seven days: the Kick bot page
-- shows the latest, and the message id doubles as the guard against Kick
-- delivering the same message twice. Older rows are deleted by the webhook
-- itself (lib/kick-bot/chat.ts), so the table stays small.
--
-- Not kick_chat_messages: a table by that name is already in the live database,
-- left over from the removed chat webhook (see 056, 073), with other columns.
-- It is left alone.
--
-- Service role only. Chat is public on Kick, but a week of it in one place is
-- not something the anon key should be able to page through. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.kick_bot_chat (
  message_id  text PRIMARY KEY,
  kick_id     text,
  username    text NOT NULL,
  content     text NOT NULL,
  is_mod      boolean NOT NULL DEFAULT false,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kick_bot_chat_sent_at
  ON public.kick_bot_chat (sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_kick_bot_chat_sender
  ON public.kick_bot_chat (kick_id, sent_at DESC);

ALTER TABLE public.kick_bot_chat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kick_bot_chat FROM anon, authenticated;

-- Verify: the table exists with RLS on.
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'kick_bot_chat';
