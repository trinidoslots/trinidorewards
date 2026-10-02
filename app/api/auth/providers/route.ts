import { NextResponse } from "next/server"
import { discordConfigured } from "@/lib/discord-oauth"

/** Which sign-in buttons the login dialog offers. Kick always; Discord once it is set up. */
export async function GET() {
  return NextResponse.json({ kick: true, discord: discordConfigured() })
}
