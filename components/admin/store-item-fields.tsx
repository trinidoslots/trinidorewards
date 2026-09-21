"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { PAYOUT_METHODS } from "@/lib/payout"
import { STORE_IMAGE_GROUPS, isBundledImage } from "@/lib/store-images"
import { SelectMenu } from "@/components/ui/select-menu"

/**
 * The two store-item fields that the add and edit forms share.
 *
 * Shared rather than copied because they disagreeing is the failure mode: an
 * item created with a payout method and then edited on a form that does not
 * know about the field would silently lose it.
 */

/** What the buyer is asked for before the purchase goes through. */
export function PayoutMethodField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const hint = PAYOUT_METHODS.find((entry) => entry.id === value)?.hint

  return (
    <div>
      <Label htmlFor="payout_method" className="text-white/60">
        Payout method
      </Label>
      <SelectMenu
        id="payout_method"
        aria-label="Payout method"
        value={value}
        onChange={onChange}
        options={[
          { value: "", label: "No details needed", hint: "Buying is a single click" },
          ...PAYOUT_METHODS.map((entry) => ({ value: entry.id, label: entry.label, hint: entry.hint })),
        ]}
      />
      <p className="mt-1 text-xs text-white/40">
        {hint ?? "Buying is a single click — nothing is asked for."}
      </p>
    </div>
  )
}

/**
 * Picks one of the bundled card images, or takes a URL for anything else.
 *
 * The URL box stays: the column has always held arbitrary URLs, and items
 * created before these images existed still point at one.
 */
export function StoreImageField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Label className="text-white/60">Image</Label>

      <div className="mt-2 space-y-3">
        {STORE_IMAGE_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">{group.label}</p>
            <div className="grid grid-cols-4 gap-2">
              {group.images.map((image) => {
                const selected = value === image.path
                return (
                  <button
                    key={image.path}
                    type="button"
                    onClick={() => onChange(selected ? "" : image.path)}
                    title={image.path}
                    aria-pressed={selected}
                    className="overflow-hidden rounded-md border transition"
                    style={{
                      borderColor: selected ? "#5B8DEF" : "rgba(255,255,255,0.08)",
                      boxShadow: selected ? "0 0 0 1px #5B8DEF" : undefined,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static path under /public */}
                    <img src={image.path} alt={image.label} className="aspect-[8/5] w-full object-contain" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Input
        value={isBundledImage(value) ? "" : value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 bg-white/[0.06] border-white/[0.10] text-white"
        placeholder={isBundledImage(value) ? "Using the selected card above" : "…or paste an image URL"}
      />
    </div>
  )
}
