"use client"

import { adminHref } from "@/lib/admin-host"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Check, Inbox, Loader2, RefreshCw, RotateCcw, X } from "lucide-react"
import { BetLink } from "@/components/admin/bet-link"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, Tag } from "@/components/ui/panel"
import { SelectMenu } from "@/components/ui/select-menu"
import {
  phaseOf,
  targetLabel,
  type Challenge,
  type Submission,
  type SubmissionStatus,
} from "@/lib/challenges"

/**
 * Claims on slot challenges, to approve or reject.
 *
 * The casino ID links to the bet on Stake (hover it to see where it goes), so
 * the multiplier and bet size can be checked against the challenge before
 * approving. Approved claims count towards the challenge's winners; once they
 * are all in, the challenge completes on its own.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

type Filter = SubmissionStatus | "all"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
]

const STATUS_ACCENT = { pending: "amber", approved: "green", rejected: "red" } as const

export default function SubmissionsPage() {
  // useSearchParams needs a Suspense boundary above it in the App Router.
  return (
    <Suspense fallback={null}>
      <Submissions />
    </Suspense>
  )
}

function Submissions() {
  const params = useSearchParams()
  const supabaseRef = useRef(createClient())
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("pending")
  const [challengeFilter, setChallengeFilter] = useState(params.get("challenge") ?? "all")
  const [busy, setBusy] = useState<string | null>(null)
  const [reviewer, setReviewer] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const client = supabaseRef.current
    const [{ data: subs, error: problem }, { data: list }, { data: auth }] = await Promise.all([
      client.from("challenge_submissions").select("*").order("created_at", { ascending: false }).limit(500),
      client.from("challenges").select("*"),
      client.auth.getUser(),
    ])
    if (problem) {
      setError(
        problem.message.includes("does not exist")
          ? "The challenges tables are missing. Run scripts/083_challenges.sql in Supabase."
          : problem.message,
      )
    } else {
      setSubmissions((subs ?? []) as Submission[])
      setChallenges((list ?? []) as Challenge[])
      setError(null)
    }
    const name = auth?.user?.user_metadata?.kick_username
    setReviewer(typeof name === "string" ? name : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byId = useMemo(() => new Map(challenges.map((challenge) => [challenge.id, challenge])), [challenges])
  const approvedFor = (id: string) => submissions.filter((row) => row.challenge_id === id && row.status === "approved").length

  const inChallenge = submissions.filter((row) => challengeFilter === "all" || row.challenge_id === challengeFilter)
  const count = (id: Filter) => (id === "all" ? inChallenge.length : inChallenge.filter((row) => row.status === id).length)
  const shown = inChallenge.filter((row) => filter === "all" || row.status === filter)

  async function review(submission: Submission, status: SubmissionStatus) {
    setBusy(submission.id)
    const changes = {
      status,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
      reviewed_by: status === "pending" ? null : reviewer,
    }
    const { error: problem } = await supabaseRef.current.from("challenge_submissions").update(changes).eq("id", submission.id)
    setBusy(null)
    if (problem) {
      // The one-live-claim-per-viewer rule: reopening a rejected claim while
      // the same viewer has another live one.
      setError(problem.code === "23505" ? `${submission.username} already has another live claim on this challenge.` : problem.message)
      return
    }
    setError(null)
    setSubmissions((current) => current.map((row) => (row.id === submission.id ? { ...row, ...changes } : row)))
  }

  const challengeOptions = [
    { value: "all", label: "All challenges" },
    ...challenges.map((challenge) => ({ value: challenge.id, label: `${challenge.slot_name} · ${targetLabel(challenge)}` })),
  ]

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={adminHref("/admin/challenges")} className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/35 transition hover:text-white/70">
            <ArrowLeft className="h-3 w-3" />
            Challenges
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-white">Submissions</h1>
          <p className="mt-1 text-[13px] text-white/40">Check each bet on Stake, then approve or reject the claim.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Claims" accent="amber" right={<MonoLabel className="text-white/25">{shown.length} shown</MonoLabel>} />

        <div className="flex flex-col gap-2.5 border-b border-white/[0.06] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-md border border-white/[0.08] bg-black/30 p-1">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className="relative rounded px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors"
                style={{ color: filter === id ? "#fff" : "rgba(255,255,255,0.4)" }}
              >
                {filter === id && (
                  <motion.span layoutId="submission-filter" className="absolute inset-0 rounded bg-white/[0.10]" transition={{ duration: 0.25, ease: EASE }} />
                )}
                <span className="relative">
                  {label} {count(id)}
                </span>
              </button>
            ))}
          </div>
          <div className="w-full sm:w-72">
            <SelectMenu aria-label="Challenge" value={challengeFilter} onChange={setChallengeFilter} options={challengeOptions} />
          </div>
        </div>

        {loading && submissions.length === 0 ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.length === 0 && (
                <motion.li key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 py-12 text-[13px] text-white/30">
                  <Inbox className="h-6 w-6 text-white/10" />
                  {filter === "pending" ? "Nothing waiting for review." : "No claims here."}
                </motion.li>
              )}
              {shown.map((submission) => {
                const challenge = byId.get(submission.challenge_id)
                const approved = challenge ? approvedFor(challenge.id) : 0
                const full = challenge?.max_winners != null && approved >= challenge.max_winners
                const phase = challenge ? phaseOf(challenge, approved) : "completed"
                return (
                  <motion.li
                    key={submission.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.26, ease: EASE }}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1 basis-60">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-white">{submission.username}</span>
                        <Tag accent={STATUS_ACCENT[submission.status]}>{submission.status}</Tag>
                      </div>
                      <p className="mt-1 truncate text-[12px] text-white/40">
                        {challenge ? (
                          <>
                            {challenge.slot_name} · target <span className="text-white/70">{targetLabel(challenge)}</span>
                            {Number(challenge.min_bet) > 0 && <> · min bet ${Number(challenge.min_bet)}</>}
                            {" · "}
                            winners {approved}
                            {challenge.max_winners ? `/${challenge.max_winners}` : ""}
                            {phase === "completed" && " · ended"}
                          </>
                        ) : (
                          "Challenge deleted"
                        )}
                      </p>
                      <MonoLabel className="mt-1 block text-white/25">
                        {new Date(submission.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        {submission.reviewed_by && ` · reviewed by ${submission.reviewed_by}`}
                      </MonoLabel>
                    </div>

                    <BetLink betId={submission.bet_id} />

                    <div className="flex items-center gap-1.5">
                      {submission.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => review(submission, "approved")}
                            disabled={busy === submission.id || full}
                            title={full ? "Every winner slot is already taken" : "Approve"}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition hover:brightness-125 disabled:opacity-40"
                            style={{ color: ACCENTS.green, borderColor: `${ACCENTS.green}55`, backgroundColor: `${ACCENTS.green}14` }}
                          >
                            {busy === submission.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => review(submission, "rejected")}
                            disabled={busy === submission.id}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition hover:brightness-125 disabled:opacity-40"
                            style={{ color: ACCENTS.red, borderColor: `${ACCENTS.red}55`, backgroundColor: `${ACCENTS.red}14` }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => review(submission, "pending")}
                          disabled={busy === submission.id}
                          title="Back to pending"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 text-[12px] text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                        >
                          {busy === submission.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Undo
                        </button>
                      )}
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
    </div>
  )
}
