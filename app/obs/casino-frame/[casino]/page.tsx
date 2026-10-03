import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CasinoFramePage } from "@/components/obs/casino-frame"
import { CASINO_IDS, CASINO_NAMES, isCasinoId } from "@/lib/casinos"

/**
 * The frame dressed as one casino: /obs/casino-frame/gamba, /gamdom, /roobet,
 * /shuffle, /csgo500 or /stake. Same layout and the same query parameters as
 * /obs/casino-frame; see components/obs/casino-frame.tsx.
 */

type Props = { params: Promise<{ casino: string }> }

// The list is fixed, so each frame is built ahead of time and anything else
// is a 404 rather than a Stake frame under a wrong name.
export const dynamicParams = false

export function generateStaticParams() {
  return CASINO_IDS.map((casino) => ({ casino }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { casino } = await params
  return { title: isCasinoId(casino) ? `OBS · ${CASINO_NAMES[casino]} frame` : "OBS · Casino frame" }
}

export default async function CasinoFrameByIdPage({ params }: Props) {
  const { casino } = await params
  if (!isCasinoId(casino)) notFound()
  return <CasinoFramePage casino={casino} />
}
