import { CasinoFramePage } from "@/components/obs/casino-frame"

/**
 * Stake's frame, at the address it has always had.
 *
 * Every casino, Stake included, also has its own: /obs/casino-frame/<id>. The
 * frame itself and its query parameters are in components/obs/casino-frame.tsx.
 */
export default function StakeFramePage() {
  return <CasinoFramePage casino="stake" />
}
