import { LegalPage } from "@/components/legal-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms",
}

/** The contents list, in the order of the headings below. Ids match the h2s. */
const SECTIONS = [
  { id: "interpretation", title: "Interpretation" },
  { id: "definitions", title: "Definitions" },
  { id: "acknowledgment", title: "Acknowledgment" },
  { id: "promotions", title: "Promotions" },
  { id: "user-accounts", title: "User Accounts" },
  { id: "content", title: "Content" },
  { id: "copyright-policy", title: "Copyright Policy" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "feedback", title: "Feedback" },
  { id: "links-to-other-websites", title: "Links to Other Websites" },
  { id: "termination", title: "Termination" },
  { id: "limitation-of-liability", title: "Limitation of Liability" },
  { id: "as-is-and-as-available-disclaimer", title: "\"AS IS\" and \"AS AVAILABLE\" Disclaimer" },
  { id: "governing-law", title: "Governing Law" },
  { id: "disputes-resolution", title: "Disputes Resolution" },
  { id: "for-european-union-eu-users", title: "For European Union (EU) Users" },
  { id: "united-states-legal-compliance", title: "United States Legal Compliance" },
  { id: "severability-and-waiver", title: "Severability and Waiver" },
  { id: "translation-interpretation", title: "Translation Interpretation" },
  { id: "changes-to-these-terms-and-conditions", title: "Changes to These Terms and Conditions" },
  { id: "contact-us", title: "Contact Us" },
]

export default function Page() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="The rules for using the site."
      sections={SECTIONS}
      other={{ href: "/privacy", label: "Privacy policy" }}
    >
            <section>
              <h2 id="interpretation">Interpretation</h2>
              <p>
                Capitalized words used in these Terms have meanings defined under the following conditions. These
                definitions apply equally in singular and plural form.
              </p>
            </section>

            <section>
              <h2 id="definitions">Definitions</h2>
              <p>For the purposes of these Terms and Conditions:</p>
              <ul>
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
              <h2 id="acknowledgment">Acknowledgment</h2>
              <p>
                These Terms govern the use of the Service and form an agreement between You and the Company. They
                outline the rights and obligations of all users.
              </p>
              <p>
                Your access to and use of the Service is conditioned on Your acceptance of and compliance with these
                Terms. By accessing or using the Service, You agree to be bound by these Terms. If You do not agree, You
                may not access or use the Service.
              </p>
              <p>
                You represent that you are over the age of 18. The Company does not permit anyone under 18 to use the
                Service.
              </p>
              <p>
                Your access and use of the Service is also conditioned on Your acceptance of and compliance with the
                Privacy Policy of the Company, which describes how We collect, use, and disclose Your personal
                information.
              </p>
            </section>

            <section>
              <h2 id="promotions">Promotions</h2>
              <p>
                Promotions made available through the Service may be governed by separate rules. If You participate,
                please review the applicable rules and Privacy Policy. In case of conflict, the Promotion rules will
                apply.
              </p>
            </section>

            <section>
              <h2 id="user-accounts">User Accounts</h2>
              <p>
                When You create an Account, You must provide accurate, complete, and current information. Failure to do
                so constitutes a breach and may result in termination of Your Account.
              </p>
              <p>
                You are responsible for safeguarding Your password and for all activity under Your Account. Notify Us
                immediately if Your Account is compromised.
              </p>
              <p>
                You may not use a username that violates the rights of others or is offensive.
              </p>
            </section>

            <section>
              <h2 id="content">Content</h2>
              <h3>Your Right to Post Content</h3>
              <p>
                You may post Content on the Service. You are responsible for the legality, reliability, and
                appropriateness of Your Content.
              </p>
              <p>
                By posting Content, You grant the Company a license to use, modify, display, reproduce, and distribute
                such Content. You retain ownership and are responsible for protecting Your rights.
              </p>
              <p>
                You represent that You either own the Content or have rights to post it and that posting it does not
                violate the rights of others.
              </p>

              <h3>Content Restrictions</h3>
              <p>
                You may not post Content that is unlawful, offensive, threatening, defamatory, obscene, or otherwise
                objectionable.
              </p>
              <p>
                The Company may, in its sole discretion, remove or edit Content and limit or revoke Service use if
                necessary. You acknowledge that exposure to content that You find offensive or objectionable is at Your
                own risk.
              </p>

              <h3>Content Backups</h3>
              <p>
                The Company performs regular backups but does not guarantee no data loss. You are responsible for
                maintaining independent copies of Your Content.
              </p>
            </section>

            <section>
              <h2 id="copyright-policy">Copyright Policy</h2>
              <p>
                We respect intellectual property rights and will respond to claims of infringement.
              </p>
              <h3>DMCA</h3>
              <p>
                You may submit a DMCA notification to our Copyright Agent via our contact channels.
              </p>
            </section>

            <section>
              <h2 id="intellectual-property">Intellectual Property</h2>
              <p>
                The Service and its original content (excluding Your Content) are owned by the Company. Trademarks and
                trade dress may not be used without prior written consent.
              </p>
            </section>

            <section>
              <h2 id="feedback">Feedback</h2>
              <p>
                All Feedback You provide is assigned to the Company, granting a non-exclusive, perpetual, worldwide
                license to use it.
              </p>
            </section>

            <section>
              <h2 id="links-to-other-websites">Links to Other Websites</h2>
              <p>
                The Service may link to third-party websites. The Company has no responsibility for their content,
                privacy policies, or practices.
              </p>
            </section>

            <section>
              <h2 id="termination">Termination</h2>
              <p>
                We may terminate or suspend Your Account for breach of Terms. Upon termination, Your right to use the
                Service ceases immediately.
              </p>
            </section>

            <section>
              <h2 id="limitation-of-liability">Limitation of Liability</h2>
              <p>
                The Company's liability is limited to the amount paid by You through the Service or $100 if no purchase
                was made.
              </p>
              <p>
                The Company is not liable for indirect, incidental, or consequential damages. Some jurisdictions may
                limit this exclusion.
              </p>
            </section>

            <section>
              <h2 id="as-is-and-as-available-disclaimer">"AS IS" and "AS AVAILABLE" Disclaimer</h2>
              <p>
                The Service is provided "AS IS" without warranties. The Company does not guarantee that the Service will
                meet Your requirements, operate without interruption, or be error-free.
              </p>
              <p>
                Some jurisdictions do not allow the exclusion of certain warranties, so some provisions may not apply to
                You.
              </p>
            </section>

            <section>
              <h2 id="governing-law">Governing Law</h2>
              <p>
                These Terms are governed by the laws of the United Kingdom, excluding conflict-of-law rules.
              </p>
            </section>

            <section>
              <h2 id="disputes-resolution">Disputes Resolution</h2>
              <p>
                You agree to attempt informal resolution by contacting the Company before pursuing legal action.
              </p>
            </section>

            <section>
              <h2 id="for-european-union-eu-users">For European Union (EU) Users</h2>
              <p>
                EU consumers will benefit from mandatory provisions of the law of their resident country.
              </p>
            </section>

            <section>
              <h2 id="united-states-legal-compliance">United States Legal Compliance</h2>
              <p>
                You warrant that You are not located in a sanctioned country and are not listed on prohibited party
                lists.
              </p>
            </section>

            <section>
              <h2 id="severability-and-waiver">Severability and Waiver</h2>
              <h3>Severability</h3>
              <p>
                If any provision is unenforceable, it will be interpreted to achieve its purpose, and the remaining
                provisions remain in effect.
              </p>
              <h3>Waiver</h3>
              <p>
                Failure to exercise a right does not waive that right or any future rights.
              </p>
            </section>

            <section>
              <h2 id="translation-interpretation">Translation Interpretation</h2>
              <p>
                If translated, the original English text prevails in the case of a dispute.
              </p>
            </section>

            <section>
              <h2 id="changes-to-these-terms-and-conditions">Changes to These Terms and Conditions</h2>
              <p>
                The Company may modify these Terms at its discretion. Material changes will be notified at least 30 days
                in advance. Continued use of the Service constitutes acceptance of revised Terms.
              </p>
            </section>

            <section>
              <h2 id="contact-us">Contact Us</h2>
              <p>
                For questions about these Terms, contact us through our social media channels or via email.
              </p>
            </section>
    </LegalPage>
  )
}
