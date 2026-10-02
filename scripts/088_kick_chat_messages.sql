-- Kick chat, as the Kick bot hears it.
--
-- Kick sends every chat message in the channel to /api/kick/webhook
-- (chat.message.sent). Each one is kept here for seven days: the Kick bot page
-- shows the latest, and the message id doubles as the guard against Kick
-- delivering the same message twice. Older rows are deleted by the webhook
-- itself (lib/kick-bot/chat.ts), so the table stays small.
--
-- Service role only. Chat is public on Kick, but a week of it in one place is
-- not something the anon key should be able to page through. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.kick_chat_messages (
  message_id  text PRIMARY KEY,
  kick_id     text,
  username    text NOT NULL,
  content     text NOT NULL,
  is_mod      boolean NOT NULL DEFAULT false,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kick_chat_messages_sent_at
  ON public.kick_chat_messages (sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_kick_chat_messages_sender
  ON public.kick_chat_messages (kick_id, sent_at DESC);

ALTER TABLE public.kick_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kick_chat_messages FROM anon, authenticated;

-- Verify: the table exists with RLS on.
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'kick_chat_messages';
