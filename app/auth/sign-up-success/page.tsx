import Link from "next/link"
import { AuthShell } from "@/components/auth-shell"

export default function SignUpSuccessPage() {
  return (
    <AuthShell
      title="Check your email"
      subtitle="The account exists. Confirm the address from the email we just sent before signing in."
      footer={
        <Link href="/auth/login" className="text-white/60 underline underline-offset-4 transition hover:text-white">
          Back to sign in
        </Link>
      }
    >
      <p className="text-[13px] leading-relaxed text-white/50">
        If nothing arrives in a few minutes, look in spam — the confirmation comes from Supabase, not from
        trinidorewards.com.
      </p>
    </AuthShell>
  )
}
