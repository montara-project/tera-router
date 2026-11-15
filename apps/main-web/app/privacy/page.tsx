import type { Metadata } from 'next'

import { GITHUB_URL } from '@/components/landing/section'
import { LegalPage, paragraph, proseLink, type LegalSection } from '@/components/legal/legal-page'
import { pageMeta } from '@/lib/constants/meta'

export const metadata: Metadata = pageMeta({
  title: 'Privacy Policy',
  description:
    'How the Tera Router AI service handles your data: account and billing records and per-request metering — and no stored prompts.',
  path: '/privacy',
})

// Static legal copy: same edge-cache treatment as the landing page (see the
// note on the cache/revalidate tradeoff there).
export const revalidate = 600

const SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: (
      <p className={paragraph}>
        This policy covers the Tera Router website, the documentation at{' '}
        <a className={proseLink} href="https://docs.terarouter.xyz">
          docs.terarouter.xyz
        </a>
        {', '}and the Tera Router AI service — the developer portal and its AI gateway API. Short
        version: the service needs account, billing, and metering data to run, and it does not store
        your prompts. The marketing site itself counts anonymous page visits and collects nothing
        else.
      </p>
    ),
  },
  {
    id: 'account-data',
    title: 'Account data',
    body: (
      <p className={paragraph}>
        An account holds your name, email address, and optional profile image, with
        email-and-password sign-in. Verification and account emails are delivered through an email
        provider (Resend). Login sessions record the IP address and user agent of each device, and
        you can view and revoke every session in the portal's settings.
      </p>
    ),
  },
  {
    id: 'billing-data',
    title: 'Billing and usage data',
    body: (
      <p className={paragraph}>
        Prepaid credits and top ups are recorded so your balance is right. Every request through the
        gateway is metered: provider, model, token counts, cost, latency, errors, the client name,
        and the client IP are logged per request. This is what bills you correctly, powers your
        usage dashboard, and lets us stop abuse. Token counts and costs are metadata — not content.
      </p>
    ),
  },
  {
    id: 'prompts',
    title: "We don't store your prompts",
    body: (
      <p className={paragraph}>
        Request and response content streams through the gateway so it can be routed, checked
        against your budgets, and metered — but it is never written to the database. Only the
        per-request metadata above is kept. Upstream AI providers receive and process your prompt
        content under their own privacy policies when you use the service.
      </p>
    ),
  },
  {
    id: 'keys-sessions',
    title: 'API keys and sessions',
    body: (
      <p className={paragraph}>
        API keys are stored as an argon2id hash plus an envelope-encrypted copy; the plaintext is
        shown once when you create or rotate a key and is recoverable only through the reveal flow
        in the portal. Login sessions can be listed and revoked at any time in the portal's
        settings.
      </p>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <p className={paragraph}>
        The portal stores sign-in tokens in local storage so you stay signed in, and it uses the
        cookies needed to keep sessions secure. The marketing site counts page visits with
        self-hosted, cookieless analytics. No advertising cookies, no cross-site tracking, and no
        sale of data — anywhere.
      </p>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third parties',
    body: (
      <ul className="grid gap-2.5">
        {[
          'Upstream AI providers (OpenAI, Anthropic, Google, OpenRouter, and others) receive and process the content of your requests when you use the service.',
          'Resend delivers transactional email such as verification and account notices.',
          'Google Fonts serves the marketing site’s web fonts.',
          'Nothing is sold, rented, or shared with data brokers.',
        ].map((rule) => (
          <li className="flex gap-3" key={rule}>
            <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
            <span className={paragraph}>{rule}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: 'retention-deletion',
    title: 'Retention and deletion',
    body: (
      <p className={paragraph}>
        Usage records are kept as long as needed to bill correctly, prevent abuse, and meet
        record-keeping duties. Account data is kept until you close the account. To close your
        account or request deletion of your data, use the portal's support page — records the law
        requires us to keep are retained as required.
      </p>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <p className={paragraph}>
        You can access, correct, and delete your account data: revoke sessions and rotate keys
        yourself in the portal, and reach out for anything else. If you have privacy questions or
        requests, use the portal's support page or open an issue on{' '}
        <a className={proseLink} href={`${GITHUB_URL}/issues`}>
          GitHub
        </a>
        .
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p className={paragraph}>
        This policy may change as the service evolves. The last-updated date at the top reflects the
        current version.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p className={paragraph}>
        Questions about privacy? Use the portal's support page or open an issue on{' '}
        <a className={proseLink} href={`${GITHUB_URL}/issues`}>
          GitHub
        </a>
        .
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="What the Tera Router AI service collects to operate — account, billing, and metering data, but not your prompts — and how the website itself handles data."
      lastUpdated="November 15, 2026"
      sections={SECTIONS}
    />
  )
}
