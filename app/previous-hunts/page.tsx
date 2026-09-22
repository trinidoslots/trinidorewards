import { redirect } from "next/navigation"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Previous hunts",
}

export default function PreviousHuntsRedirect() {
  redirect("/bonushunt?tab=previous")
}
