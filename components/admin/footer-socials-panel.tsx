"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"
import { SocialGlyph } from "@/components/social-glyph"
import {
  MAX_SOCIALS,
  SOCIAL_PLATFORMS,
  cleanSocialUrl,
  type SocialLink,
  type SocialPlatform,
} from "@/lib/site-socials"

/**
 * Edits the social icons in the site footer: which platforms, where each one
 * leads, their order, and whether each is shown. Saved through
 * /api/admin/socials; the footer reads /api/socials.
 */

const field =
  "h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[13px] text-white outline-none transition focus:border-white/25"

const iconButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-white/45 transition hover:bg-white/[0.05] hover:text-white disabled:pointer-events-none disabled:opacity-25"

export function FooterSocialsPanel() {
  const [links, setLinks] = useState<SocialLink[] | null>(null)
  const [saved, setSaved] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/admin/socials", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const list = Array.isArray(json?.links) ? (json.links as SocialLink[]) : []
        setLinks(list)
        setSaved(JSON.stringify(list))
      })
      .catch(() => setNotice({ ok: false, text: "Could not load the footer links." }))
  }, [])

  const update = (index: number, patch: Partial<SocialLink>) => {
    setNotice(null)
    setLinks((current) => current && current.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  }

  const move = (index: number, by: -1 | 1) => {
    setNotice(null)
    setLinks((current) => {
      if (!current) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })
  }

  const remove = (index: number) => {
    setNotice(null)
    setLinks((current) => current && current.filter((_, i) => i !== index))
  }

  const add = () => {
    setNotice(null)
    setLinks((current) => {
      const list = current ?? []
      const used = new Set(list.map((link) => link.platform))
      const platform = (Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]).find((p) => !used.has(p)) ?? "website"
      return [...list, { platform, url: "", visible: true }]
    })
  }

  const invalid = (links ?? []).map((link) => !cleanSocialUrl(link.url))
  const dirty = links !== null && JSON.stringify(links) !== saved

  async function save() {
    if (!links) return
    if (invalid.some(Boolean)) {
      setNotice({ ok: false, text: "Every link needs an https address." })
      return
    }
    setSaving(true)
    setNotice(null)
    const res = await fetch("/api/admin/socials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setNotice({ ok: false, text: json.error ?? "Could not save." })
      return
    }
    const clean = json.links as SocialLink[]
    setLinks(clean)
    setSaved(JSON.stringify(clean))
    setNotice({ ok: true, text: "Saved. The footer shows it within a minute." })
  }

  return (
    <Panel>
      <PanelHeader
        title="Footer socials"
        accent="blue"
        right={<MonoLabel className="text-white/30">{links ? `${links.filter((l) => l.visible).length} shown` : ""}</MonoLabel>}
      />
      <div className="space-y-2 p-3.5">
        <p className="text-[12px] text-white/35">
          The icons at the bottom of every page. Order here is the order there; hidden ones stay saved.
        </p>

        {links === null ? (
          <p className="py-4 text-center font-mono text-[11px] uppercase tracking-widest text-white/25">Loading</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.10] ${
                    link.visible ? "text-white/70" : "text-white/20"
                  }`}
                >
                  <SocialGlyph platform={link.platform} />
                </span>
                <select
                  value={link.platform}
                  onChange={(event) => update(index, { platform: event.target.value as SocialPlatform })}
                  className={`${field} w-32 shrink-0 cursor-pointer`}
                  aria-label="Platform"
                >
                  {(Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]).map((platform) => (
                    <option key={platform} value={platform} className="bg-[#16161A]">
                      {SOCIAL_PLATFORMS[platform].label}
                    </option>
                  ))}
                </select>
                <input
                  value={link.url}
                  onChange={(event) => update(index, { url: event.target.value })}
                  placeholder={SOCIAL_PLATFORMS[link.platform].placeholder}
                  aria-label="Link"
                  aria-invalid={invalid[index] && link.url !== ""}
                  className={`${field} min-w-0 flex-1 basis-48 font-mono text-[12px]`}
                  style={invalid[index] && link.url !== "" ? { borderColor: `${ACCENTS.red}99` } : undefined}
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => update(index, { visible: !link.visible })}
                    className={iconButton}
                    title={link.visible ? "Shown — click to hide" : "Hidden — click to show"}
                    aria-pressed={link.visible}
                  >
                    {link.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className={iconButton} title="Move up (earlier in the footer)">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === links.length - 1}
                    className={iconButton}
                    title="Move down (later in the footer)"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className={`${iconButton} hover:text-[#E5484D]`}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {links.length === 0 && <li className="py-3 text-center text-[12px] text-white/30">No socials — the footer shows none.</li>}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={add}
            disabled={!links || links.length >= MAX_SOCIALS}
            className="flex h-9 items-center gap-1.5 rounded-md border border-white/12 px-3 text-[12px] text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add link
          </button>
          {notice && (
            <span className="text-[12px]" style={{ color: notice.ok ? ACCENTS.green : ACCENTS.red }}>
              {notice.text}
            </span>
          )}
          <button
            type="button"
            data-admin-edit
            onClick={save}
            disabled={saving || !dirty}
            className="ml-auto h-9 rounded-md border border-white/12 bg-white/[0.06] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12] disabled:opacity-40"
          >
            {saving ? "Saving" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>
    </Panel>
  )
}
