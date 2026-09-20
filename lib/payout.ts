/**
 * How a bought item gets paid out, and what has to be asked for first.
 *
 * Two shapes: a tip to a username on the casino, or a transfer to a wallet.
 * Which one an item uses is set per item in the admin panel.
 *
 * No imports, like lib/points-activity — these rules decide where someone's
 * money is sent, so they are checkable without a browser or a database.
 */

export type PayoutMethod = "onsite_tip" | "crypto"

export const PAYOUT_METHODS: { id: PayoutMethod; label: string; hint: string }[] = [
  { id: "onsite_tip", label: "On-Site Tip", hint: "Asks for the buyer's casino username" },
  { id: "crypto", label: "Crypto", hint: "Asks for a coin, a network and a wallet address" },
]

/** NULL in the database: the item needs nothing, and Buy stays one click. */
export function readPayoutMethod(value: unknown): PayoutMethod | null {
  return value === "onsite_tip" || value === "crypto" ? value : null
}

export function payoutMethodLabel(method: PayoutMethod | null): string {
  return PAYOUT_METHODS.find((entry) => entry.id === method)?.label ?? "No details needed"
}

/**
 * A network a coin can arrive on.
 *
 * `family` is what the address actually has to look like — several networks
 * share one address format, and USDT on BSC looks exactly like USDT on
 * Ethereum. Keeping them apart matters for the label; for validation only the
 * family does.
 */
export type ChainFamily = "evm" | "bitcoin" | "litecoin" | "solana" | "tron"

export type Chain = { id: string; label: string; family: ChainFamily }

export type Crypto = { code: string; name: string; chains: Chain[] }

const EVM = (id: string, label: string): Chain => ({ id, label, family: "evm" })

/**
 * The coins on offer and the networks each one can arrive on.
 *
 * This list is a judgement call, not something the request pinned down: only
 * USDC and USDT were named as multi-network. Adjust it here — every dropdown,
 * the stored redemption and the address check all read from this one place.
 */
export const CRYPTOS: Crypto[] = [
  { code: "BTC", name: "Bitcoin", chains: [{ id: "bitcoin", label: "Bitcoin", family: "bitcoin" }] },
  { code: "ETH", name: "Ethereum", chains: [EVM("ethereum", "Ethereum (ERC-20)")] },
  { code: "SOL", name: "Solana", chains: [{ id: "solana", label: "Solana", family: "solana" }] },
  { code: "LTC", name: "Litecoin", chains: [{ id: "litecoin", label: "Litecoin", family: "litecoin" }] },
  {
    code: "USDC",
    name: "USD Coin",
    chains: [
      EVM("ethereum", "Ethereum (ERC-20)"),
      { id: "solana", label: "Solana", family: "solana" },
      EVM("polygon", "Polygon"),
      EVM("base", "Base"),
      EVM("bsc", "BNB Smart Chain (BEP-20)"),
    ],
  },
  {
    code: "USDT",
    name: "Tether",
    chains: [
      EVM("ethereum", "Ethereum (ERC-20)"),
      { id: "tron", label: "Tron (TRC-20)", family: "tron" },
      { id: "solana", label: "Solana", family: "solana" },
      EVM("polygon", "Polygon"),
      EVM("bsc", "BNB Smart Chain (BEP-20)"),
    ],
  },
]

export function findCrypto(code: unknown): Crypto | null {
  return CRYPTOS.find((entry) => entry.code === code) ?? null
}

export function chainsFor(code: unknown): Chain[] {
  return findCrypto(code)?.chains ?? []
}

/** Whether a second dropdown is needed at all. */
export function needsChain(code: unknown): boolean {
  return chainsFor(code).length > 1
}

export function findChain(code: unknown, chainId: unknown): Chain | null {
  return chainsFor(code).find((chain) => chain.id === chainId) ?? null
}

/**
 * The network to use when the buyer has not picked one.
 *
 * Single-network coins have exactly one, so the dropdown is skipped and this is
 * it. Multi-network coins deliberately return null: defaulting USDT to a
 * network the buyer did not choose is how money ends up on the wrong chain.
 */
export function defaultChainFor(code: unknown): Chain | null {
  const chains = chainsFor(code)
  return chains.length === 1 ? chains[0] : null
}

// Base58 as Bitcoin defines it: no 0, O, I or l, because they are too easy to
// confuse when an address is read off a screen.
const BASE58 = "[1-9A-HJ-NP-Za-km-z]"

const ADDRESS_PATTERNS: Record<ChainFamily, RegExp> = {
  // 0x and exactly 40 hex characters — unambiguous, so this one can be strict.
  evm: /^0x[a-fA-F0-9]{40}$/,
  bitcoin: new RegExp(`^(bc1[02-9ac-hj-np-z]{11,71}|[13]${BASE58}{25,39})$`),
  litecoin: new RegExp(`^(ltc1[02-9ac-hj-np-z]{11,71}|[LM3]${BASE58}{26,39})$`),
  solana: new RegExp(`^${BASE58}{32,44}$`),
  tron: new RegExp(`^T${BASE58}{33}$`),
}

export type Check = { ok: boolean; warning?: string }

/**
 * Checks an address against the network it is going to.
 *
 * A mismatch is a *warning*, not a refusal. These patterns are good enough to
 * catch a coin pasted for the wrong network, which is the mistake worth
 * catching — but a pattern that is slightly too narrow would block a real
 * payout, and that is the worse failure. Empty is the only hard no.
 */
export function checkAddress(code: unknown, chainId: unknown, address: string): Check {
  const value = address.trim()
  if (!value) return { ok: false, warning: "Enter a wallet address" }
  if (value.length > 128) return { ok: false, warning: "That is too long to be a wallet address" }

  const chain = findChain(code, chainId) ?? defaultChainFor(code)
  if (!chain) return { ok: true }

  const pattern = ADDRESS_PATTERNS[chain.family]
  if (pattern.test(value)) return { ok: true }

  return {
    // Deliberately still ok: see above.
    ok: true,
    warning: `This does not look like a ${chain.label} address. Check it before confirming.`,
  }
}

export function checkUsername(username: string): Check {
  const value = username.trim()
  if (!value) return { ok: false, warning: "Enter your username" }
  if (value.length < 2) return { ok: false, warning: "That username is too short" }
  if (value.length > 64) return { ok: false, warning: "That username is too long" }
  return { ok: true }
}

export type PayoutDetails =
  | { method: "onsite_tip"; username: string }
  | { method: "crypto"; crypto: string; chain: string; address: string }

/**
 * Normalises what the buyer typed, or explains what is missing.
 *
 * Run on the server as well as in the dialog: the dialog can be bypassed, and
 * a redemption with no payout details is one the admin cannot action.
 */
export function readPayoutDetails(
  method: PayoutMethod | null,
  raw: unknown,
): { ok: true; details: PayoutDetails | null } | { ok: false; error: string } {
  if (method === null) return { ok: true, details: null }

  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>

  if (method === "onsite_tip") {
    const username = typeof input.username === "string" ? input.username.trim() : ""
    const check = checkUsername(username)
    if (!check.ok) return { ok: false, error: check.warning ?? "Enter your username" }
    return { ok: true, details: { method: "onsite_tip", username } }
  }

  const crypto = findCrypto(input.crypto)
  if (!crypto) return { ok: false, error: "Pick a coin" }

  const chain = findChain(crypto.code, input.chain) ?? defaultChainFor(crypto.code)
  // Only reachable for a multi-network coin, which is exactly when guessing
  // would be dangerous.
  if (!chain) return { ok: false, error: `Pick a network for ${crypto.code}` }

  const address = typeof input.address === "string" ? input.address.trim() : ""
  const check = checkAddress(crypto.code, chain.id, address)
  if (!check.ok) return { ok: false, error: check.warning ?? "Enter a wallet address" }

  return { ok: true, details: { method: "crypto", crypto: crypto.code, chain: chain.id, address } }
}

/** One line for the admin's redemption list. */
export function describePayout(details: PayoutDetails | null): string {
  if (!details) return "—"
  if (details.method === "onsite_tip") return `Tip to ${details.username}`
  const chain = findChain(details.crypto, details.chain)
  return `${details.crypto} on ${chain?.label ?? details.chain}`
}
