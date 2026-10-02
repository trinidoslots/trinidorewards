"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Info, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, Tag } from "@/components/ui/panel"
import { FIELD_CLASS } from "@/components/ui/select-menu"
import { SCHEDULE_INFO_KEY, rawScheduleInfo } from "@/lib/schedule-info"
import { siteHref } from "@/lib/site-url"

/**
 * The info text shown above the public schedule.
 *
 * A title and a few lines, saved to `settings` (schedule_info) with the
 * admin's own session, which has full access there. Clearing the text hides
 * the box on the site. Visitors can fold it away; a changed text opens again
 * for them.
 */
export function ScheduleInfoEditor() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [saved, setSaved] = useState<{ title: string; text: string }>({ title: "", text: "" })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await createClient().from("settings").select("value").eq("key", SCHEDULE_INFO_KEY).maybeSingle()
      const current = rawScheduleInfo(data?.value)
      setTitle(current.title)
      setText(current.text)
      setSaved(current)
    })()
  }, [])

  const live = saved.text.trim().length > 0
  const changed = title !== saved.title || text !== saved.text

  async function save(next: { title: string; text: string }) {
    setBusy(true)
    setMessage(null)
    const { error } = await createClient()
      .from("settings")
      .upsert(
        { key: SCHEDULE_INFO_KEY, value: JSON.stringify({ title: next.title.trim(), text: next.text.trim() }), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      )
    setBusy(false)
    if (error) {
      setMessage({ tone: "error", text: error.message || "Could not save the info text." })
      return
    }
    setSaved({ title: next.title.trim(), text: next.text.trim() })
    setTitle(next.title.trim())
    setText(next.text.trim())
    setMessage({
      tone: "ok",
      text: next.text.trim() ? "Saved. It shows above the schedule." : "Cleared. Nothing shows above the schedule.",
    })
  }

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <Info className="h-4 w-4" style={{ color: ACCENTS.purple }} />
        <span className="text-[13.5px] font-semibold text-white">Info text</span>
        {live ? <Tag accent="green">Showing</Tag> : <Tag accent="slate">Off</Tag>}
        {live && !open && <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/40">{saved.title || saved.text}</span>}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="space-y-3 border-t border-white/[0.06] p-4">
              <p className="text-[12.5px] leading-relaxed text-white/45">
                Shown above the week on{" "}
                <a href={siteHref("/schedule")} target="_blank" rel="noopener noreferrer" className="text-white/70 underline underline-offset-2">
                  the schedule
                </a>
                , where visitors can open and fold it. Leave the text empty to hide it.
              </p>
              <label className="block">
                <MonoLabel className="mb-1.5 block text-white/40">Title</MonoLabel>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Good to know"
                  maxLength={80}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <MonoLabel className="mb-1.5 block text-white/40">Text</MonoLabel>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={4}
                  maxLength={1200}
                  placeholder="Streams can start up to 30 minutes late. Times are in your own timezone."
                  className={`${FIELD_CLASS} h-auto resize-y py-2 leading-relaxed`}
                />
              </label>

              {message && (
                <p className="text-[12.5px]" style={{ color: message.tone === "ok" ? ACCENTS.green : ACCENTS.red }}>
                  {message.text}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void save({ title, text })}
                  disabled={busy || !changed}
                  className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-[12.5px] font-bold text-black transition hover:brightness-110 disabled:opacity-40"
                  style={{ backgroundColor: ACCENTS.green }}
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </button>
                {live && (
                  <button
                    type="button"
                    onClick={() => void save({ title: "", text: "" })}
                    disabled={busy}
                    className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 text-[12.5px] font-semibold text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                  >
                    Remove from the schedule
                  </button>
                )}
                <span className="ml-auto text-[11.5px] tabular-nums text-white/30">{text.length}/1200</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
