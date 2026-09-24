"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Bell, ChevronRight, Eye, Home, Package, Search } from "lucide-react"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { NAV } from "@/components/admin-sidebar"
import { MENU_CLASS, MENU_ITEM_CLASS, UserMenu } from "@/components/top-bar-parts"
import { createClient } from "@/lib/supabase/client"

/**
 * The admin panel's top bar: where you are, a way to jump anywhere, whether
 * the stream is live, what is waiting on you, and who is signed in.
 */

const CHANNEL = "trinidoslots"
const KICK_GREEN = "#53FC18"

type Page = { href: string; label: string; section: string | null }

/** Every page the sidebar links to, flattened, with the group it sits in. */
const PAGES: Page[] = NAV.flatMap<Page>((item) =>
  item.kind === "link"
    ? [{ href: item.href, label: item.label, section: null }]
    : item.children.map((child) => ({ href: child.href, label: child.label, section: item.label })),
)

/** The page for a path: an exact match, else the longest one it sits under. */
function pageFor(pathname: string): Page | null {
  const exact = PAGES.find((page) => page.href === pathname)
  if (exact) return exact
  return (
    PAGES.filter((page) => page.href !== "/admin" && pathname.startsWith(`${page.href}/`)).sort(
      (a, b) => b.href.length - a.href.length,
    )[0] ?? null
  )
}

function Breadcrumb() {
  const pathname = usePathname()
  const page = pageFor(pathname)

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <Link href="/admin" aria-label="Overview" className="text-white/40 transition hover:text-white">
        <Home className="h-4 w-4" />
      </Link>
      {page?.section && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
          <span className="truncate text-white/40">{page.section}</span>
        </>
      )}
      {page && page.href !== "/admin" && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
          <span className="truncate font-semibold text-white">{page.label}</span>
        </>
      )}
    </nav>
  )
}

/** Ctrl/Cmd+K, or the box in the middle of the bar: jump to any admin page by name. */
function PageSearch() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const sections = useMemo(() => {
    const grouped = new Map<string, Page[]>()
    for (const page of PAGES) {
      const key = page.section ?? "Pages"
      grouped.set(key, [...(grouped.get(key) ?? []), page])
    }
    return Array.from(grouped.entries())
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-[420px] items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white/35 transition hover:border-white/[0.16] hover:text-white/60"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate text-left">Search pages…</span>
        <kbd className="hidden rounded border border-white/[0.10] px-1.5 py-0.5 font-mono text-[10px] text-white/40 sm:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search admin pages"
        description="Jump to any page in the admin panel."
        className="border-white/[0.10] bg-[#0E0E11] text-white sm:max-w-lg"
      >
        <CommandInput placeholder="Search pages…" className="text-white placeholder:text-white/30" />
        <CommandList className="max-h-[360px]">
          <CommandEmpty className="py-6 text-center text-[13px] text-white/40">No page by that name.</CommandEmpty>
          {sections.map(([section, pages]) => (
            <CommandGroup key={section} heading={section}>
              {pages.map((page) => (
                <CommandItem
                  key={page.href}
                  value={`${page.section ?? ""} ${page.label}`}
                  onSelect={() => {
                    setOpen(false)
                    router.push(page.href)
                  }}
                  className="cursor-pointer rounded-md px-2.5 py-2 text-[13px] text-white/70 data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white"
                >
                  {page.label}
                  <span className="ml-auto font-mono text-[10px] text-white/25">{page.href}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}

/** Whether the channel is live, and how many are watching. From the proxy the overlays already use. */
function LiveStatus() {
  const [state, setState] = useState<{ live: boolean; viewers: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch(`/api/kick/followers?slug=${CHANNEL}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!cancelled && data) setState({ live: !!data.live, viewers: Number(data.viewers) || 0 })
        })
        .catch(() => {})
    void load()
    const poll = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [])

  if (!state) return null

  return (
    <a
      href={`https://kick.com/${CHANNEL}`}
      target="_blank"
      rel="noreferrer"
      className="hidden h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-semibold transition hover:border-white/[0.16] md:flex"
      title={state.live ? "Live on Kick" : "Offline"}
    >
      <span
        className={`h-2 w-2 rounded-full ${state.live ? "animate-pulse" : ""}`}
        style={{ backgroundColor: state.live ? KICK_GREEN : "rgba(255,255,255,0.25)" }}
      />
      {state.live ? (
        <>
          <span style={{ color: ACCENTS.red }}>LIVE</span>
          <span className="flex items-center gap-1 text-white/60">
            <Eye className="h-3.5 w-3.5" />
            {state.viewers.toLocaleString("en-US")}
          </span>
        </>
      ) : (
        <span className="text-white/40">Offline</span>
      )}
    </a>
  )
}

type PendingRedemption = { id: string; item_name: string; created_at: string }

/** The admin's bell: store redemptions waiting to be paid out. */
function AdminBell() {
  const [pending, setPending] = useState<PendingRedemption[]>([])
  const [count, setCount] = useState(0)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const load = async () => {
      const { data, count: total } = await supabaseRef.current
        .from("redemptions")
        .select("id, item_name, created_at", { count: "exact" })
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(8)
      setPending((data ?? []) as PendingRedemption[])
      setCount(total ?? (data ?? []).length)
    }
    void load()
    const poll = setInterval(() => void load(), 60_000)
    return () => clearInterval(poll)
  }, [])

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 outline-none transition hover:border-white/[0.16] hover:text-white data-[state=open]:text-white"
        aria-label={count ? `${count} redemptions waiting` : "Nothing waiting"}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: ACCENTS.red }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className={`${MENU_CLASS} w-[300px] p-0`}>
        <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-white">Waiting on you</span>
          <MonoLabel className="text-white/35">{count} pending</MonoLabel>
        </div>
        {pending.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12px] text-white/35">No redemptions waiting.</p>
        ) : (
          <div className="p-1">
            {pending.map((row) => (
              <DropdownMenuItem key={row.id} asChild className={MENU_ITEM_CLASS}>
                <Link href="/admin/store/redemptions">
                  <Package className="h-4 w-4" style={{ color: ACCENTS.amber }} />
                  <span className="min-w-0 flex-1 truncate">{row.item_name}</span>
                  <span className="shrink-0 text-[11px] text-white/30">
                    {new Date(row.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <div className="border-t border-white/[0.08] p-1">
          <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
            <Link href="/admin/store/redemptions">Open redemptions</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Signed in as: the Kick name and picture stored on the admin session at login. */
function useAdminIdentity() {
  const [identity, setIdentity] = useState<{ username: string; avatarUrl: string | null } | null>(null)
  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        const meta = data.user?.user_metadata ?? {}
        setIdentity({
          username: typeof meta.kick_username === "string" ? meta.kick_username : "Admin",
          avatarUrl: typeof meta.avatar_url === "string" && meta.avatar_url ? meta.avatar_url : null,
        })
      })
  }, [])
  return identity
}

export function AdminTopBar() {
  const identity = useAdminIdentity()

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-white/[0.08] bg-[#0B0B0D]/95 px-5 backdrop-blur">
      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>
      <div className="hidden flex-1 justify-center lg:flex">
        <PageSearch />
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        <LiveStatus />
        <AdminBell />
        {identity && <UserMenu variant="admin" username={identity.username} avatarUrl={identity.avatarUrl} />}
      </div>
    </header>
  )
}
