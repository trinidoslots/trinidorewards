"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, User, UserCheck } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

export type UserPick = {
  id: string
  username: string
  kick_id: string | null
  avatar_url: string | null
  /** Their usernames on casino sites, from Profile > Settings. */
  casinos: { site_name: string; username: string }[]
}

/**
 * User picker: type part of a name, pick a site account.
 *
 * The same shape as the slot picker (components/admin/slot-combobox.tsx):
 * searched as you type, avatar on the left, and on the right what tells two
 * similar names apart — the Kick ID and the start of the site ID. The
 * casino usernames people saved on their profile show underneath, the one
 * for `casino` first.
 *
 * Free text still works, for a player without an account: typing clears the
 * picked account, so a name and an account can never disagree.
 */
export function UserCombobox({
  value,
  picked,
  onChange,
  casino,
  placeholder = "Search users...",
  id,
}: {
  value: string
  /** The account the current name came from, if it was picked from the list. */
  picked: UserPick | null
  onChange: (name: string, user: UserPick | null) => void
  /** The tournament's casino, so the matching casino username is listed first. */
  casino?: string | null
  placeholder?: string
  id?: string
}) {
  const [matches, setMatches] = useState<UserPick[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createBrowserClient())

  useEffect(() => {
    const needle = value.trim()
    if (!open || needle.length < 2 || picked) {
      setMatches([])
      return
    }
    let cancelled = false
    setBusy(true)
    const timer = setTimeout(async () => {
      const escaped = needle.replace(/[%_\\]/g, (c) => `\\${c}`)
      const { data, error } = await supabaseRef.current
        .from("users")
        .select("id, username, kick_id, avatar_url")
        .ilike("username", `%${escaped}%`)
        .order("username")
        .limit(10)
      if (cancelled) return
      if (error) {
        console.error("[v0] Could not search users:", error)
        setBusy(false)
        return
      }
      const users = (data ?? []) as Omit<UserPick, "casinos">[]
      // Their casino usernames, in one query for the whole list.
      const ids = users.map((user) => user.id)
      const { data: accounts } = ids.length
        ? await supabaseRef.current.from("user_site_usernames").select("user_id, site_name, username").in("user_id", ids)
        : { data: [] }
      if (cancelled) return
      const lower = needle.toLowerCase()
      const rows: UserPick[] = users
        .map((user) => ({
          ...user,
          kick_id: user.kick_id != null ? String(user.kick_id) : null,
          casinos: ((accounts ?? []) as { user_id: string; site_name: string; username: string }[])
            .filter((account) => account.user_id === user.id)
            .map(({ site_name, username }) => ({ site_name, username })),
        }))
        // Names that start with what was typed first, then exact matches above those.
        .sort(
          (a, b) =>
            Number(a.username.toLowerCase() !== lower) - Number(b.username.toLowerCase() !== lower) ||
            Number(!a.username.toLowerCase().startsWith(lower)) - Number(!b.username.toLowerCase().startsWith(lower)),
        )
      setBusy(false)
      setMatches(rows)
      setHighlight(0)
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, open, picked])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  function pick(user: UserPick) {
    onChange(user.username, user)
    setOpen(false)
  }

  const casinoFirst = (list: UserPick["casinos"]) =>
    [...list].sort(
      (a, b) =>
        Number(a.site_name.toLowerCase() !== (casino ?? "").toLowerCase()) -
        Number(b.site_name.toLowerCase() !== (casino ?? "").toLowerCase()),
    )

  const Icon = busy ? Loader2 : picked ? UserCheck : User

  return (
    <div ref={boxRef} className="relative">
      <Icon
        className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
          busy ? "animate-spin text-white/30" : picked ? "text-[#46C48A]" : "text-white/25"
        }`}
      />
      <input
        id={id}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value, null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open || matches.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlight((index) => (index + 1) % matches.length)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlight((index) => (index - 1 + matches.length) % matches.length)
          } else if (event.key === "Enter") {
            event.preventDefault()
            pick(matches[highlight])
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
        className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
        style={picked ? { borderColor: "rgba(70,196,138,0.45)" } : undefined}
      />
      {picked && (
        <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-white/35">
          Linked · Kick {picked.kick_id ?? "—"} · ID {picked.id.slice(0, 8)}
        </p>
      )}

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full min-w-[300px] overflow-auto rounded-md border border-white/[0.10] bg-[#121216] py-1 shadow-xl shadow-black/60">
          {matches.map((user, index) => {
            const casinos = casinoFirst(user.casinos)
            return (
              <li key={user.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(user)}
                  className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[13px] transition ${
                    index === highlight ? "bg-white/[0.07] text-white" : "text-white/70"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-white/[0.03]">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Kick avatar
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[12px] font-bold text-white/40">{user.username.slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{user.username}</span>
                    {casinos.length > 0 && (
                      <span className="block truncate text-[11px] text-white/35">
                        {casinos.map((account) => `${account.site_name}: ${account.username}`).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="ml-auto shrink-0 text-right font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-white/30">
                    <span className="block">Kick {user.kick_id ?? "—"}</span>
                    <span className="block text-white/20">ID {user.id.slice(0, 8)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
