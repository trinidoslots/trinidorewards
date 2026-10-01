"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Copy, ExternalLink, Gift, Star } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

/**
 * One offer as visitors see it on /bonuses.
 *
 * Shared with the admin editor, which renders it as a live preview while the
 * form is being filled in, so what is previewed is what goes out.
 */

export type Bonus = {
  id: string
  title: string
  description: string | null
  code: string | null
  terms: string | null
  value: string | null
  casino_name: string | null
  casino_url: string | null
  image_url: string | null
  is_active: boolean
  featured: boolean
  created_at?: string
}

/** The page's accent; featured offers wear it, the rest stay neutral. */
const AMBER = ACCENTS.amber
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/**
 * The code, large, with copy on the whole box.
 *
 * The one thing on the card that has to be exact, so it is the easiest thing
 * to hit and says plainly when it worked.
 */
export function CodeBox({ code, size = "md" }: { code: string; size?: "md" | "lg" }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // The async clipboard can be refused (an embedded browser, an old one,
      // a page not served over https). The old select-and-copy still works there.
      const field = document.createElement("textarea")
      field.value = code
      field.setAttribute("readonly", "")
      field.style.position = "fixed"
      field.style.opacity = "0"
      document.body.appendChild(field)
      field.select()
      const ok = document.execCommand("copy")
      field.remove()
      if (!ok) return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy code ${code}`}
      className={`group flex w-full items-center justify-between gap-3 rounded-lg border border-dashed px-4 text-left transition hover:bg-white/[0.04] ${
        size === "lg" ? "h-14" : "h-12"
      }`}
      style={{ borderColor: copied ? `${ACCENTS.green}88` : "rgba(255,255,255,0.18)" }}
    >
      <span className="min-w-0">
        <MonoLabel className="block text-white/40">Code</MonoLabel>
        <span
          className={`block truncate font-mono font-bold tracking-[0.06em] text-white ${size === "lg" ? "text-[18px]" : "text-[15px]"}`}
        >
          {code}
        </span>
      </span>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold transition"
        style={{ color: copied ? ACCENTS.green : "rgba(255,255,255,0.55)" }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 transition group-hover:text-white" />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  )
}

/** The casino's own link, out of the site. */
function ClaimLink({ href, label = "Claim offer", strong }: { href: string; label?: string; strong?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-[14px] font-bold transition hover:brightness-110 active:scale-[0.99]"
      style={
        strong
          ? { backgroundColor: AMBER, color: "#000", boxShadow: `0 10px 30px -14px ${AMBER}` }
          : { border: "1px solid rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)", color: "#fff" }
      }
    >
      {label}
      <ExternalLink className="h-4 w-4" />
    </a>
  )
}

/**
 * Casino artwork over a blurred copy of itself.
 *
 * Offers come with logos, banners and square art from every casino; shown
 * whole on a blur of their own colours, none of them is cropped or left in a
 * grey box.
 */
function Artwork({ src }: { src: string | null }) {
  return (
    <div className="relative h-36 overflow-hidden bg-[#0A0A0C]">
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- casino artwork from any host */}
          <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0E0E12] via-[#0E0E12]/30 to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element -- casino artwork from any host */}
          <img src={src} alt="" loading="lazy" className="relative mx-auto h-full w-auto max-w-[62%] object-contain py-8" />
        </>
      ) : (
        <div
          className="flex h-full items-center justify-center"
          style={{ background: `radial-gradient(260px 140px at 50% 0%, ${AMBER}1f, transparent 70%)` }}
        >
          <Gift className="h-10 w-10 text-white/15" />
        </div>
      )}
    </div>
  )
}

export function BonusCard({ bonus }: { bonus: Bonus }) {
  const [termsOpen, setTermsOpen] = useState(false)

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-xl border bg-[#0E0E12] transition duration-300 hover:-translate-y-1 hover:border-white/20"
      style={{ borderColor: bonus.featured ? `${AMBER}55` : "rgba(255,255,255,0.08)" }}
    >
      <div className="relative">
        <Artwork src={bonus.image_url} />
        {bonus.featured && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] backdrop-blur"
            style={{ borderColor: `${AMBER}66`, backgroundColor: `${AMBER}2b`, color: AMBER }}
          >
            <Star className="h-3 w-3 fill-current" /> Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          {bonus.casino_name && <MonoLabel style={{ color: AMBER }}>{bonus.casino_name}</MonoLabel>}
          <h3 className="mt-1.5 text-[17px] font-bold leading-snug text-white">{bonus.title}</h3>
        </div>

        {bonus.value && (
          <p className="text-[26px] font-black leading-tight tracking-[-0.01em]" style={{ color: ACCENTS.green }}>
            {bonus.value}
          </p>
        )}

        {bonus.description && <p className="line-clamp-3 text-[13.5px] leading-relaxed text-white/50">{bonus.description}</p>}

        <div className="mt-auto space-y-2.5">
          {bonus.code && <CodeBox code={bonus.code} />}
          {bonus.casino_url && <ClaimLink href={bonus.casino_url} strong={bonus.featured} />}

          {bonus.terms && (
            <div>
              <button
                type="button"
                onClick={() => setTermsOpen((open) => !open)}
                aria-expanded={termsOpen}
                className="text-[12px] font-medium text-white/40 underline-offset-4 transition hover:text-white/70 hover:underline"
              >
                {termsOpen ? "Hide terms" : "Terms apply"}
              </button>
              <AnimatePresence initial={false}>
                {termsOpen && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden pt-1.5 text-[12px] leading-relaxed text-white/40"
                  >
                    {bonus.terms}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The header panel: the featured offer itself, ready to copy and claim.
 *
 * The first featured offer, or the newest when none is featured. A count of
 * offers in that spot would only repeat what the grid below shows.
 */
export function BonusSpotlight({ bonus }: { bonus: Bonus }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Star className="h-3.5 w-3.5 fill-current" style={{ color: AMBER }} />
        <MonoLabel style={{ color: AMBER }}>{bonus.featured ? "Featured offer" : "Newest offer"}</MonoLabel>
      </div>
      {bonus.casino_name && <p className="mt-3 text-[13px] font-semibold text-white/50">{bonus.casino_name}</p>}
      <p className="mt-1 text-[clamp(26px,3vw,34px)] font-black leading-[1.05] tracking-[-0.01em]" style={{ color: ACCENTS.green }}>
        {bonus.value || bonus.title}
      </p>
      {bonus.value && <p className="mt-1.5 text-[14px] text-white/60">{bonus.title}</p>}
      <div className="mt-5 space-y-2.5">
        {bonus.code && <CodeBox code={bonus.code} size="lg" />}
        {bonus.casino_url && <ClaimLink href={bonus.casino_url} strong />}
      </div>
    </div>
  )
}

const ALL = "__all__"

/** Every offer, with casino pills when there is more than one casino. */
export function BonusCatalog({ bonuses }: { bonuses: Bonus[] }) {
  const [casino, setCasino] = useState(ALL)

  const casinos = useMemo(() => {
    const counts = new Map<string, number>()
    for (const bonus of bonuses) {
      if (bonus.casino_name) counts.set(bonus.casino_name, (counts.get(bonus.casino_name) ?? 0) + 1)
    }
    return Array.from(counts.entries())
  }, [bonuses])

  const shown = casino === ALL ? bonuses : bonuses.filter((bonus) => bonus.casino_name === casino)

  return (
    <div className="space-y-6">
      {casinos.length > 1 && (
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-white/[0.10] bg-black/40 p-1">
          {[[ALL, bonuses.length] as const, ...casinos].map(([name, count]) => {
            const active = casino === name
            return (
              <button
                key={name}
                type="button"
                onClick={() => setCasino(name)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition"
                style={active ? { backgroundColor: AMBER, color: "#000" } : { color: "rgba(255,255,255,0.55)" }}
              >
                {name === ALL ? "All" : name}
                <span className="tabular-nums" style={{ opacity: active ? 0.6 : 0.5 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((bonus) => (
            <motion.div
              key={bonus.id}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: EASE }}
              className="grid"
            >
              <BonusCard bonus={bonus} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
