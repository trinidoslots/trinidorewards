"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Plug, Plus, RefreshCw, Trash2, XCircle, Zap } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile } from "@/components/ui/panel"
import { SelectMenu, FIELD_CLASS } from "@/components/ui/select-menu"
import { DATE_FORMATS, DEFAULT_CONFIG } from "@/lib/leaderboard-provider"

/**
 * The wager feeds a leaderboard can be fetched from.
 *
 * Everything that differs between these APIs is a field here rather than a line
 * of code, so a new affiliate is a form and not a deploy. The defaults are the
 * feed already in use, because a second affiliate leaderboard is more likely to
 * resemble that one than to resemble nothing.
 *
 * The key is write-only. It is stored in a table the anon key cannot see at all
 * (RLS on, no policy — scripts/062) and comes back as sk_l…4f2a, enough to tell
 * which key is in there without the panel being somewhere one can be read off a
 * screen. Saving with the field left blank keeps the stored key, so editing a
 * path does not mean retyping a secret nobody can read back.
 */

type Provider = {
  id: string
  name: string
  base_url: string
  api_key_preview: string
  auth_header: string | null
  auth_scheme: string | null
  start_param: string | null
  end_param: string | null
  limit_param: string | null
  date_format: string | null
  max_limit: number | null
  max_range_days: number | null
  cache_minutes: number | null
  rows_path: string | null
  username_path: string | null
  score_path: string | null
  score_divisor: number | string | null
  avatar_path: string | null
  ref_path: string | null
  success_path: string | null
  is_active: boolean
}

type Draft = {
  name: string
  base_url: string
  api_key: string
  auth_header: string
  auth_scheme: string
  start_param: string
  end_param: string
  limit_param: string
  date_format: string
  max_limit: string
  max_range_days: string
  cache_minutes: string
  rows_path: string
  username_path: string
  score_path: string
  score_divisor: string
  avatar_path: string
  ref_path: string
  success_path: string
  is_active: boolean
}

const emptyDraft = (): Draft => ({
  name: "",
  base_url: "",
  api_key: "",
  auth_header: DEFAULT_CONFIG.authHeader,
  auth_scheme: "",
  start_param: DEFAULT_CONFIG.startParam,
  end_param: DEFAULT_CONFIG.endParam,
  limit_param: DEFAULT_CONFIG.limitParam ?? "",
  date_format: DEFAULT_CONFIG.dateFormat,
  max_limit: String(DEFAULT_CONFIG.maxLimit),
  max_range_days: String(DEFAULT_CONFIG.maxRangeDays),
  cache_minutes: String(DEFAULT_CONFIG.cacheMinutes),
  rows_path: DEFAULT_CONFIG.rowsPath,
  username_path: DEFAULT_CONFIG.usernamePath,
  score_path: DEFAULT_CONFIG.scorePath,
  score_divisor: String(DEFAULT_CONFIG.scoreDivisor),
  avatar_path: DEFAULT_CONFIG.avatarPath ?? "",
  ref_path: DEFAULT_CONFIG.refPath ?? "",
  success_path: DEFAULT_CONFIG.successPath ?? "",
  is_active: true,
})

function draftFrom(provider: Provider): Draft {
  const base = emptyDraft()
  const text = (value: string | null, fallback: string) => (value === null ? fallback : value)
  return {
    ...base,
    name: provider.name,
    base_url: provider.base_url,
    // Never prefilled — it is not sent back, and a blank field means "keep it".
    api_key: "",
    auth_header: text(provider.auth_header, base.auth_header),
    auth_scheme: provider.auth_scheme ?? "",
    start_param: text(provider.start_param, base.start_param),
    end_param: text(provider.end_param, base.end_param),
    limit_param: provider.limit_param ?? "",
    date_format: text(provider.date_format, base.date_format),
    max_limit: String(provider.max_limit ?? base.max_limit),
    max_range_days: String(provider.max_range_days ?? base.max_range_days),
    cache_minutes: String(provider.cache_minutes ?? base.cache_minutes),
    rows_path: text(provider.rows_path, base.rows_path),
    username_path: text(provider.username_path, base.username_path),
    score_path: text(provider.score_path, base.score_path),
    score_divisor: String(provider.score_divisor ?? base.score_divisor),
    avatar_path: provider.avatar_path ?? "",
    ref_path: provider.ref_path ?? "",
    success_path: provider.success_path ?? "",
    is_active: provider.is_active,
  }
}

type TestResult =
  | { ok: true; found: number; sample: { rank: number; username: string; score: number; hasAvatar: boolean; hasRef: boolean }[] }
  | { ok: false; error: string }

/**
 * "160,524 → $160.52", worked out from whatever is in the field.
 *
 * The conversion is the one setting here that is wrong silently: a board with
 * the divisor left at 1000 for a feed that reports dollars looks like a very
 * quiet week, and one left at 1 for a feed that counts coins looks like a
 * record month. A number next to the field is cheaper than finding out later.
 */
function divisorExample(raw: string): string {
  const divisor = Number(raw)
  if (!Number.isFinite(divisor) || divisor <= 0) return "Must be greater than zero."
  const sample = 160524
  const converted = Math.round((sample / divisor) * 100) / 100
  return `${sample.toLocaleString("en-US")} → $${converted.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-white/25">{hint}</p>}
    </div>
  )
}

export default function LeaderboardProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<TestResult | null>(null)
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch("/api/admin/leaderboard-providers")
    const payload = (await response.json().catch(() => null)) as
      | { providers?: Provider[]; error?: string }
      | null

    if (!response.ok) {
      setNotice({ tone: "error", text: payload?.error || "Could not load the providers." })
    } else {
      setProviders(payload?.providers ?? [])
      setNotice(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function edit(provider: Provider) {
    setSelected(provider.id)
    setCreating(false)
    setDraft(draftFrom(provider))
    setTest(null)
  }

  function startNew() {
    setSelected(null)
    setCreating(true)
    setDraft(emptyDraft())
    setTest(null)
  }

  function body() {
    return {
      ...draft,
      max_limit: Number(draft.max_limit),
      max_range_days: Number(draft.max_range_days),
      cache_minutes: Number(draft.cache_minutes),
      score_divisor: Number(draft.score_divisor),
    }
  }

  async function save() {
    setBusy(true)
    const response = await fetch("/api/admin/leaderboard-providers", {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creating ? body() : { ...body(), id: selected }),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setBusy(false)

    if (!response.ok) {
      setNotice({ tone: "error", text: payload?.error || "Could not save that provider." })
      return
    }
    setNotice({ tone: "ok", text: creating ? "Provider added." : "Saved." })
    setCreating(false)
    await load()
  }

  async function remove(provider: Provider) {
    if (!confirm(`Delete "${provider.name}"? Boards using it fall back to the environment variables.`)) return
    setBusy(true)
    const response = await fetch(`/api/admin/leaderboard-providers?id=${encodeURIComponent(provider.id)}`, {
      method: "DELETE",
    })
    setBusy(false)
    if (!response.ok) {
      setNotice({ tone: "error", text: "Could not delete that provider." })
      return
    }
    if (selected === provider.id) {
      setSelected(null)
      setCreating(false)
    }
    await load()
  }

  async function runTest() {
    setTesting(true)
    setTest(null)
    const response = await fetch("/api/admin/leaderboard-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body(), action: "test", id: selected }),
    })
    const payload = (await response.json().catch(() => null)) as TestResult | { error?: string } | null
    setTesting(false)

    if (payload && "ok" in payload) setTest(payload)
    else setTest({ ok: false, error: (payload as { error?: string })?.error || "The test request failed." })
  }

  const editing = creating || selected !== null
  const active = providers.filter((entry) => entry.is_active).length

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Leaderboard feeds</h1>
          <p className="mt-1 text-[13px] text-white/40">
            Where live standings come from. A board picks one of these under Manage.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add feed
          </button>
        </div>
      </header>

      {notice && (
        <Panel
          accent={notice.tone === "ok" ? "green" : "red"}
          className="px-3.5 py-2.5 text-[13px]"
          style={{ color: notice.tone === "ok" ? ACCENTS.green : ACCENTS.red }}
        >
          {notice.text}
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <StatTile label="Feeds" value={String(providers.length)} />
        <StatTile label="Active" value={String(active)} accent={active > 0 ? "green" : "slate"} />
      </div>

      <Panel accent="blue">
        <PanelHeader title="Configured feeds" right={<MonoLabel className="text-white/25">{providers.length}</MonoLabel>} />
        {loading ? (
          <div className="py-12 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Plug className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">No feeds yet.</p>
            <p className="max-w-md text-center text-[11.5px] text-white/20">
              Boards with no feed assigned use LEADERBOARD_API_URL and LEADERBOARD_API_KEY, so nothing breaks
              until you add one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {providers.map((provider) => (
              <li key={provider.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-medium text-white">{provider.name}</span>
                    <MonoLabel style={{ color: provider.is_active ? ACCENTS.green : "rgba(255,255,255,0.25)" }}>
                      {provider.is_active ? "Active" : "Off"}
                    </MonoLabel>
                  </div>
                  <p className="truncate text-[11px] text-white/30">{provider.base_url}</p>
                  <MonoLabel className="text-white/20">key {provider.api_key_preview}</MonoLabel>
                </div>
                <button
                  type="button"
                  onClick={() => edit(provider)}
                  className="inline-flex h-8 shrink-0 items-center rounded-md border border-white/[0.10] px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(provider)}
                  disabled={busy}
                  aria-label={`Delete ${provider.name}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.10] text-white/30 transition hover:border-[#E5484D]/40 hover:text-[#E5484D] disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && (
        <Panel accent="amber">
          <PanelHeader title={creating ? "New feed" : `Editing ${draft.name}`} accent="amber" />

          <div className="space-y-5 p-3.5">
            {/* --- connection ------------------------------------------- */}
            <div>
              <MonoLabel className="mb-2.5 block text-white/40">Connection</MonoLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className={FIELD_CLASS} />
                </Field>
                <Field label="Address" hint="The full endpoint, including any query string it already needs.">
                  <input
                    value={draft.base_url}
                    onChange={(e) => set({ base_url: e.target.value })}
                    placeholder="https://api.example.com/affiliates/wager-leaderboard"
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field
                  label="API key"
                  hint={creating ? "Stored server-side; never shown again." : "Leave blank to keep the stored key."}
                >
                  <input
                    type="password"
                    value={draft.api_key}
                    onChange={(e) => set({ api_key: e.target.value })}
                    placeholder={creating ? "" : "unchanged"}
                    className={FIELD_CLASS}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Key header">
                    <input
                      value={draft.auth_header}
                      onChange={(e) => set({ auth_header: e.target.value })}
                      className={FIELD_CLASS}
                    />
                  </Field>
                  <Field label="Prefix" hint="e.g. Bearer. Blank sends the key alone.">
                    <input
                      value={draft.auth_scheme}
                      onChange={(e) => set({ auth_scheme: e.target.value })}
                      placeholder="none"
                      className={FIELD_CLASS}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* --- request ---------------------------------------------- */}
            <div>
              <MonoLabel className="mb-2.5 block text-white/40">Request</MonoLabel>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Start parameter">
                  <input
                    value={draft.start_param}
                    onChange={(e) => set({ start_param: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="End parameter">
                  <input
                    value={draft.end_param}
                    onChange={(e) => set({ end_param: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Limit parameter" hint="Blank if it takes none.">
                  <input
                    value={draft.limit_param}
                    onChange={(e) => set({ limit_param: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Date format">
                  <SelectMenu
                    aria-label="Date format"
                    value={draft.date_format}
                    onChange={(value) => set({ date_format: value })}
                    options={DATE_FORMATS.map((entry) => ({
                      value: entry.id,
                      label: entry.label,
                      hint: entry.example,
                    }))}
                  />
                </Field>
                <Field label="Max rows" hint="Most feeds cap this.">
                  <input
                    type="number"
                    value={draft.max_limit}
                    onChange={(e) => set({ max_limit: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Max window (days)">
                  <input
                    type="number"
                    value={draft.max_range_days}
                    onChange={(e) => set({ max_range_days: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
              </div>
              <div className="mt-3 sm:max-w-[240px]">
                <Field
                  label="Reuse for (minutes)"
                  hint="Match the feed's own cache. Asking faster returns the same data and spends the rate limit."
                >
                  <input
                    type="number"
                    value={draft.cache_minutes}
                    onChange={(e) => set({ cache_minutes: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
              </div>
            </div>

            {/* --- response --------------------------------------------- */}
            <div>
              <MonoLabel className="mb-1 block text-white/40">Response</MonoLabel>
              <p className="mb-2.5 text-[11.5px] text-white/25">
                Dot paths into the JSON. For{" "}
                <code className="text-white/40">{`{"data":[{"user":{"username":"…"},"totalWagered":1}]}`}</code> the
                rows are at <code className="text-white/40">data</code> and the name at{" "}
                <code className="text-white/40">user.username</code>. Leave the rows path empty if the response is
                the array itself.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Rows path">
                  <input
                    value={draft.rows_path}
                    onChange={(e) => set({ rows_path: e.target.value })}
                    placeholder="(the response itself)"
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Username path">
                  <input
                    value={draft.username_path}
                    onChange={(e) => set({ username_path: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Score path" hint="The number the board ranks on.">
                  <input
                    value={draft.score_path}
                    onChange={(e) => set({ score_path: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field
                  label="Divide score by"
                  /* Worked out as you type. These feeds do not all count in
                     dollars and the difference is silent otherwise: EarnLab's
                     160524 is $160.52, not $160,524.00. */
                  hint={`1 if the feed already reports currency. ${divisorExample(draft.score_divisor)}`}
                >
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={draft.score_divisor}
                    onChange={(e) => set({ score_divisor: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Avatar path" hint="Blank for none.">
                  <input
                    value={draft.avatar_path}
                    onChange={(e) => set({ avatar_path: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Account id path" hint="Kept for payouts — names are masked on the page.">
                  <input
                    value={draft.ref_path}
                    onChange={(e) => set({ ref_path: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Success flag path" hint="Blank if it has none.">
                  <input
                    value={draft.success_path}
                    onChange={(e) => set({ success_path: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </Field>
              </div>
            </div>

            <label className="flex w-fit items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => set({ is_active: e.target.checked })}
                className="rounded border-white/[0.12]"
              />
              <span className="text-[13px] text-white/60">Active</span>
            </label>

            {/* --- the trial run ---------------------------------------- */}
            {test && (
              <div
                className="rounded-md border px-3.5 py-3"
                style={{
                  borderColor: test.ok ? `${ACCENTS.green}44` : `${ACCENTS.red}44`,
                  backgroundColor: test.ok ? `${ACCENTS.green}0D` : `${ACCENTS.red}0D`,
                }}
              >
                <div className="flex items-center gap-2">
                  {test.ok ? (
                    <CheckCircle2 className="h-4 w-4" style={{ color: ACCENTS.green }} />
                  ) : (
                    <XCircle className="h-4 w-4" style={{ color: ACCENTS.red }} />
                  )}
                  <span className="text-[13px] text-white">
                    {test.ok ? `Read ${test.found} player${test.found === 1 ? "" : "s"}.` : test.error}
                  </span>
                </div>

                {test.ok && test.found === 0 && (
                  <p className="mt-1.5 text-[11.5px] text-white/35">
                    The feed answered, but no rows came through those paths. Check the rows, username and score
                    paths against an actual response.
                  </p>
                )}

                {test.ok && test.sample.length > 0 && (
                  <table className="mt-2.5 w-full text-[12px]">
                    <thead>
                      <tr className="text-left">
                        <th className="pb-1 pr-2 font-normal"><MonoLabel className="text-white/25">#</MonoLabel></th>
                        <th className="pb-1 pr-2 font-normal"><MonoLabel className="text-white/25">Name</MonoLabel></th>
                        <th className="pb-1 pr-2 text-right font-normal"><MonoLabel className="text-white/25">Score</MonoLabel></th>
                        <th className="pb-1 pr-2 font-normal"><MonoLabel className="text-white/25">Avatar</MonoLabel></th>
                        <th className="pb-1 font-normal"><MonoLabel className="text-white/25">Id</MonoLabel></th>
                      </tr>
                    </thead>
                    <tbody>
                      {test.sample.map((row) => (
                        <tr key={row.rank} className="text-white/70">
                          <td className="py-0.5 pr-2 tabular-nums">{row.rank}</td>
                          <td className="py-0.5 pr-2">{row.username}</td>
                          <td className="py-0.5 pr-2 text-right tabular-nums">{row.score.toLocaleString("en-US")}</td>
                          <td className="py-0.5 pr-2">{row.hasAvatar ? "yes" : "—"}</td>
                          <td className="py-0.5">{row.hasRef ? "yes" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.08] p-3">
            <button
              type="button"
              onClick={() => {
                setCreating(false)
                setSelected(null)
                setTest(null)
              }}
              className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 transition hover:border-white/25 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runTest}
              disabled={testing || busy}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-30"
            >
              <Zap className={`h-3.5 w-3.5 ${testing ? "animate-pulse" : ""}`} />
              {testing ? "Testing…" : "Test"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.amber }}
            >
              {busy ? "Saving…" : creating ? "Add feed" : "Save"}
            </button>
          </div>
        </Panel>
      )}
    </div>
  )
}
