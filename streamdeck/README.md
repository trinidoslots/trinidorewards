# Stream Deck buttons

Points to everyone who was in chat recently, from a button, so a multi-action
can fire the animation in OBS and the payout in the same press.

## What the press actually does

The button runs a `.bat`, which runs `grant-points.ps1`, which POSTs to
`/api/control/points/grant`. The route calls the same database function the
admin panel's own button calls (`grant_points_to_active_chatters`, scripts/056),
so the window is recomputed in the database and the balances are incremented in
SQL. The script never names recipients and could not if it tried — it only
sends "how much" and "how far back".

The grant writes a row to `points_events`, which the OBS stream feed is
subscribed to. If you want the overlay to react to the payout, it already can;
the OBS animation in the multi-action is only needed for something extra.

## Setup

1. Put a long random value in `CONTROL_API_KEY` in Vercel (Production), and
   redeploy. Without it the route answers 401 to everything — including to
   someone who finds the URL.
2. Copy `config.ps1.example` to `config.ps1` and paste the same value in.
   `config.ps1` is gitignored. It is a live credential: anyone holding it can
   hand out points.
3. Copy `grant-500.bat.example` to `grant-500.bat` (drop `.example`) and set the
   numbers you want. One file per button.
4. In the Stream Deck app: **System → Open**, and pick the `.bat`. Put it in a
   multi-action next to your OBS action.

## Things worth knowing

- **Pressing twice pays twice.** Each press makes its own idempotency key. Only
  a retry *inside one press* reuses it, so a flaky connection cannot double-pay.
- **`-Points` is capped at 10000** by the route, well under the admin panel's
  limit. The button is behind a file on your PC rather than behind a login, so
  the ceiling is lower on purpose.
- **Nobody matched?** Almost always the chat recorder, not a quiet chat: only
  people recorded in `chat_activity` are in the window, and only those with a
  site account linked by `kick_id` are paid. `grant-log.txt` says so when it
  happens, and /admin/points shows whether the recorder is live.
- **The window is minutes, 1 to 1440.** `-Minutes 3` is the default here.
