/**
 * Store item semantics, in one place.
 *
 * Both of these were read differently in different files, and both readings
 * were wrong somewhere: `is_available` is a *string* column, so `!item.is_available`
 * is false for "false" and a disabled item could still be bought; and quantity
 * -1 means unlimited, which the purchase route treated as out of stock.
 */

export type StoreItem = {
  id: string
  name: string
  description: string | null
  cost: number
  icon: string | null
  category: string | null
  quantity: number
  is_available: string | boolean | null
  /**
   * What has to be asked for before this can be bought: "onsite_tip",
   * "crypto", or null for nothing. See lib/payout.
   */
  payout_method?: string | null
  created_at?: string
}

/** Unlimited stock. Set from the admin form, which documents "-1 for infinite". */
export const UNLIMITED = -1

export function isAvailable(item: Pick<StoreItem, "is_available">): boolean {
  const value = item.is_available
  if (typeof value === "boolean") return value
  if (value == null) return false
  const text = String(value).trim().toLowerCase()
  return text === "true" || text === "t" || text === "1" || text === "yes"
}

export function isUnlimited(quantity: number): boolean {
  return Number(quantity) < 0
}

export function inStock(item: Pick<StoreItem, "quantity">): boolean {
  const quantity = Number(item.quantity)
  return isUnlimited(quantity) || quantity > 0
}

export function stockLabel(quantity: number): string {
  if (isUnlimited(quantity)) return "Unlimited"
  const value = Number(quantity) || 0
  if (value <= 0) return "Out of stock"
  return `${value} left`
}
