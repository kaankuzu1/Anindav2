import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Mindora Systems',
  description: 'Privacy Policy for Mindora Systems cold email outreach platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: February 13, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p>
            Mindora Systems (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, store, and share your information
            when you use our cold email outreach platform (&quot;Service&quot;).
          </p>
          <p className="mt-3">
            By using the Service, you consent to the practices described in this policy. If you do not agree,
            please discontinue use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <p>We collect the following categories of information:</p>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Account Information</h3>
          <p>
            When you register, we collect your name, email address, and authentication credentials (via email/password
            or OAuth through Google or Microsoft).
          </p>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Lead Data</h3>
          <p>
            You may upload lead lists containing names, email addresses, company names, job titles, phone
            numbers, and other professional contact information. You are responsible for ensuring you have the
            right to use this data.
          </p>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Usage Data</h3>
          <p>
            We automatically collect information about how you use the Service, including pages visited,
            features used, campaign performance metrics, and interaction timestamps.
          </p>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Email Account Data</h3>
          <p>
            When you connect email accounts (Gmail, Microsoft, SMTP), we store encrypted OAuth tokens or
            credentials to send and receive emails on your behalf. We access email content only as necessary to
            provide warm-up, campaign sending, and reply scanning features.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Provide, maintain, and improve the Service</li>
            <li>Send campaign emails and warm-up emails on your behalf</li>
            <li>Scan incoming replies and classify them using AI</li>
            <li>Generate analytics and deliverability reports</li>
            <li>Personalize email content using AI when you enable smart templates</li>
            <li>Communicate with you about your account, updates, and support</li>
            <li>Detect and prevent fraud, abuse, and security incidents</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Lead Data Processing</h2>
          <p>
            With respect to lead data you upload to the Service:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>
              <strong>You are the data controller</strong> &mdash; you determine the purposes and means of
              processing your lead data
            </li>
            <li>
              <strong>We act as a data processor</strong> &mdash; we process lead data solely on your behalf
              and according to your instructions
            </li>
            <li>We do not sell, rent, or share your lead data with third parties for their own purposes</li>
            <li>We do not use your lead data to build marketing profiles or for cross-customer analytics</li>
          </ul>
          <p className="mt-3">
            You are responsible for ensuring you have a lawful basis (such as legitimate interest or consent)
            for contacting the leads you upload and for providing any required disclosures to those individuals.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Email Content and AI</h2>
          <p>
            When you use our AI features (email generation, smart templates, reply classification), your email
            content and lead data may be sent to third-party AI providers for processing. Specifically:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>AI-generated content is processed via OpenRouter API</li>
            <li>We send only the minimum data necessary for personalization (lead name, company, title, email context)</li>
            <li>AI providers process data according to their own privacy policies and do not use your data for model training</li>
            <li>You can disable AI features at any time by turning off smart templates</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Storage and Security</h2>
          <p>
            We implement industry-standard security measures to protect your data:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Data is stored in Supabase-hosted PostgreSQL databases with Row Level Security (RLS) policies ensuring tenant isolation</li>
            <li>Email account credentials (OAuth tokens, SMTP passwords) are encrypted at rest using AES-256</li>
            <li>All data in transit is encrypted via TLS/HTTPS</li>
            <li>Access to production systems is restricted to authorized personnel</li>
          </ul>
          <p className="mt-3">
            While we strive to protect your data, no method of electronic storage or transmission is 100%
            secure. You are responsible for maintaining the security of your account credentials.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Third-Party Services</h2>
          <p>
            The Service integrates with the following third-party services, each with their own privacy
            policies:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Google</strong> (Gmail API) &mdash; for sending and receiving emails via connected Gmail accounts</li>
            <li><strong>Microsoft</strong> (Graph API) &mdash; for sending and receiving emails via connected Outlook accounts</li>
            <li><strong>OpenRouter</strong> &mdash; for AI-powered email generation and reply classification</li>
            <li><strong>Supabase</strong> &mdash; for database hosting, authentication, and real-time features</li>
          </ul>
          <p className="mt-3">
            We only share the minimum data necessary for each integration to function. We encourage you to
            review the privacy policies of these services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active or as needed to provide the Service.
            Specifically:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Account data:</strong> retained until account deletion</li>
            <li><strong>Lead data:</strong> retained until you delete it or close your account</li>
            <li><strong>Campaign and email data:</strong> retained for the lifetime of your account for analytics purposes</li>
            <li><strong>Warm-up data:</strong> retained for 90 days for deliverability analysis</li>
          </ul>
          <p className="mt-3">
            After account closure, we retain your data for 30 days to allow for account recovery, after which
            it is permanently deleted from our systems and backups.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Your Rights</h2>
          <p>
            Depending on your jurisdiction, you may have the following rights regarding your personal data:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
            <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete data</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data (&quot;right to be forgotten&quot;)</li>
            <li><strong>Portability:</strong> Request your data in a structured, machine-readable format</li>
            <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
            <li><strong>Objection:</strong> Object to processing based on legitimate interest</li>
            <li><strong>Withdrawal of consent:</strong> Withdraw consent at any time where processing is based on consent</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@mindorasystems.com" className="text-blue-600 hover:underline">
              privacy@mindorasystems.com
            </a>
            . We will respond to your request within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cookies and Tracking</h2>
          <p>
            The Service uses essential cookies for authentication and session management. We do not use
            third-party advertising cookies or cross-site tracking.
          </p>
          <p className="mt-3">
            For campaign emails, we may embed tracking pixels and wrap links to measure open and click rates.
            This tracking data is used solely to provide you with campaign analytics and is not shared with
            third parties.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes by
            email or through the Service at least 14 days before the changes take effect. Your continued use
            of the Service after changes become effective constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Information</h2>
          <p>
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="mt-3">
            <strong>Email:</strong>{' '}
            <a href="mailto:privacy@mindorasystems.com" className="text-blue-600 hover:underline">
              privacy@mindorasystems.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
