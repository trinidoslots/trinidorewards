import { FileText } from "lucide-react"
import { MonoLabel, Panel } from "@/components/ui/panel"

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <FileText className="h-5 w-5 text-white/40" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Terms of Service</h1>
          <MonoLabel className="text-white/30">The rules for using the site.</MonoLabel>
        </div>
      </header>

      <Panel className="p-6">
        <div className="max-w-none space-y-6">
            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Interpretation</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                Capitalized words used in these Terms have meanings defined under the following conditions. These
                definitions apply equally in singular and plural form.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Definitions</h2>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">For the purposes of these Terms and Conditions:</p>
              <ul className="text-[13px] leading-relaxed text-white/55 space-y-2 list-disc pl-6">
                <li>
                  <strong>Affiliate</strong> means an entity that controls, is controlled by, or is under common control
                  with a party, where "control" means ownership of 50% or more of the shares, equity interest, or other
                  securities entitled to vote for election of directors or other managing authority.
                </li>
                <li>
                  <strong>Account</strong> means a unique account created for You to access our Service or parts of our
                  Service.
                </li>
                <li>
                  <strong>Country</strong> refers to: Malta
                </li>
                <li>
                  <strong>Company</strong> (referred to as either "the Company", "We", "Us" or "Our") refers to
                  TrinidoRewards.
                </li>
                <li>
                  <strong>Content</strong> refers to content such as text, images, or other information that can be
                  posted, uploaded, linked to, or otherwise made available by You, regardless of the form of that
                  content.
                </li>
                <li>
                  <strong>Device</strong> means any device that can access the Service, such as a computer, cellphone,
                  or digital tablet.
                </li>
                <li>
                  <strong>Feedback</strong> means feedback, innovations, or suggestions sent by You regarding the
                  attributes, performance, or features of our Service.
                </li>
                <li>
                  <strong>Promotions</strong> refer to contests, sweepstakes, or other promotions offered through the
                  Service.
                </li>
                <li>
                  <strong>Service</strong> refers to the Website.
                </li>
                <li>
                  <strong>Terms and Conditions</strong> (also referred to as "Terms") mean these Terms and Conditions
                  that form the entire agreement between You and the Company regarding the use of the Service.
                </li>
                <li>
                  <strong>Third-party Social Media Service</strong> means any services or content (including data,
                  information, products, or services) provided by a third-party that may be displayed, included, or made
                  available by the Service.
                </li>
                <li>
                  <strong>Website</strong> refers to TrinidoRewards, accessible from trinidorewards.com.
                </li>
                <li>
                  <strong>You</strong> means the individual accessing or using the Service, or the company, or other
                  legal entity on behalf of which such individual is accessing or using the Service, as applicable.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Acknowledgment</h2>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                These Terms govern the use of the Service and form an agreement between You and the Company. They
                outline the rights and obligations of all users.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                Your access to and use of the Service is conditioned on Your acceptance of and compliance with these
                Terms. By accessing or using the Service, You agree to be bound by these Terms. If You do not agree, You
                may not access or use the Service.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                You represent that you are over the age of 18. The Company does not permit anyone under 18 to use the
                Service.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55">
                Your access and use of the Service is also conditioned on Your acceptance of and compliance with the
                Privacy Policy of the Company, which describes how We collect, use, and disclose Your personal
                information.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Promotions</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                Promotions made available through the Service may be governed by separate rules. If You participate,
                please review the applicable rules and Privacy Policy. In case of conflict, the Promotion rules will
                apply.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">User Accounts</h2>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                When You create an Account, You must provide accurate, complete, and current information. Failure to do
                so constitutes a breach and may result in termination of Your Account.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                You are responsible for safeguarding Your password and for all activity under Your Account. Notify Us
                immediately if Your Account is compromised.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55">
                You may not use a username that violates the rights of others or is offensive.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Content</h2>
              <h3 className="text-white text-xl font-semibold mb-2 mt-4">Your Right to Post Content</h3>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                You may post Content on the Service. You are responsible for the legality, reliability, and
                appropriateness of Your Content.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                By posting Content, You grant the Company a license to use, modify, display, reproduce, and distribute
                such Content. You retain ownership and are responsible for protecting Your rights.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                You represent that You either own the Content or have rights to post it and that posting it does not
                violate the rights of others.
              </p>

              <h3 className="text-white text-xl font-semibold mb-2 mt-4">Content Restrictions</h3>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                You may not post Content that is unlawful, offensive, threatening, defamatory, obscene, or otherwise
                objectionable.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55">
                The Company may, in its sole discretion, remove or edit Content and limit or revoke Service use if
                necessary. You acknowledge that exposure to content that You find offensive or objectionable is at Your
                own risk.
              </p>

              <h3 className="text-white text-xl font-semibold mb-2 mt-4">Content Backups</h3>
              <p className="text-[13px] leading-relaxed text-white/55">
                The Company performs regular backups but does not guarantee no data loss. You are responsible for
                maintaining independent copies of Your Content.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Copyright Policy</h2>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                We respect intellectual property rights and will respond to claims of infringement.
              </p>
              <h3 className="text-white text-xl font-semibold mb-2">DMCA</h3>
              <p className="text-[13px] leading-relaxed text-white/55">
                You may submit a DMCA notification to our Copyright Agent via our contact channels.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Intellectual Property</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                The Service and its original content (excluding Your Content) are owned by the Company. Trademarks and
                trade dress may not be used without prior written consent.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Feedback</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                All Feedback You provide is assigned to the Company, granting a non-exclusive, perpetual, worldwide
                license to use it.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Links to Other Websites</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                The Service may link to third-party websites. The Company has no responsibility for their content,
                privacy policies, or practices.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Termination</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                We may terminate or suspend Your Account for breach of Terms. Upon termination, Your right to use the
                Service ceases immediately.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Limitation of Liability</h2>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                The Company's liability is limited to the amount paid by You through the Service or $100 if no purchase
                was made.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55">
                The Company is not liable for indirect, incidental, or consequential damages. Some jurisdictions may
                limit this exclusion.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">"AS IS" and "AS AVAILABLE" Disclaimer</h2>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                The Service is provided "AS IS" without warranties. The Company does not guarantee that the Service will
                meet Your requirements, operate without interruption, or be error-free.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55">
                Some jurisdictions do not allow the exclusion of certain warranties, so some provisions may not apply to
                You.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Governing Law</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                These Terms are governed by the laws of the United Kingdom, excluding conflict-of-law rules.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Disputes Resolution</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                You agree to attempt informal resolution by contacting the Company before pursuing legal action.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">For European Union (EU) Users</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                EU consumers will benefit from mandatory provisions of the law of their resident country.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">United States Legal Compliance</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                You warrant that You are not located in a sanctioned country and are not listed on prohibited party
                lists.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Severability and Waiver</h2>
              <h3 className="text-white text-xl font-semibold mb-2 mt-4">Severability</h3>
              <p className="text-[13px] leading-relaxed text-white/55 mb-3">
                If any provision is unenforceable, it will be interpreted to achieve its purpose, and the remaining
                provisions remain in effect.
              </p>
              <h3 className="text-white text-xl font-semibold mb-2">Waiver</h3>
              <p className="text-[13px] leading-relaxed text-white/55">
                Failure to exercise a right does not waive that right or any future rights.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Translation Interpretation</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                If translated, the original English text prevails in the case of a dispute.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Changes to These Terms and Conditions</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                The Company may modify these Terms at its discretion. Material changes will be notified at least 30 days
                in advance. Continued use of the Service constitutes acceptance of revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-white mb-2">Contact Us</h2>
              <p className="text-[13px] leading-relaxed text-white/55">
                For questions about these Terms, contact us through our social media channels or via email.
              </p>
            </section>
        </div>
      </Panel>
    </div>
  )
}
