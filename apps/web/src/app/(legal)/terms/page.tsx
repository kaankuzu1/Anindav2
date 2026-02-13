import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Mindora Systems',
  description: 'Terms of Service for Mindora Systems cold email outreach platform.',
};

export default function TermsOfServicePage() {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: February 13, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Mindora Systems platform (&quot;Service&quot;), you agree to be bound by these
            Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not use the Service.
            These Terms constitute a legally binding agreement between you (&quot;User&quot;, &quot;you&quot;) and
            Mindora Systems (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;).
          </p>
          <p className="mt-3">
            We reserve the right to update these Terms at any time. Continued use of the Service after changes
            constitutes acceptance of the revised Terms. We will notify you of material changes via email or
            in-app notification.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
          <p>
            Mindora Systems is a cold email outreach platform designed for professional business development.
            The Service includes:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Multi-inbox management and email account connection (Gmail, Microsoft, SMTP)</li>
            <li>Email warm-up automation to improve deliverability</li>
            <li>Campaign creation with multi-step sequences and A/B testing</li>
            <li>AI-powered email personalization and content generation</li>
            <li>Lead management with import, segmentation, and status tracking</li>
            <li>Reply management with AI-assisted intent classification</li>
            <li>Analytics and deliverability monitoring</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
          <p>
            To use the Service, you must create an account by providing accurate and complete information. You
            are responsible for maintaining the confidentiality of your account credentials and for all
            activities that occur under your account.
          </p>
          <p className="mt-3">
            You must be at least 18 years old and have the legal authority to enter into these Terms. If you
            are using the Service on behalf of an organization, you represent that you have the authority to
            bind that organization to these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Acceptable Use Policy</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Send unsolicited bulk emails (spam) or emails that violate applicable anti-spam laws</li>
            <li>Send emails containing malicious content, malware, or phishing attempts</li>
            <li>Distribute illegal, harmful, threatening, abusive, or harassing content</li>
            <li>Impersonate any person or entity, or falsely represent your affiliation</li>
            <li>Harvest or collect email addresses without proper consent</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Attempt to gain unauthorized access to any part of the Service</li>
            <li>Use the Service to promote illegal products, services, or activities</li>
            <li>Resell or redistribute the Service without written authorization</li>
          </ul>
          <p className="mt-3">
            We reserve the right to suspend or terminate accounts that violate this policy without prior
            notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Email Sending Compliance</h2>
          <p>
            You are solely responsible for ensuring that your email campaigns comply with all applicable laws
            and regulations, including but not limited to:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>CAN-SPAM Act</strong> (United States) &mdash; accurate headers, valid physical address, clear opt-out mechanism</li>
            <li><strong>GDPR</strong> (European Union) &mdash; lawful basis for processing, data subject rights, consent where required</li>
            <li><strong>CASL</strong> (Canada) &mdash; express or implied consent, sender identification, unsubscribe mechanism</li>
            <li><strong>PECR</strong> (United Kingdom) &mdash; consent requirements for electronic communications</li>
          </ul>
          <p className="mt-3">
            All campaign emails sent through the Service must include a functioning unsubscribe mechanism. You
            must honor unsubscribe requests within 10 business days. The Service provides unsubscribe header
            support, but you are responsible for compliance with the laws of the jurisdictions in which your
            recipients are located.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Warm-Up and Deliverability</h2>
          <p>
            The warm-up feature is designed to gradually increase your email sending volume and improve inbox
            placement. While we employ best practices, we provide the warm-up service on a best-effort basis
            and make no guarantees regarding:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Specific deliverability rates or inbox placement percentages</li>
            <li>Removal from email provider blocklists or spam filters</li>
            <li>Improvement in sender reputation scores</li>
          </ul>
          <p className="mt-3">
            Deliverability depends on many factors outside our control, including your email content, sending
            practices, recipient engagement, and email provider policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Ownership</h2>
          <p>
            You retain full ownership of all data you upload, input, or generate through the Service,
            including lead lists, email templates, campaign content, and analytics data. We do not claim any
            intellectual property rights over your content.
          </p>
          <p className="mt-3">
            You grant us a limited, non-exclusive license to use your data solely for the purpose of providing
            and improving the Service. This license terminates when you delete your data or close your account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
          <p>
            The Service, including its software, design, logos, and documentation, is the intellectual property
            of Mindora Systems and is protected by copyright, trademark, and other intellectual property laws.
            You may not copy, modify, distribute, or reverse-engineer any part of the Service without our
            written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Third-Party Integrations</h2>
          <p>
            The Service integrates with third-party services including Google (Gmail API), Microsoft (Graph
            API), and AI providers. Your use of these integrations is subject to the respective third-party
            terms of service:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Google API Services User Data Policy</li>
            <li>Microsoft Graph API Terms of Use</li>
          </ul>
          <p className="mt-3">
            We are not responsible for the availability, performance, or policies of third-party services. You
            authorize us to access your connected email accounts solely for the purpose of sending emails,
            scanning replies, and performing warm-up activities on your behalf.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Payment and Billing</h2>
          <p>
            Certain features of the Service may require a paid subscription. By subscribing, you agree to pay
            all applicable fees. Subscriptions renew automatically unless canceled before the renewal date.
            Refunds are handled in accordance with our refund policy.
          </p>
          <p className="mt-3">
            We reserve the right to change pricing with 30 days&apos; notice. Price changes will not affect
            your current billing period.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Mindora Systems shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including but not limited to loss of
            profits, data, business opportunities, or goodwill, arising from your use of the Service.
          </p>
          <p className="mt-3">
            Our total liability for any claims arising from or related to the Service shall not exceed the
            amount you paid to us in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Mindora Systems, its officers, directors, employees, and
            agents from any claims, damages, losses, or expenses (including legal fees) arising from your use
            of the Service, your violation of these Terms, or your violation of any applicable laws or
            third-party rights.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Termination</h2>
          <p>
            Either party may terminate this agreement at any time. You may close your account through the
            Service settings. We may suspend or terminate your account if you violate these Terms or if
            required by law.
          </p>
          <p className="mt-3">
            Upon termination, your right to use the Service ceases immediately. We will retain your data for
            30 days after account closure, during which you may request an export. After this period, your
            data will be permanently deleted.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact Information</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="mt-3">
            <strong>Email:</strong>{' '}
            <a href="mailto:legal@mindorasystems.com" className="text-blue-600 hover:underline">
              legal@mindorasystems.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
