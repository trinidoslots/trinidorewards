"use client"

import { MonoLabel } from "@/components/ui/panel"
import { FIELD_CLASS } from "@/components/ui/select-menu"
import { CARD_ASPECT, isBundledCard, type CardImageGroup } from "@/lib/card-images"

/**
 * Picks one of the bundled cards, or takes a URL for anything else.
 *
 * The URL box stays because these columns have always held arbitrary URLs and
 * rows created before the artwork existed still point at one. Selecting a card
 * blanks it; clicking the selected card again clears the choice.
 *
 * Styled with the board's own field classes rather than the shadcn ones, so it
 * sits in the admin forms it is used from. StoreImageField does the same job for
 * store items with shadcn inputs — worth folding together if a third caller
 * appears, not worth touching two working forms for a second.
 */
export function CardImageField({
  label = "Image",
  hint,
  groups,
  value,
  onChange,
}: {
  label?: string
  hint?: string
  groups: CardImageGroup[]
  value: string
  onChange: (value: string) => void
}) {
  const bundled = isBundledCard(groups, value)

  return (
    <div>
      <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.id}>
            {groups.length > 1 && (
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
                {group.label}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {group.images.map((image) => {
                const selected = value === image.path
                return (
                  <button
                    key={image.path}
                    type="button"
                    onClick={() => onChange(selected ? "" : image.path)}
                    title={image.label}
                    aria-pressed={selected}
                    aria-label={image.label}
                    className="overflow-hidden rounded-md border transition"
                    style={{
                      borderColor: selected ? "#5B8DEF" : "rgba(255,255,255,0.08)",
                      boxShadow: selected ? "0 0 0 1px #5B8DEF" : undefined,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static path under /public */}
                    <img
                      src={image.path}
                      alt={image.label}
                      className={`${CARD_ASPECT} w-full object-contain`}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <input
        value={bundled ? "" : value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_CLASS} mt-2.5`}
        placeholder={bundled ? "Using the card above" : "…or paste an image URL"}
      />
      {hint && <p className="mt-1 text-[11px] text-white/25">{hint}</p>}
    </div>
  )
}
