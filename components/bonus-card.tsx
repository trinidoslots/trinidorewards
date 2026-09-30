import Link from "next/link"
import { ExternalLink, Gift } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, Tag } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"

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

export function BonusCard({ bonus }: { bonus: Bonus }) {
  return (
    <Panel accent={bonus.featured ? "amber" : "blue"} className="lift flex h-full flex-col overflow-hidden">
      {bonus.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- casino artwork from any host
        <img src={bonus.image_url} alt="" className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-white/[0.02]">
          <Gift className="h-8 w-8 text-white/10" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold text-white">{bonus.title}</h3>
            {bonus.casino_name && <MonoLabel className="text-white/25">{bonus.casino_name}</MonoLabel>}
          </div>
          {bonus.featured && <Tag accent="amber">Featured</Tag>}
        </div>

        {bonus.value && (
          <p className="text-[17px] font-semibold" style={{ color: ACCENTS.green }}>
            {bonus.value}
          </p>
        )}

        {bonus.description && <p className="line-clamp-3 text-[12px] text-white/35">{bonus.description}</p>}

        <div className="mt-auto space-y-2 border-t border-white/[0.06] pt-2.5">
          {bonus.code && (
            <div className="flex items-center justify-between gap-2">
              <MonoLabel className="text-white/25">Code</MonoLabel>
              {/* Click to copy — a code you have to select by hand is the one
                  thing on this card that has to be exact. */}
              <CopyableId value={bonus.code} chars={12} />
            </div>
          )}

          {bonus.casino_url && (
            <Link
              href={bonus.casino_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] text-black transition"
              style={{ backgroundColor: ACCENTS.blue }}
            >
              Claim
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}

          {bonus.terms && <p className="line-clamp-2 text-[10.5px] leading-snug text-white/20">{bonus.terms}</p>}
        </div>
      </div>
    </Panel>
  )
}
