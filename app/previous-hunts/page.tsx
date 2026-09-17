import { redirect } from "next/navigation"

export default function PreviousHuntsRedirect() {
  redirect("/bonushunt?tab=previous")
}
