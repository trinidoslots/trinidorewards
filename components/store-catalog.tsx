"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Coins, Gift } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { KICK_GREEN } from "@/components/landing/parts"
import { KickMark, LoginModal } from "@/components/login-modal"
import { SelectMenu } from "@/components/ui/select-menu"
import { StoreItemCard } from "@/components/store-item-card"
import { inStock, type StoreItem } from "@/lib/store"
import { prefetchProfile } from "@/lib/profile-data"

/**
 * The store's two interactive halves: the wallet in the header, and the
 * catalogue under it with its filters.
 *
 * Filtering is done here, in the browser, on the list the page already
 * loaded — a store has tens of items, not thousands, and a round trip per
 * click would make the pills feel slower than the page around them.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PINK = ACCENTS.pink

const pts = (value: number) => value.toLocaleString("en-US")
const costOf = (item: StoreItem) => Number(item.cost) || 0

type Viewer = { userPoints: number; isLoggedIn: boolean; isCodeUser: boolean }

/** Could this viewer buy it right now, points aside? */
const open = (item: StoreItem, viewer: Viewer) => inStock(item) && (!item.code_user_only || viewer.isCodeUser)

/* -------------------------------------------------------------------------- */
/*                                   Wallet                                   */
/* -------------------------------------------------------------------------- */

/**
 * The panel on the right of the header: your balance and what it reaches.
 *
 * "Next up" is the cheapest reward you cannot afford yet, because that is the
 * one a balance is actually working towards; the most expensive item in the
 * store is a number nobody is saving for.
 */
export function StoreWallet({ items, ...viewer }: Viewer & { items: StoreItem[] }) {
  const [loginOpen, setLoginOpen] = useState(false)

  if (!viewer.isLoggedIn) {
    return (
      <div>
        <MonoLabel style={{ color: PINK }}>Your balance</MonoLabel>
        <p className="mt-3 text-[22px] font-bold leading-tight text-white">Sign in to see your points</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">
          Your Kick account is the login. Your balance and what it can buy show up here.
        </p>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md text-[14px] font-bold text-black transition hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: KICK_GREEN, boxShadow: `0 10px 40px -14px ${KICK_GREEN}99` }}
        >
          <KickMark className="h-4 w-4" />
          Log in with Kick
        </button>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </div>
    )
  }

  const reachable = items.filter((item) => open(item, viewer))
  const affordable = reachable.filter((item) => costOf(item) <= viewer.userPoints)
  const next = reachable
    .filter((item) => costOf(item) > viewer.userPoints)
    .sort((a, b) => costOf(a) - costOf(b))[0]
  const progress = next ? Math.min(100, (viewer.userPoints / costOf(next)) * 100) : 100

  return (
    <div>
      <MonoLabel style={{ color: PINK }}>Your balance</MonoLabel>
      <p className="mt-3 flex items-baseline gap-2 leading-none">
        <span className="text-[clamp(40px,5vw,56px)] font-black tabular-nums tracking-[-0.02em] text-white">
          {pts(viewer.userPoints)}
        </span>
        <span className="text-[15px] font-semibold text-white/45">pts</span>
      </p>

      <div className="mt-6 border-t border-white/[0.07] pt-5">
        {next ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <MonoLabel className="text-white/45">Next up</MonoLabel>
              <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: PINK }}>
                {pts(costOf(next) - viewer.userPoints)} to go
              </span>
            </div>
            <p className="mt-1.5 truncate text-[15px] font-semibold text-white">{next.name}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: PINK }} />
            </div>
          </>
        ) : (
          <p className="text-[14px] font-semibold" style={{ color: ACCENTS.green }}>
            {reachable.length > 0 ? "You can afford everything in the store." : "Nothing in the store is open to you yet."}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[13px] text-white/45">
            You can afford{" "}
            <span className="font-semibold tabular-nums text-white">
              {affordable.length} of {items.length}
            </span>
          </span>
          <Link
            href="/profile"
            className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 transition hover:text-white"
          >
            Your purchases
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 How it works                               */
/* -------------------------------------------------------------------------- */

const STEPS = [
  { title: "Watch on Kick", copy: "Points build up on your balance while you watch the stream." },
  { title: "Pick a reward", copy: "Spend them on anything below that your balance covers." },
  { title: "Track it", copy: "Every purchase and its status is listed on your profile." },
]

/** Three short steps under the title, so the store explains its own currency. */
export function StoreSteps() {
  return (
    <ol className="mt-8 grid max-w-2xl grid-cols-3 gap-x-4 sm:gap-x-6">
      {STEPS.map((step, index) => (
        <li key={step.title} className="border-t border-white/[0.10] pt-3">
          <MonoLabel style={{ color: PINK }}>0{index + 1}</MonoLabel>
          <p className="mt-1.5 text-[13px] font-semibold leading-snug text-white sm:text-[14px]">{step.title}</p>
          {/* On a phone the titles alone, so the wallet is not pushed below the fold. */}
          <p className="mt-1 hidden text-[12.5px] leading-relaxed text-white/45 sm:block">{step.copy}</p>
        </li>
      ))}
    </ol>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Catalogue                                 */
/* -------------------------------------------------------------------------- */

type Sort = "price-asc" | "price-desc" | "newest"

const SORTS = [
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
]

const ALL = "__all__"

export function StoreCatalog({ items, ...viewer }: Viewer & { items: StoreItem[] }) {
  const [category, setCategory] = useState(ALL)
  const [sort, setSort] = useState<Sort>("price-asc")
  const [affordableOnly, setAffordableOnly] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  // Saved casino usernames and wallets, fetched now so the buy dialog opens
  // with them already filled in (components/store-buy-dialog.tsx).
  useEffect(() => {
    if (!viewer.isLoggedIn) return
    void prefetchProfile("/api/profile/site-usernames").catch(() => {})
    void prefetchProfile("/api/profile/payment-methods").catch(() => {})
  }, [viewer.isLoggedIn])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      const name = item.category || "Other"
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return Array.from(counts.entries())
  }, [items])

  const shown = useMemo(() => {
    const list = items.filter(
      (item) =>
        (category === ALL || (item.category || "Other") === category) &&
        (!affordableOnly || (open(item, viewer) && costOf(item) <= viewer.userPoints)),
    )
    return list.sort((a, b) => {
      if (sort === "newest") return Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "") || 0
      return sort === "price-asc" ? costOf(a) - costOf(b) : costOf(b) - costOf(a)
    })
  }, [items, category, sort, affordableOnly, viewer])

  const cheapestOpen = items
    .filter((item) => open(item, viewer))
    .sort((a, b) => costOf(a) - costOf(b))[0]

  return (
    <div className="space-y-6">
      {/* The toolbar: what to show on the left, how to order it on the right. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {categories.length > 1 ? (
          <div className="inline-flex flex-wrap gap-1 self-start rounded-full border border-white/[0.10] bg-black/40 p-1">
            {[[ALL, items.length] as const, ...categories].map(([name, count]) => {
              const active = category === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCategory(name)}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition"
                  style={active ? { backgroundColor: PINK, color: "#000" } : { color: "rgba(255,255,255,0.55)" }}
                >
                  {name === ALL ? "All" : name}
                  <span className="tabular-nums" style={{ opacity: active ? 0.6 : 0.5 }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <MonoLabel className="text-white/40">
            {items.length} {items.length === 1 ? "reward" : "rewards"}
          </MonoLabel>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          {viewer.isLoggedIn && (
            <button
              type="button"
              role="switch"
              aria-checked={affordableOnly}
              onClick={() => setAffordableOnly((value) => !value)}
              className="inline-flex h-10 items-center gap-2.5 rounded-md border px-3.5 text-[13px] font-semibold transition"
              style={
                affordableOnly
                  ? { borderColor: `${ACCENTS.green}66`, backgroundColor: `${ACCENTS.green}14`, color: "#fff" }
                  : { borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)" }
              }
            >
              <span
                aria-hidden
                className="relative h-4 w-7 rounded-full transition"
                style={{ backgroundColor: affordableOnly ? ACCENTS.green : "rgba(255,255,255,0.15)" }}
              >
                <span
                  className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
                  style={{ left: affordableOnly ? 14 : 2 }}
                />
              </span>
              Only what I can afford
            </button>
          )}
          <div className="w-[13.5rem]">
            <SelectMenu
              aria-label="Sort"
              className="h-10! px-3.5! text-[13px]!"
              value={sort}
              onChange={(value) => setSort(value as Sort)}
              options={SORTS}
            />
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6 sm:flex-row sm:items-center">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
            style={{ borderColor: `${PINK}44`, backgroundColor: `${PINK}14` }}
          >
            <Coins className="h-5 w-5" style={{ color: PINK }} />
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-white">Nothing here you can afford yet</p>
            <p className="mt-0.5 text-[13px] text-white/45">
              {cheapestOpen
                ? `The cheapest reward is ${pts(costOf(cheapestOpen))} pts, ${pts(costOf(cheapestOpen) - viewer.userPoints)} more than you have.`
                : "Keep watching and your balance will get there."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAffordableOnly(false)
              setCategory(ALL)
            }}
            className="inline-flex h-10 items-center rounded-md border border-white/15 bg-white/[0.04] px-4 text-[13px] font-semibold text-white transition hover:border-white/30"
          >
            Show everything
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((item) => (
              <motion.div
                key={item.id}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, ease: EASE }}
                // grid, not flex: the card is a size container, which has no
                // width of its own to shrink to inside a flex row.
                className="grid"
              >
                <StoreItemCard
                  item={item}
                  userPoints={viewer.userPoints}
                  isLoggedIn={viewer.isLoggedIn}
                  isCodeUser={viewer.isCodeUser}
                  onSignIn={() => setLoginOpen(true)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}

/** The whole store is empty: said plainly, with nothing to filter. */
export function StoreEmpty() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${PINK}44`, backgroundColor: `${PINK}14` }}
      >
        <Gift className="h-5 w-5" style={{ color: PINK }} />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-white">Nothing in the store right now</p>
        <p className="mt-0.5 text-[13px] text-white/45">New rewards show up here as soon as they are listed.</p>
      </div>
    </div>
  )
}
