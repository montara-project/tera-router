import type { Metadata } from 'next'

import { GITHUB_URL } from '@/components/landing/section'
import { LegalPage, paragraph, proseLink, type LegalSection } from '@/components/legal/legal-page'
import { pageMeta } from '@/lib/constants/meta'

export const metadata: Metadata = pageMeta({
  title: 'Terms of Service',
  description:
    'The terms for the Tera Router AI service: one OpenAI-compatible API for many AI models, prepaid credits, and metered usage.',
  path: '/terms',
})

// Static legal copy: same edge-cache treatment as the landing page (see the
// note on the cache/revalidate tradeoff there).
export const revalidate = 600

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance',
    body: (
      <p className={paragraph}>
        These terms are an agreement between you and Montara Projects (“we”, “us”) for the Tera
        Router AI service — the developer portal and its AI gateway API — together with the Tera
        Router website and documentation (together, the “service”). By creating an account or using
        the service, you accept these terms. If you don't agree, please don't use it.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'The service',
    body: (
      <p className={paragraph}>
        Tera Router gives you one OpenAI- and Anthropic-compatible API for many AI models. You
        register and sign in, top up prepaid credits, mint an API key, and send requests to the
        gateway. The service routes each request to the right AI provider — OpenAI, Anthropic,
        Google, OpenRouter, and others — meters usage per token, deducts it from your balance, and
        applies your budgets. Model availability and prices are shown in the model catalog and can
        change as providers change theirs.
      </p>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    body: (
      <p className={paragraph}>
        Register with an email address you control and keep your credentials and API keys
        confidential. You're responsible for everything done through your account and keys, for
        keeping your contact email current, and for reviewing and revoking sessions in the portal
        when a device is lost or compromised. You must be old enough to form a binding contract, and
        the information you give us must be accurate.
      </p>
    ),
  },
  {
    id: 'billing',
    title: 'Credits, top up and billing',
    body: (
      <p className={paragraph}>
        The service is prepaid. You top up credits through the payment methods offered in the
        portal, and each request is metered per token and priced per the model catalog at the time
        of the request. Your balance decreases as you use the service; when a budget or hard cutoff
        is reached, requests stop until you top up or raise the limit. Prices may change — changes
        apply to requests made after they take effect. If a top up fails or a deduction looks wrong,
        contact support and we'll sort it out.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <ul className="grid gap-2.5">
        {[
          "Use the service lawfully, and don't send content that violates applicable law or the usage policies of the upstream AI providers.",
          "Don't share, sell, or sublicense your account or API keys, or resell the service itself without written permission.",
          "Don't circumvent budgets, rate limits, or quotas, and don't probe, stress, or attack the infrastructure.",
          "Don't present your use of the service as an official affiliation with or endorsement by the project.",
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
    id: 'third-party',
    title: 'Third-party providers and trademarks',
    body: (
      <p className={paragraph}>
        The content of your requests is processed by upstream AI providers under their own terms and
        usage policies — using Tera Router doesn't shield you from them. Provider names and logos
        are trademarks of their respective owners; listing them describes compatibility only, and
        the project is not affiliated with, sponsored by, or endorsed by any provider.
      </p>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and termination',
    body: (
      <p className={paragraph}>
        We may limit, suspend, or close accounts that breach these terms, create legal or security
        risk, remain unpaid, or abuse the service. Where practical, we'll tell you what happened and
        what would fix it. You can stop using the service and close your account at any time. We may
        retain records where the law requires it.
      </p>
    ),
  },
  {
    id: 'software-license',
    title: 'The self-hosted software is separate',
    body: (
      <p className={paragraph}>
        Tera Router is also open-source software you can run on your own infrastructure. The
        software is licensed under{' '}
        <a className={proseLink} href={`${GITHUB_URL}/blob/main/LICENSE.md`}>
          GPL-3.0
        </a>{' '}
        — what you do with the software is governed by its license, and these terms govern only the
        hosted service and the site.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers and liability',
    body: (
      <p className={paragraph}>
        The service is provided “as is” and “as available”. Model availability, pricing, and output
        quality depend on upstream providers and can change without notice; we don't warrant that
        any specific model stays available. To the maximum extent permitted by law, we are not
        liable for indirect or consequential damages, and our total liability is capped at what you
        paid us in the three months before the claim. The GPL-3.0 license contains the warranty and
        liability terms that apply to the software itself.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p className={paragraph}>
        The service, its models, its prices, and these terms may change as the project evolves. The
        last-updated date at the top reflects the current version, and continuing to use the service
        after a change means you accept the updated terms.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p className={paragraph}>
        Questions, account closure, or a dispute? Use the support page in the developer portal or
        open an issue on{' '}
        <a className={proseLink} href={`${GITHUB_URL}/issues`}>
          GitHub
        </a>
        .
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="The agreement between you and Montara Projects for the Tera Router AI service: one API for many AI models, prepaid credits, and metered usage. The self-hosted software remains governed by its own GPL-3.0 license."
      lastUpdated="November 15, 2026"
      sections={SECTIONS}
    />
  )
}
