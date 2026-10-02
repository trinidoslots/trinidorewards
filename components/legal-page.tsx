import type React from "react"
import Link from "next/link"
import { ArrowRight, ArrowUp } from "lucide-react"
import { PageBody, PageHero } from "@/components/page-hero"
import { MonoLabel } from "@/components/ui/panel"
import { LegalContents, type LegalSection } from "@/components/legal-contents"

/**
 * The privacy policy and the terms, laid out for reading.
 *
 * The documents themselves are untouched text; this is only the frame: the
 * site's header, a contents list that follows you down the page, and one
 * typographic style for the article (.legal-prose in globals.css) instead of
 * classes on every paragraph.
 */
export function LegalPage({
  title,
  subtitle,
  sections,
  other,
  children,
}: {
  title: string
  subtitle: string
  sections: LegalSection[]
  /** The other legal document, linked from the header. */
  other: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <div>
      <PageHero accent="slate" note="Legal" title={title} subtitle={subtitle}>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <span className="text-white/40">{sections.length} sections</span>
          <Link
            href={other.href}
            className="group inline-flex items-center gap-1.5 font-semibold text-white/70 transition hover:text-white"
          >
            {other.label}
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </PageHero>

      <PageBody>
        <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <LegalContents sections={sections} />

          <article className="legal-prose min-w-0 rounded-xl border border-white/[0.08] bg-[#0E0E12] px-5 py-7 sm:px-10 sm:py-10">
            {children}
            <div className="mt-12 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-6">
              <MonoLabel className="text-white/35">End of document</MonoLabel>
              <a
                href="#top"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60 no-underline transition hover:text-white"
              >
                <ArrowUp className="h-3.5 w-3.5" /> Back to top
              </a>
            </div>
          </article>
        </div>
      </PageBody>
    </div>
  )
}
