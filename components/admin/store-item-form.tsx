"use client"

import type React from "react"
import Link from "next/link"
import { ArrowLeft, Coins, Infinity as InfinityIcon, Lock, Package } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, Tag } from "@/components/ui/panel"
import { SelectMenu } from "@/components/ui/select-menu"
import { PayoutMethodField, StoreImageField } from "@/components/admin/store-item-fields"
import { adminHref } from "@/lib/admin-host"

/**
 * The store item form, shared by Add item and Edit item so the two never
 * drift apart again (the edit page could not change the category, the
 * description or the one-per-user rule). Only the layout lives here; each
 * page keeps its own load and save.
 */

export type StoreItemValues = {
  name: string
  category: string
  description: string
  icon: string
  cost: string
  quantity: string
  type: string
  payout_method: string
  one_purchase_per_user: boolean
  code_user_only: boolean
  /** "true" | "false" — the column is text. Only shown when editing. */
  is_available: string
}

export const EMPTY_STORE_ITEM: StoreItemValues = {
  name: "",
  category: "Regular",
  description: "",
  icon: "",
  cost: "",
  quantity: "-1",
  type: "Digital",
  payout_method: "onsite_tip",
  one_purchase_per_user: false,
  code_user_only: false,
  is_available: "true",
}

const CATEGORIES = ["Regular", "Premium", "Limited"]
const TYPES = ["Digital", "Physical", "Service", "Bonus", "Other"]

const field =
  "h-9 w-full rounded-md border border-white/10 bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor}>
        <MonoLabel className="mb-1.5 block text-white/40">{label}</MonoLabel>
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-white/35">{hint}</p>}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 px-3 py-2.5 text-left transition hover:border-white/15"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-white">{title}</span>
        <span className="block text-[11.5px] text-white/35">{description}</span>
      </span>
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? ACCENTS.blue : "rgba(255,255,255,0.12)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: `translateX(${checked ? 18 : 2}px)` }}
        />
      </span>
    </button>
  )
}

function Preview({ values }: { values: StoreItemValues }) {
  const quantity = Number.parseInt(values.quantity)
  const unlimited = quantity === -1
  const cost = Number.parseInt(values.cost)
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/30">
      <div className="flex aspect-[8/5] items-center justify-center bg-white/[0.02]">
        {values.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- bundled path or pasted URL
          <img src={values.icon} alt="" className="h-full w-full object-contain" />
        ) : (
          <Package className="h-8 w-8 text-white/10" />
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {values.category && <Tag accent={values.category === "Limited" ? "amber" : values.category === "Premium" ? "purple" : "slate"}>{values.category}</Tag>}
          {values.type && <Tag>{values.type}</Tag>}
          {values.code_user_only && (
            <Tag accent="pink">
              <Lock className="mr-1 h-2.5 w-2.5" />
              Code users
            </Tag>
          )}
          {values.is_available === "false" && <Tag accent="red">Disabled</Tag>}
        </div>
        <p className="truncate text-[14px] font-medium text-white">{values.name || "Item name"}</p>
        {values.description && <p className="line-clamp-2 text-[12px] text-white/45">{values.description}</p>}
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold tabular-nums" style={{ color: ACCENTS.blue }}>
            <Coins className="h-3.5 w-3.5" />
            {Number.isFinite(cost) ? cost.toLocaleString() : "—"}
          </span>
          <MonoLabel className="flex items-center gap-1 text-white/35">
            {unlimited ? (
              <>
                <InfinityIcon className="h-3 w-3" /> In stock
              </>
            ) : Number.isFinite(quantity) ? (
              `${quantity} left`
            ) : (
              "—"
            )}
          </MonoLabel>
        </div>
        {values.one_purchase_per_user && <p className="text-[11px] text-white/30">One per player</p>}
      </div>
    </div>
  )
}

export function StoreItemForm({
  mode,
  values,
  onChange,
  onSubmit,
  submitting,
}: {
  mode: "add" | "edit"
  values: StoreItemValues
  onChange: (values: StoreItemValues) => void
  onSubmit: (event: React.FormEvent) => void
  submitting: boolean
}) {
  const set = <K extends keyof StoreItemValues>(key: K, value: StoreItemValues[K]) => onChange({ ...values, [key]: value })
  const unlimited = values.quantity === "-1"

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <header>
        <Link
          href={adminHref("/admin/store")}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/35 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Store
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">{mode === "add" ? "Add item" : "Edit item"}</h1>
        <p className="mt-1 text-[13px] text-white/40">
          {mode === "add" ? "Something players can spend their points on." : "Changes show in the store as soon as they are saved."}
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Item" accent="blue" />
            <div className="space-y-4 p-3.5">
              <Field label="Name" htmlFor="name">
                <input
                  id="name"
                  value={values.name}
                  onChange={(event) => set("name", event.target.value)}
                  required
                  placeholder="e.g. $25 tip"
                  className={field}
                />
              </Field>
              <Field label="Description" htmlFor="description" hint="Shown on the card in the store.">
                <textarea
                  id="description"
                  value={values.description}
                  onChange={(event) => set("description", event.target.value)}
                  rows={3}
                  className={`${field} h-auto min-h-[84px] resize-y py-2 leading-relaxed`}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="category">
                  <SelectMenu
                    id="category"
                    aria-label="Category"
                    value={values.category}
                    onChange={(value) => set("category", value)}
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
                <Field label="Type" htmlFor="type">
                  <SelectMenu
                    id="type"
                    aria-label="Type"
                    value={values.type}
                    onChange={(value) => set("type", value)}
                    options={TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </Field>
              </div>
              <StoreImageField value={values.icon} onChange={(value) => set("icon", value)} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Price & stock" accent="green" />
            <div className="grid gap-4 p-3.5 sm:grid-cols-2">
              <Field label="Cost (points)" htmlFor="cost">
                <input
                  id="cost"
                  type="number"
                  min={0}
                  step={1}
                  value={values.cost}
                  onChange={(event) => set("cost", event.target.value)}
                  required
                  className={`${field} tabular-nums`}
                />
              </Field>
              <Field label="Stock" htmlFor="quantity" hint={unlimited ? "Never runs out." : "Goes down with every purchase."}>
                <div className="flex gap-2">
                  <input
                    id="quantity"
                    type="number"
                    min={-1}
                    step={1}
                    value={unlimited ? "" : values.quantity}
                    onChange={(event) => set("quantity", event.target.value === "" ? "-1" : event.target.value)}
                    placeholder={unlimited ? "Unlimited" : "0"}
                    disabled={unlimited}
                    required={!unlimited}
                    className={`${field} tabular-nums disabled:opacity-50`}
                  />
                  <button
                    type="button"
                    onClick={() => set("quantity", unlimited ? "10" : "-1")}
                    aria-pressed={unlimited}
                    title="Unlimited stock"
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[12px] transition"
                    style={
                      unlimited
                        ? { borderColor: `${ACCENTS.green}77`, backgroundColor: `${ACCENTS.green}1a`, color: "#fff" }
                        : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }
                    }
                  >
                    <InfinityIcon className="h-3.5 w-3.5" /> Unlimited
                  </button>
                </div>
              </Field>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Who can buy" accent="purple" />
            <div className="space-y-3 p-3.5">
              <PayoutMethodField value={values.payout_method} onChange={(value) => set("payout_method", value)} />
              <Toggle
                checked={values.one_purchase_per_user}
                onChange={(value) => set("one_purchase_per_user", value)}
                title="One purchase per player"
                description="Each account can buy it once."
              />
              <Toggle
                checked={values.code_user_only}
                onChange={(value) => set("code_user_only", value)}
                title="Code Users only"
                description="Everyone else sees it locked."
              />
              {mode === "edit" && (
                <Toggle
                  checked={values.is_available === "true"}
                  onChange={(value) => set("is_available", value ? "true" : "false")}
                  title="Live in the store"
                  description="Off hides it from players without deleting it."
                />
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4">
          <Panel>
            <PanelHeader title="Preview" accent="slate" />
            <div className="p-3.5">
              <Preview values={values} />
            </div>
          </Panel>
          <div className="flex gap-2">
            <button
              type="submit"
              data-admin-edit
              disabled={submitting}
              className="h-10 flex-1 rounded-md font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-black transition hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: ACCENTS.blue }}
            >
              {submitting ? (mode === "add" ? "Creating…" : "Saving…") : mode === "add" ? "Create item" : "Save changes"}
            </button>
            <Link
              href={adminHref("/admin/store")}
              className="flex h-10 items-center rounded-md border border-white/[0.10] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  )
}
