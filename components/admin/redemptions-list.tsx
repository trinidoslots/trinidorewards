"use client"

import { Fragment, useMemo } from "react"
import Link from "next/link"
import { Check, ChevronDown, Package, Search, Undo2, X } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, Tag } from "@/components/ui/panel"
import { CopyableId, CopyButton } from "@/components/ui/copyable-id"
import { describePayout, type PayoutDetails } from "@/lib/payout"
import { SelectMenu } from "@/components/ui/select-menu"

/**
 * The redemptions list: filters, a bulk bar, and a row per order.
 *
 * Payout details are folded away behind an expander. They used to be in the
 * row itself — the destination address, every wallet the buyer has on file,
 * which of them was used — so a list of twenty orders was a page of
 * forty-character strings and no two rows were the same height. The list is
 * for finding the order; the expander is for paying it out.
 *
 * Split from the page so it can be rendered without a database behind it:
 * everything here is given, nothing is fetched.
 */

export type Redemption = {
  id: string
  user_id: string
  item_id: string
  item_name: string
  cost: number
  status: string
  created_at: string
}

export type Wallet = { crypto: string | null; chain: string | null; address: string }

export const STATUSES = [
  { id: "pending", label: "Pending", accent: "amber" as const },
  { id: "completed", label: "Completed", accent: "green" as const },
  { id: "cancelled", label: "Cancelled", accent: "red" as const },
]

/** Header cells, so the header and the body cannot fall out of step. */
const COLUMNS = ["ID", "User", "Item", "Payout", "Status", "Cost", "Created"]
/** The seven above, plus the expander, the checkbox and the actions cell. */
const COLSPAN = COLUMNS.length + 3

export const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

export const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

function statusMeta(status: string) {
  return STATUSES.find((entry) => entry.id === status) ?? { id: status, label: status, accent: "slate" as const }
}

/** The address or username a payout actually goes to, if there is one. */
function destinationOf(details: PayoutDetails | undefined): string | null {
  if (!details) return null
  return details.method === "crypto" ? details.address : details.username
}

function toggle(set: Set<string>, id: string) {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function RedemptionsList({
  rows,
  total,
  users,
  payouts,
  wallets,
  loading,
  query,
  onQuery,
  status,
  onStatus,
  selected,
  onSelected,
  expanded,
  onExpanded,
  onSetStatus,
}: {
  /** Already filtered — what is on screen. */
  rows: Redemption[]
  /** How many exist in total, to tell "nothing yet" from "nothing matches". */
  total: number
  users: Map<string, string>
  payouts: Record<string, PayoutDetails>
  wallets: Record<string, Wallet[]>
  loading: boolean
  query: string
  onQuery: (value: string) => void
  status: string
  onStatus: (value: string) => void
  selected: Set<string>
  onSelected: (next: Set<string>) => void
  expanded: Set<string>
  onExpanded: (next: Set<string>) => void
  onSetStatus: (ids: string[], status: string) => void
}) {
  /*
    What a bulk action would apply to.

    Intersected with what is on screen rather than taken from the selection as
    it stands. A row that was ticked and then filtered out is not something
    the button in front of you says it is about to change.
  */
  const actionable = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected])
  const allVisibleSelected = rows.length > 0 && actionable.length === rows.length

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search item or user…"
            className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
          />
        </div>
        <div className="w-44">
          <SelectMenu
            aria-label="Filter by status"
            value={status}
            onChange={onStatus}
            options={[{ value: "all", label: "Any status" }, ...STATUSES.map((e) => ({ value: e.id, label: e.label }))]}
          />
        </div>
        <MonoLabel className="text-white/25">{rows.length}</MonoLabel>
      </div>

      {/*
        Only once something is ticked, and it says the count out loud. A bar
        that is always there is a bar that is ignored, and these two buttons
        change rows that are not all on screen at once.
      */}
      {actionable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <MonoLabel className="text-white/50">{actionable.length} selected</MonoLabel>
          <button
            type="button"
            onClick={() => onSetStatus(actionable.map((row) => row.id), "completed")}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition"
            style={{ borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }}
          >
            <Check className="h-3 w-3" />
            Complete
          </button>
          <button
            type="button"
            onClick={() => onSetStatus(actionable.map((row) => row.id), "cancelled")}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition"
            style={{ borderColor: `${ACCENTS.red}55`, color: ACCENTS.red }}
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSelected(new Set())}
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-white/30 transition hover:text-white/70"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <MonoLabel className="text-white/25">Loading</MonoLabel>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <Package className="h-7 w-7 text-white/10" />
          <p className="text-[13px] text-white/30">
            {total === 0 ? "Nothing redeemed yet." : "Nothing matches those filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="w-9" />
                <th className="w-9 px-2 py-2.5">
                  <Tick
                    checked={allVisibleSelected}
                    onChange={() => onSelected(allVisibleSelected ? new Set() : new Set(rows.map((row) => row.id)))}
                    label="Select every row on screen"
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th key={column} className="px-2 py-2.5">
                    <MonoLabel className="text-white/35">{column}</MonoLabel>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-right">
                  <MonoLabel className="text-white/35">Actions</MonoLabel>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const meta = statusMeta(row.status)
                const username = users.get(row.user_id)
                const done = row.status === "completed"
                const isOpen = expanded.has(row.id)
                const details = payouts[row.id]

                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`border-b border-white/[0.05] transition ${isOpen ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}
                    >
                      <td className="px-1">
                        <button
                          type="button"
                          onClick={() => onExpanded(toggle(expanded, row.id))}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Hide" : "Show"} payout details for ${row.item_name}`}
                          className="flex h-7 w-7 items-center justify-center rounded text-white/30 transition hover:bg-white/[0.06] hover:text-white/80"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </td>

                      <td className="px-2">
                        <Tick
                          checked={selected.has(row.id)}
                          onChange={() => onSelected(toggle(selected, row.id))}
                          label={`Select ${row.item_name}`}
                        />
                      </td>

                      <td className="px-2 py-2">
                        <CopyableId value={row.id} chars={4} />
                      </td>

                      <td className="max-w-40 px-2 py-2">
                        {username ? (
                          <Link
                            href={`/admin/users/${row.user_id}`}
                            className="block truncate text-[12.5px] text-white/80 underline-offset-4 hover:text-white hover:underline"
                          >
                            {username}
                          </Link>
                        ) : (
                          <CopyableId value={row.user_id} chars={4} />
                        )}
                      </td>

                      <td className="max-w-56 px-2 py-2">
                        <span className="block truncate text-[12.5px] text-white">{row.item_name}</span>
                      </td>

                      <td className="px-2 py-2">
                        <span className="text-[12px] text-white/50">{describePayout(details ?? null)}</span>
                      </td>

                      <td className="px-2 py-2">
                        <Tag accent={meta.accent}>{meta.label}</Tag>
                      </td>

                      <td className="px-2 py-2 text-[12.5px] tabular-nums" style={{ color: ACCENTS.blue }}>
                        {points(row.cost)}
                      </td>

                      <td className="px-2 py-2">
                        <MonoLabel className="whitespace-nowrap text-white/25">{when(row.created_at)}</MonoLabel>
                      </td>

                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSetStatus([row.id], done ? "pending" : "completed")}
                            aria-label={done ? `Reopen ${row.item_name}` : `Complete ${row.item_name}`}
                            className="rounded p-1.5 transition hover:bg-white/[0.06]"
                            style={{ color: done ? ACCENTS.green : "rgba(255,255,255,0.3)" }}
                          >
                            {done ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          {row.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => onSetStatus([row.id], "cancelled")}
                              aria-label={`Cancel ${row.item_name}`}
                              className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-b border-white/[0.05] bg-black/20">
                        <td colSpan={COLSPAN} className="px-4 py-3">
                          <Details
                            row={row}
                            username={username}
                            details={details}
                            wallets={wallets[row.user_id] ?? []}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/**
 * Everything needed to actually pay one out.
 *
 * Nothing is truncated here. The row above is for finding the order; this is
 * what gets read while money is being sent, and an address with its middle
 * missing is worse than no address at all.
 */
function Details({
  row,
  username,
  details,
  wallets,
}: {
  row: Redemption
  username: string | undefined
  details: PayoutDetails | undefined
  wallets: Wallet[]
}) {
  const destination = destinationOf(details)

  return (
    <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
      <Field label="Username">
        {username ? (
          <span className="flex items-center gap-1.5">
            <span className="text-[12.5px] text-white">{username}</span>
            {/* Paying someone out means pasting their exact name somewhere
                else; picking it out by hand is one mistyped character away
                from the wrong person. */}
            <CopyButton value={username} label="username" />
          </span>
        ) : (
          <CopyableId value={row.user_id} chars={6} />
        )}
      </Field>

      <Field label="Item">
        <span className="text-[12.5px] text-white">{row.item_name}</span>
      </Field>

      <Field label="Payout method">
        <span className="text-[12.5px]" style={{ color: ACCENTS.purple }}>
          {describePayout(details ?? null)}
        </span>
      </Field>

      <Field label="Cost">
        <span className="text-[12.5px] tabular-nums" style={{ color: ACCENTS.blue }}>
          {points(row.cost)} points
        </span>
      </Field>

      <Field label={details?.method === "crypto" ? "Destination address" : "Destination"}>
        {destination ? (
          <span className="flex items-start gap-1.5">
            <span className="break-all font-mono text-[11px] text-white/80">{destination}</span>
            <CopyButton value={destination} label="payout destination" />
          </span>
        ) : (
          <span className="text-[12.5px] text-white/30">Nothing was asked for</span>
        )}
      </Field>

      <Field label="Redemption ID">
        <CopyableId value={row.id} chars={8} />
      </Field>

      <Field label="Created">
        <span className="text-[12.5px] text-white/60">{when(row.created_at)}</span>
      </Field>

      {/*
        What this buyer has on their profile.

        Paying someone out used to mean opening their profile in another tab
        to see whether the address typed at checkout was one they had held for
        a while or one that appeared at the moment of purchase. The match is
        marked, so the difference is visible without comparing two strings of
        forty characters by eye.
      */}
      {wallets.length > 0 && (
        <div className="sm:col-span-2">
          <MonoLabel className="text-white/25">Wallets on file</MonoLabel>
          <div className="mt-1 space-y-1">
            {wallets.map((wallet) => {
              const used =
                details?.method === "crypto" &&
                details.address.trim().toLowerCase() === wallet.address.trim().toLowerCase()
              return (
                <p
                  key={`${wallet.crypto}-${wallet.chain}-${wallet.address}`}
                  className="flex flex-wrap items-start gap-1.5"
                >
                  <MonoLabel style={{ color: used ? ACCENTS.green : "rgba(255,255,255,0.3)" }}>
                    {wallet.crypto ?? "?"}
                    {wallet.chain ? ` · ${wallet.chain}` : ""}
                  </MonoLabel>
                  <span className="break-all font-mono text-[11px] text-white/45">{wallet.address}</span>
                  <CopyButton value={wallet.address} label="saved wallet address" />
                  {used && (
                    <span className="shrink-0 font-mono text-[10px]" style={{ color: ACCENTS.green }}>
                      used
                    </span>
                  )}
                </p>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <MonoLabel className="text-white/25">{label}</MonoLabel>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/** A checkbox that matches the panel rather than the browser's own. */
function Tick({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="flex h-4 w-4 items-center justify-center rounded border transition"
      style={
        checked ? { borderColor: ACCENTS.blue, backgroundColor: ACCENTS.blue } : { borderColor: "rgba(255,255,255,0.2)" }
      }
    >
      {checked && <Check className="h-3 w-3 text-[#0B0B0D]" />}
    </button>
  )
}
