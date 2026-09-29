import { NextResponse } from "next/server"

/**
 * Bitcoin and Ethereum in USD, for the top bar.
 *
 * The strip used to ask CoinGecko straight from the browser. Its keyless API
 * now answers 429 almost on sight, the strip never got a number and sat on
 * $0 for the whole stream. Coinbase's spot price needs no key and has no such
 * limit in practice; Kraken's public ticker is the fallback.
 *
 * Fetched here rather than in the widget so every OBS source shares one
 * lookup: the top bar is in more than one scene.
 */

export const revalidate = 30

type Prices = { btc: number; eth: number }

const positive = (value: unknown) => {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN
  return Number.isFinite(number) && number > 0 ? number : null
}

async function fromCoinbase(): Promise<Prices | null> {
  const spot = async (pair: string) => {
    const response = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`, { next: { revalidate } })
    if (!response.ok) return null
    return positive((await response.json())?.data?.amount)
  }
  const [btc, eth] = await Promise.all([spot("BTC-USD"), spot("ETH-USD")])
  return btc && eth ? { btc, eth } : null
}

async function fromKraken(): Promise<Prices | null> {
  const response = await fetch("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD", { next: { revalidate } })
  if (!response.ok) return null
  const result = (await response.json())?.result
  // "c" is the last trade: [price, volume].
  const btc = positive(result?.XXBTZUSD?.c?.[0])
  const eth = positive(result?.XETHZUSD?.c?.[0])
  return btc && eth ? { btc, eth } : null
}

export async function GET() {
  for (const source of [fromCoinbase, fromKraken]) {
    try {
      const prices = await source()
      if (prices) return NextResponse.json(prices)
    } catch {
      // Next source.
    }
  }
  return NextResponse.json({ error: "No price source answered." }, { status: 502 })
}
