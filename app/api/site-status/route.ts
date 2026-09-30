import { NextResponse } from "next/server"
import { currentGate } from "@/lib/site-gate"

/**
 * Whether maintenance mode is on, for the maintenance page to watch so it can
 * send people back to the site the moment it is switched off.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const { maintenance } = await currentGate()
  return NextResponse.json({ maintenance }, { headers: { "Cache-Control": "no-store" } })
}
