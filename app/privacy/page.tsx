import { PageBody, PageHero } from "@/components/page-hero"
import { Panel } from "@/components/ui/panel"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy",
}

export default function Page() {
  return (
    <div>
      <PageHero accent="slate" title="Privacy Policy" subtitle="What is collected, and what is not." />
      <PageBody className="max-w-4xl space-y-4">

      <Panel className="p-6">
        <div className="max-w-none space-y-6">
            {/* Introduction */}
            <div>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                This privacy notice for <strong>TrinidoRewards</strong> ("Company," "we," "us," or "our") describes how
                and why we may collect, store, use, and/or share ("process") your information when you use our services
                ("Services"), such as when you:
              </p>
              <ul className="list-disc list-inside text-[13px] leading-relaxed text-white/55 mt-4 space-y-2">
                <li>
                  Visit our website at{" "}
                  <a href="https://trinidorewards.com" className="text-purple-400 hover:text-purple-300">
                    trinidorewards.com
                  </a>{" "}
                  or any website of ours that links to this privacy notice
                </li>
                <li>Engage with us in other related ways, including any sales, marketing, or events</li>
              </ul>
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">
                <strong>Questions or concerns?</strong> Reading this notice will help you understand your privacy rights
                and choices. If you do not agree with our policies, please do not use our Services. For any questions,
                please contact us at{" "}
                <a href="mailto:privacy@trinidorewards.com" className="text-purple-400 hover:text-purple-300">
                  privacy@trinidorewards.com
                </a>
                .
              </p>
            </div>

            {/* Section 1 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">1. WHAT INFORMATION DO WE COLLECT?</h2>

              <h3 className="text-white text-lg font-semibold mb-3 mt-6">Personal information you disclose to us</h3>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We collect personal information you provide voluntarily when you interact
                with our Services.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">This may include:</p>
              <ul className="list-disc list-inside text-[13px] leading-relaxed text-white/55 mt-2 space-y-2">
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
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">
                All personal information you provide must be true, complete, and accurate, and you must notify us of any
                changes.
              </p>

              <h3 className="text-white text-lg font-semibold mb-3 mt-6">Information automatically collected</h3>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We collect certain information automatically when you visit or use our
                Services.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">This may include:</p>
              <ul className="list-disc list-inside text-[13px] leading-relaxed text-white/55 mt-2 space-y-2">
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
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">
                Cookies and similar technologies may also be used for analytics and functionality purposes.
              </p>
            </div>

            {/* Section 2 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We process your information to provide, improve, and administer our Services,
                communicate with you, ensure security, and comply with legal obligations.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">Examples include:</p>
              <ul className="list-disc list-inside text-[13px] leading-relaxed text-white/55 mt-2 space-y-2">
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
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">
                We may also process information for other purposes with your consent.
              </p>
            </div>

            {/* Section 3 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">3. LEGAL BASES FOR PROCESSING YOUR INFORMATION</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We process your information only when necessary and under a valid legal
                reason.
              </p>
              <ul className="list-disc list-inside text-[13px] leading-relaxed text-white/55 mt-4 space-y-2">
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
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">
                Specific rules may apply for users in the EU, UK, Canada, or other jurisdictions.
              </p>
            </div>

            {/* Section 4 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">
                4. WHEN AND WITH WHOM DO WE SHARE YOUR INFORMATION?
              </h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We share your information in limited situations with:
              </p>
              <ul className="list-disc list-inside text-[13px] leading-relaxed text-white/55 mt-4 space-y-2">
                <li>
                  <strong>Vendors, consultants, and service providers</strong> who perform services on our behalf.
                </li>
                <li>
                  <strong>Business transfers:</strong> In connection with mergers, sales, or acquisitions.
                </li>
              </ul>
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">We do not sell your personal information.</p>
            </div>

            {/* Section 5 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">5. COOKIES AND TRACKING TECHNOLOGIES</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We may use cookies, web beacons, pixels, and similar technologies to collect
                and store information. You can manage cookies through your browser settings. See our{" "}
                <strong>Cookie Notice</strong> for details.
              </p>
            </div>

            {/* Section 6 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">6. SOCIAL LOGINS</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> If you register or log in using a social media account, we may receive
                certain profile information from the social media provider.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">
                We use this information only for purposes described in this notice or clearly stated on the Services. We
                are not responsible for how the social media provider uses your data.
              </p>
            </div>

            {/* Section 7 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">7. RETENTION OF INFORMATION</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We keep your information only as long as necessary to fulfill the purposes
                outlined in this notice or as required by law.
              </p>
              <p className="text-[13px] leading-relaxed text-white/55 mt-4 leading-relaxed">
                When no longer needed, personal information is deleted, anonymized, or securely stored until deletion is
                possible.
              </p>
            </div>

            {/* Section 8 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">8. SECURITY OF INFORMATION</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We use organizational and technical measures to protect your information.
                However, no system is completely secure, and transmission of data over the Internet is at your own risk.
              </p>
            </div>

            {/* Section 9 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">9. INFORMATION FROM MINORS</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> We do not knowingly collect data from or market to children under 18.
                Accounts of minors discovered will be deactivated, and data deleted.
              </p>
            </div>

            {/* Section 10 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">10. YOUR PRIVACY RIGHTS</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                <strong>In Short:</strong> Depending on your location, you may have rights to access, correct, delete,
                restrict processing, or object to the processing of your personal information.
              </p>
              <ul className="list-disc list-inside text-[13px] leading-relaxed text-white/55 mt-4 space-y-2">
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
                    className="text-purple-400 hover:text-purple-300"
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
            </div>

            {/* Section 11 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">11. DO-NOT-TRACK FEATURES</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                Most browsers have a Do-Not-Track ("DNT") feature. Currently, we do not respond to DNT signals. If a
                standard is adopted in the future, we will update this notice.
              </p>
            </div>

            {/* Section 12 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">12. CALIFORNIA RESIDENTS</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                California residents have specific rights, including the right to request information on personal data
                shared for direct marketing and to request removal of public data for users under 18.
              </p>
            </div>

            {/* Section 13 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">13. UPDATES TO THIS NOTICE</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                We may update this Privacy Notice to stay compliant with laws. Changes are effective when posted, and
                material changes may be communicated directly.
              </p>
            </div>

            {/* Section 14 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">14. CONTACT US</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                For questions or concerns, email us at{" "}
                <a href="mailto:privacy@trinidorewards.com" className="text-purple-400 hover:text-purple-300">
                  privacy@trinidorewards.com
                </a>
                .
              </p>
            </div>

            {/* Section 15 */}
            <div>
              <h2 className="text-[15px] font-semibold text-white mb-4">15. REVIEW, UPDATE, OR DELETE DATA</h2>
              <p className="text-[13px] leading-relaxed text-white/55 leading-relaxed">
                Depending on your country's laws, you may request access, updates, or deletion of your personal
                information at{" "}
                <a href="mailto:privacy@trinidorewards.com" className="text-purple-400 hover:text-purple-300">
                  privacy@trinidorewards.com
                </a>
                .
              </p>
            </div>
        </div>
      </Panel>
      </PageBody>
    </div>
  )
}
