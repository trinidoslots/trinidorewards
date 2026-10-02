import { LegalPage } from "@/components/legal-page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy",
}

/** The contents list, in the order of the headings below. Ids match the h2s. */
const SECTIONS = [
  { id: "what-information-do-we-collect", title: "What information do we collect?" },
  { id: "how-do-we-process-your-information", title: "How do we process your information?" },
  { id: "legal-bases-for-processing-your-information", title: "Legal bases for processing your information" },
  { id: "when-and-with-whom-do-we-share-your-information", title: "When and with whom do we share your information?" },
  { id: "cookies-and-tracking-technologies", title: "Cookies and tracking technologies" },
  { id: "social-logins", title: "Social logins" },
  { id: "retention-of-information", title: "Retention of information" },
  { id: "security-of-information", title: "Security of information" },
  { id: "information-from-minors", title: "Information from minors" },
  { id: "your-privacy-rights", title: "Your privacy rights" },
  { id: "do-not-track-features", title: "Do-not-track features" },
  { id: "california-residents", title: "California residents" },
  { id: "updates-to-this-notice", title: "Updates to this notice" },
  { id: "contact-us", title: "Contact us" },
  { id: "review-update-or-delete-data", title: "Review, update, or delete data" },
]

export default function Page() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="What is collected, and what is not."
      sections={SECTIONS}
      other={{ href: "/terms", label: "Terms of service" }}
    >
            {/* Introduction */}
            <section>
              <p>
                This privacy notice for <strong>TrinidoRewards</strong> ("Company," "we," "us," or "our") describes how
                and why we may collect, store, use, and/or share ("process") your information when you use our services
                ("Services"), such as when you:
              </p>
              <ul>
                <li>
                  Visit our website at{" "}
                  <a href="https://trinidorewards.com">
                    trinidorewards.com
                  </a>{" "}
                  or any website of ours that links to this privacy notice
                </li>
                <li>Engage with us in other related ways, including any sales, marketing, or events</li>
              </ul>
              <p>
                <strong>Questions or concerns?</strong> Reading this notice will help you understand your privacy rights
                and choices. If you do not agree with our policies, please do not use our Services. For any questions,
                please contact us at{" "}
                <a href="mailto:privacy@trinidorewards.com">
                  privacy@trinidorewards.com
                </a>
                .
              </p>
            </section>

            {/* Section 1 */}
            <section>
              <h2 id="what-information-do-we-collect">1. WHAT INFORMATION DO WE COLLECT?</h2>

              <h3>Personal information you disclose to us</h3>
              <p>
                <strong>In Short:</strong> We collect personal information you provide voluntarily when you interact
                with our Services.
              </p>
              <p>This may include:</p>
              <ul>
                <li>
                  <strong>Contact or authentication data</strong> you provide when registering, contacting us, or
                  participating in activities on the Services.
                </li>
                <li>
                  <strong>Social Media Login Data:</strong> If you register using a social media account (e.g.,
                  Facebook, Twitter), we may receive profile information such as your name, email, friends list, and
                  profile picture.
                </li>
              </ul>
              <p>
                All personal information you provide must be true, complete, and accurate, and you must notify us of any
                changes.
              </p>

              <h3>Information automatically collected</h3>
              <p>
                <strong>In Short:</strong> We collect certain information automatically when you visit or use our
                Services.
              </p>
              <p>This may include:</p>
              <ul>
                <li>
                  <strong>Log and Usage Data:</strong> IP address, device information, browser type, operating system,
                  pages viewed, searches, usage timestamps, and errors.
                </li>
                <li>
                  <strong>Location Data:</strong> Precise or imprecise information about your device's location (via
                  GPS, IP, or other methods). You can disable location tracking, but some Service features may not
                  function.
                </li>
              </ul>
              <p>
                Cookies and similar technologies may also be used for analytics and functionality purposes.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 id="how-do-we-process-your-information">2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
              <p>
                <strong>In Short:</strong> We process your information to provide, improve, and administer our Services,
                communicate with you, ensure security, and comply with legal obligations.
              </p>
              <p>Examples include:</p>
              <ul>
                <li>
                  <strong>Account management:</strong> Create, authenticate, and maintain your account.
                </li>
                <li>
                  <strong>Service security:</strong> Monitor and prevent fraud or misuse.
                </li>
                <li>
                  <strong>Usage analysis:</strong> Identify trends to improve our Services.
                </li>
              </ul>
              <p>
                We may also process information for other purposes with your consent.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 id="legal-bases-for-processing-your-information">3. LEGAL BASES FOR PROCESSING YOUR INFORMATION</h2>
              <p>
                <strong>In Short:</strong> We process your information only when necessary and under a valid legal
                reason.
              </p>
              <ul>
                <li>
                  <strong>Consent:</strong> When you have given permission for a specific purpose. You can withdraw
                  consent at any time.
                </li>
                <li>
                  <strong>Legitimate Interests:</strong> For example, analyzing usage trends, improving Services, or
                  preventing fraud.
                </li>
                <li>
                  <strong>Legal Obligations:</strong> To comply with laws, regulatory requirements, or legal
                  proceedings.
                </li>
              </ul>
              <p>
                Specific rules may apply for users in the EU, UK, Canada, or other jurisdictions.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 id="when-and-with-whom-do-we-share-your-information">
                4. WHEN AND WITH WHOM DO WE SHARE YOUR INFORMATION?
              </h2>
              <p>
                <strong>In Short:</strong> We share your information in limited situations with:
              </p>
              <ul>
                <li>
                  <strong>Vendors, consultants, and service providers</strong> who perform services on our behalf.
                </li>
                <li>
                  <strong>Business transfers:</strong> In connection with mergers, sales, or acquisitions.
                </li>
              </ul>
              <p>We do not sell your personal information.</p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 id="cookies-and-tracking-technologies">5. COOKIES AND TRACKING TECHNOLOGIES</h2>
              <p>
                <strong>In Short:</strong> We may use cookies, web beacons, pixels, and similar technologies to collect
                and store information. You can manage cookies through your browser settings. See our{" "}
                <strong>Cookie Notice</strong> for details.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 id="social-logins">6. SOCIAL LOGINS</h2>
              <p>
                <strong>In Short:</strong> If you register or log in using a social media account, we may receive
                certain profile information from the social media provider.
              </p>
              <p>
                We use this information only for purposes described in this notice or clearly stated on the Services. We
                are not responsible for how the social media provider uses your data.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 id="retention-of-information">7. RETENTION OF INFORMATION</h2>
              <p>
                <strong>In Short:</strong> We keep your information only as long as necessary to fulfill the purposes
                outlined in this notice or as required by law.
              </p>
              <p>
                When no longer needed, personal information is deleted, anonymized, or securely stored until deletion is
                possible.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 id="security-of-information">8. SECURITY OF INFORMATION</h2>
              <p>
                <strong>In Short:</strong> We use organizational and technical measures to protect your information.
                However, no system is completely secure, and transmission of data over the Internet is at your own risk.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 id="information-from-minors">9. INFORMATION FROM MINORS</h2>
              <p>
                <strong>In Short:</strong> We do not knowingly collect data from or market to children under 18.
                Accounts of minors discovered will be deactivated, and data deleted.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 id="your-privacy-rights">10. YOUR PRIVACY RIGHTS</h2>
              <p>
                <strong>In Short:</strong> Depending on your location, you may have rights to access, correct, delete,
                restrict processing, or object to the processing of your personal information.
              </p>
              <ul>
                <li>
                  <strong>Account information:</strong> You can review or update your information via your account
                  settings. Requests for deletion will deactivate or remove your account from active databases.
                </li>
                <li>
                  <strong>Cookies and tracking:</strong> Manage browser settings or opt out of interest-based
                  advertising{" "}
                  <a
                    href="http://www.aboutads.info/choices/"
                    target="_blank"
                    rel="noopener noreferrer"
                   
                  >
                    here
                  </a>
                  .
                </li>
                <li>
                  <strong>EU/UK/Canada users:</strong> You may request access, correction, erasure, restriction, or data
                  portability. Complaints can be submitted to local authorities.
                </li>
              </ul>
            </section>

            {/* Section 11 */}
            <section>
              <h2 id="do-not-track-features">11. DO-NOT-TRACK FEATURES</h2>
              <p>
                Most browsers have a Do-Not-Track ("DNT") feature. Currently, we do not respond to DNT signals. If a
                standard is adopted in the future, we will update this notice.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 id="california-residents">12. CALIFORNIA RESIDENTS</h2>
              <p>
                California residents have specific rights, including the right to request information on personal data
                shared for direct marketing and to request removal of public data for users under 18.
              </p>
            </section>

            {/* Section 13 */}
            <section>
              <h2 id="updates-to-this-notice">13. UPDATES TO THIS NOTICE</h2>
              <p>
                We may update this Privacy Notice to stay compliant with laws. Changes are effective when posted, and
                material changes may be communicated directly.
              </p>
            </section>

            {/* Section 14 */}
            <section>
              <h2 id="contact-us">14. CONTACT US</h2>
              <p>
                For questions or concerns, email us at{" "}
                <a href="mailto:privacy@trinidorewards.com">
                  privacy@trinidorewards.com
                </a>
                .
              </p>
            </section>

            {/* Section 15 */}
            <section>
              <h2 id="review-update-or-delete-data">15. REVIEW, UPDATE, OR DELETE DATA</h2>
              <p>
                Depending on your country's laws, you may request access, updates, or deletion of your personal
                information at{" "}
                <a href="mailto:privacy@trinidorewards.com">
                  privacy@trinidorewards.com
                </a>
                .
              </p>
            </section>
    </LegalPage>
  )
}
