"use client"

import { useState } from "react"
import { useProfileData } from "@/lib/profile-data"
import { CreditCard, Link2, Plus, Trash2, Trophy } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { sourceMeta, winValue } from "@/lib/wins"
import { SelectMenu } from "@/components/ui/select-menu"
import { DiscordMark } from "@/components/discord-mark"
import { CRYPTOS, chainsFor, checkAddress, defaultChainFor, findChain, findCrypto, needsChain } from "@/lib/payout"

/**
 * The two "things you tell us" panels on the profile.
 *
 * Both talk to /api/profile/* rather than the browser Supabase client. Payout
 * details live behind RLS with no policy at all, and site usernames carry
 * `auth.uid() = user_id` policies that can never match a site authenticated by
 * a Kick cookie — so in both cases the route is what establishes who is asking.
 */

/**
 * Payout details are crypto and nothing else.
 *
 * PayPal, bank, Skrill and "other" were offered and none of them are ever paid
 * out, so they were four ways to save a detail nobody acts on — and an email
 * address or an IBAN sitting in a table for no reason is a liability, not a
 * feature. Rows already saved under them stay; they simply cannot be added.
 *
 * The coin and network lists are the store's, from lib/payout.ts, so a wallet
 * saved here is one the checkout can offer back.
 */

const fieldClass =
  "h-10 w-full rounded-md border border-white/[0.10] bg-black/40 px-3.5 text-[14px] text-white outline-none transition placeholder:text-white/30 hover:border-white/20 focus:border-white/30"
const selectClass = "h-10! px-3.5! text-[14px]!"

/**
 * The profile's card: the page's panel surface with a short accent rule and
 * a title, the same shape as the section headings elsewhere on the site.
 */
export function ProfileCard({
  title,
  accent = "blue",
  right,
  children,
}: {
  title: string
  accent?: Accent
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12]">
      <header className="flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-4">
        <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: ACCENTS[accent] }} />
        <h2 className="text-[15px] font-bold text-white">{title}</h2>
        {right !== undefined && <div className="ml-auto">{right}</div>}
      </header>
      {children}
    </section>
  )
}

/** A status as a small pill in its colour. */
export function StatusPill({ accent, children }: { accent: Accent; children: React.ReactNode }) {
  const color = ACCENTS[accent]
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}1a`, color }}
    >
      {children}
    </span>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor}>
        <MonoLabel className="mb-2 block text-white/45">{label}</MonoLabel>
      </label>
      {children}
    </div>
  )
}

function AddButton({ busy, children, accent }: { busy: boolean; children: React.ReactNode; accent: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-[13.5px] font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
      style={{ backgroundColor: accent }}
    >
      <Plus className="h-4 w-4" />
      {busy ? "Saving…" : children}
    </button>
  )
}

export function Empty({ icon, text, note }: { icon: React.ReactNode; text: string; note?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon}
      <p className="text-[14px] font-semibold text-white/70">{text}</p>
      {note && <p className="text-[13px] text-white/40">{note}</p>}
    </div>
  )
}

type Account = { id: string; site_name: string; username: string }

export function ConnectedAccountsPanel() {
  // On the shared profile cache (lib/profile-data.ts): no refetch on every tab switch.
  const { data, reload: load } = useProfileData<{ accounts?: Account[] }>("/api/profile/site-usernames")
  const accounts = data?.accounts ?? []
  const [site, setSite] = useState("")
  const [username, setUsername] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)


  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!site.trim() || !username.trim()) return
    setBusy(true)
    setError(null)
    const response = await fetch("/api/profile/site-usernames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_name: site, username }),
    })
    const payload = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok) {
      setError(payload?.error ?? "Could not save that username")
      return
    }
    setSite("")
    setUsername("")
    await load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/profile/site-usernames?id=${id}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Could not remove that username")
      return
    }
    await load()
  }

  return (
    <ProfileCard title="Casino accounts" accent="blue" right={<MonoLabel className="text-white/35">{accounts.length}</MonoLabel>}>
      <form onSubmit={add} className="space-y-4 border-b border-white/[0.06] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Site" htmlFor="site">
            <input
              id="site"
              value={site}
              onChange={(event) => setSite(event.target.value)}
              placeholder="Stake, Roobet…"
              className={fieldClass}
            />
          </Field>
          <Field label="Your username there" htmlFor="site-username">
            <input
              id="site-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className={fieldClass}
            />
          </Field>
        </div>
        {error && (
          <p className="text-[12px]" style={{ color: ACCENTS.red }}>
            {error}
          </p>
        )}
        <AddButton busy={busy} accent={ACCENTS.blue}>
          Add account
        </AddButton>
      </form>

      {accounts.length === 0 ? (
        <Empty icon={<Link2 className="h-7 w-7 text-white/15" />} text="No accounts linked yet" note="Add the usernames you play under, so wins can be matched to you." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{account.username}</p>
                <MonoLabel className="text-white/40">{account.site_name}</MonoLabel>
              </div>
              <button
                type="button"
                onClick={() => remove(account.id)}
                aria-label={`Remove ${account.site_name}`}
                className="shrink-0 rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  )
}

type Payment = {
  id: string
  method: string
  label: string | null
  crypto?: string | null
  chain?: string | null
  value: string
  is_primary: boolean
}

/**
 * How one saved wallet reads.
 *
 * Prefers the columns over the old free-text label: rows saved before
 * scripts/064 have only the label, and one that says "ETH main" cannot be
 * turned into a network without guessing — which is the mistake the chain
 * column exists to prevent. Those say so instead.
 */
function describeWallet(entry: Payment): { coin: string; network: string | null } {
  const coin = findCrypto(entry.crypto) ?? findCrypto(entry.label)
  if (!coin) return { coin: entry.label?.trim() || entry.method, network: null }
  const chain = findChain(coin.code, entry.chain)
  return { coin: coin.code, network: chain?.label ?? null }
}

export function PaymentMethodsPanel() {
  const { data, reload: load } = useProfileData<{ methods?: Payment[] }>("/api/profile/payment-methods")
  const methods = data?.methods ?? []
  const [crypto, setCrypto] = useState(CRYPTOS[0].code)
  const [chain, setChain] = useState(CRYPTOS[0].chains[0].id)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chains = chainsFor(crypto)
  const chainNeeded = needsChain(crypto)
  // A mismatched address is a warning, never a refusal: these formats change,
  // and refusing a valid address because this list is out of date is worse than
  // letting someone past a caution they can read.
  const addressCheck = value.trim() ? checkAddress(crypto, chain, value.trim()) : null


  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    const response = await fetch("/api/profile/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crypto, chain, value }),
    })
    const payload = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok) {
      setError(payload?.error ?? "Could not save that address")
      return
    }
    setValue("")
    setError(payload?.warning ?? null)
    await load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/profile/payment-methods?id=${id}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Could not remove that payment method")
      return
    }
    await load()
  }

  return (
    <ProfileCard title="Crypto wallets" accent="green" right={<MonoLabel className="text-white/35">{methods.length}</MonoLabel>}>
      <form onSubmit={add} className="space-y-4 border-b border-white/[0.06] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Coin" htmlFor="pm-crypto">
            <SelectMenu
              id="pm-crypto"
              className={selectClass}
              aria-label="Coin"
              value={crypto}
              onChange={(next) => {
                setCrypto(next)
                // The old chain almost certainly does not exist on the new coin.
                // defaultChainFor returns null for a multi-network coin rather
                // than picking one, so the network has to be chosen.
                setChain(defaultChainFor(next)?.id ?? "")
              }}
              options={CRYPTOS.map((entry) => ({ value: entry.code, label: `${entry.code} — ${entry.name}` }))}
            />
          </Field>

          {/* Only where there is a choice. BTC on "Bitcoin" is not a question. */}
          {chainNeeded ? (
            <Field label="Network" htmlFor="pm-chain">
              <SelectMenu
                id="pm-chain"
                className={selectClass}
                aria-label="Network"
                value={chain}
                onChange={setChain}
                options={[
                  { value: "", label: "Pick a network", disabled: true },
                  ...chains.map((entry) => ({ value: entry.id, label: entry.label })),
                ]}
              />
            </Field>
          ) : (
            <Field label="Network" htmlFor="pm-chain-fixed">
              <div
                id="pm-chain-fixed"
                className={`${fieldClass} flex items-center text-white/40`}
                aria-readonly
              >
                {chains[0]?.label ?? "—"}
              </div>
            </Field>
          )}
        </div>

        <Field label="Wallet address" htmlFor="pm-value">
          <input
            id="pm-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Wallet address"
            spellCheck={false}
            autoComplete="off"
            className={`${fieldClass} font-mono`}
          />
        </Field>

        {addressCheck?.warning && (
          <p className="text-[12px]" style={{ color: ACCENTS.amber }}>
            {addressCheck.warning}
          </p>
        )}
        {error && (
          <p className="text-[12px]" style={{ color: ACCENTS.red }}>
            {error}
          </p>
        )}
        <AddButton busy={busy || !chain} accent={ACCENTS.green}>
          Add wallet
        </AddButton>
      </form>

      {methods.length === 0 ? (
        <Empty icon={<CreditCard className="h-7 w-7 text-white/15" />} text="No wallet saved" note="Saved wallets can be picked at checkout in the store." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {methods.map((entry) => {
            const described = describeWallet(entry)
            return (
            <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <MonoLabel style={{ color: ACCENTS.green }}>{described.coin}</MonoLabel>
                  {described.network ? (
                    <span className="text-[12px] text-white/40">{described.network}</span>
                  ) : (
                    // Saved before the network was recorded. Paying it out means
                    // guessing which chain, so it says so rather than looking
                    // complete.
                    <span className="text-[11px]" style={{ color: ACCENTS.amber }}>
                      network missing — re-add it
                    </span>
                  )}
                  {entry.is_primary && <StatusPill accent="blue">Primary</StatusPill>}
                </div>
                <p className="mt-1 truncate font-mono text-[13px] text-white/70">{entry.value}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label={`Remove ${described.coin} wallet`}
                className="shrink-0 rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
            )
          })}
        </ul>
      )}
      <p className="border-t border-white/[0.06] px-5 py-3 text-[12px] text-white/40">
        Only you and the admin can see these — they are not readable from the site itself.
      </p>
    </ProfileCard>
  )
}

type Win = {
  id: string
  source: string
  source_ref: string | null
  prize: string
  amount: number | null
  points: number | null
  status: string
  created_at: string
}

/**
 * The player's own wins.
 *
 * Matched on their username as well as their account id, so a giveaway won
 * before they ever signed in still shows up here.
 */
export function MyWinsPanel() {
  const { data, failed } = useProfileData<{ wins?: Win[] }>("/api/profile/wins")
  const wins = data?.wins ?? []
  const loaded = data !== null || failed

  // It is a tab of its own now, so an empty one says so rather than leaving
  // the tab blank. Until the list arrives, a placeholder of its shape.
  if (!loaded) return <div className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />

  return (
    <ProfileCard title="Your wins" accent="amber" right={<MonoLabel className="text-white/35">{wins.length}</MonoLabel>}>
      {wins.length === 0 ? (
        <Empty
          icon={<Trophy className="h-7 w-7 text-white/15" />}
          text="No wins yet"
          note="Giveaways, raffles, tournaments and challenges you win show up here."
        />
      ) : (
      <ul className="divide-y divide-white/[0.06]">
        {wins.map((win) => {
          const meta = sourceMeta(win.source)
          return (
            <li key={win.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${ACCENTS.amber}1f` }}
              >
                <Trophy className="h-4 w-4" style={{ color: ACCENTS.amber }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{win.prize}</p>
                <p className="truncate text-[12px] text-white/40">
                  {[meta.label, win.source_ref, new Date(win.created_at).toLocaleDateString()].filter(Boolean).join(" · ")}
                </p>
              </div>
              <StatusPill accent={win.status === "paid" ? "green" : "amber"}>
                {win.status === "paid" ? "Paid out" : "On the way"}
              </StatusPill>
              <span className="w-24 shrink-0 text-right text-[15px] font-bold tabular-nums" style={{ color: ACCENTS.green }}>
                {winValue(win)}
              </span>
            </li>
          )
        })}
      </ul>
      )}
    </ProfileCard>
  )
}

type Connections = {
  kick: { username: string; avatar: string | null }
  discord: { username: string | null; avatar: string | null; linkedAt: string | null } | null
  discordAvailable: boolean
}

const KICK_GREEN = "#53FC18"
const DISCORD_BLURPLE = "#5865F2"

function ConnectionRow({
  mark,
  color,
  name,
  detail,
  avatar,
  action,
}: {
  mark: React.ReactNode
  color: string
  name: string
  detail: string
  avatar?: string | null
  action: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-white">{name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-white/45">
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element -- avatar from the provider's CDN
            <img src={avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
          )}
          {detail}
        </p>
      </div>
      {action}
    </li>
  )
}

/**
 * The accounts an account signs in with.
 *
 * Kick is what the account is — points, Botrix and the leaderboard hang off
 * it — so it is listed but cannot be removed. Discord is a second way in,
 * linked here and removable here.
 */
export function ConnectionsPanel() {
  const { data, reload: load } = useProfileData<Connections>("/api/profile/connections")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function disconnect() {
    setBusy(true)
    setError(null)
    const response = await fetch("/api/profile/connections?provider=discord", { method: "DELETE" })
    setBusy(false)
    if (!response.ok) {
      setError("Could not disconnect Discord.")
      return
    }
    await load()
  }

  const linked = data?.discord ?? null
  const connectHref = `/auth/discord?mode=link&next=${encodeURIComponent("/profile?tab=settings")}`

  return (
    <ProfileCard title="Connections" accent="purple">
      {!data ? (
        <div className="h-[150px] animate-pulse bg-white/[0.015]" />
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          <ConnectionRow
            mark={<span className="text-[15px] font-black">K</span>}
            color={KICK_GREEN}
            name="Kick"
            detail={data.kick.username}
            avatar={data.kick.avatar}
            action={<StatusPill accent="green">Your account</StatusPill>}
          />
          <ConnectionRow
            mark={<DiscordMark className="h-5 w-5" />}
            color={DISCORD_BLURPLE}
            name="Discord"
            detail={
              linked
                ? `${linked.username ?? "Connected"} · sign in with it too`
                : data.discordAvailable
                  ? "Connect it to sign in with Discord as well"
                  : "Not available yet"
            }
            avatar={linked?.avatar}
            action={
              linked ? (
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={busy}
                  className="inline-flex h-9 items-center rounded-md border border-white/[0.12] px-3.5 text-[13px] font-semibold text-white/70 transition hover:border-[#E5484D]/60 hover:text-[#E5484D] disabled:opacity-40"
                >
                  {busy ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : data.discordAvailable ? (
                <a
                  href={connectHref}
                  className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-bold text-white transition hover:brightness-110"
                  style={{ backgroundColor: DISCORD_BLURPLE }}
                >
                  <DiscordMark className="h-4 w-4" /> Connect Discord
                </a>
              ) : (
                <StatusPill accent="slate">Soon</StatusPill>
              )
            }
          />
        </ul>
      )}
      {error && (
        <p className="border-t border-white/[0.06] px-5 py-3 text-[12.5px]" style={{ color: ACCENTS.red }}>
          {error}
        </p>
      )}
    </ProfileCard>
  )
}
