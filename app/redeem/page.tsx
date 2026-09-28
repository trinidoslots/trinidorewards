import { redirect } from "next/navigation"

/**
 * Redeeming is a dialog over any page now (components/redeem-modal.tsx), not
 * a page of its own. This address stays because the stream overlay prints it
 * and links to it are already out there: it hands over to the home page with
 * the dialog open and the code, if the link carried one, filled in.
 */
export default async function RedeemRedirect({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code?.trim()
  redirect(`/?redeem=${encodeURIComponent(code || "1")}`)
}
