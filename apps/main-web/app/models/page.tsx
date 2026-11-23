import type { Metadata } from 'next'

import { ArrowRight } from 'lucide-react'

import type { PublicModel } from '@/components/models/format'

import { APP_URL, MODELS_API_URL, Rail, primaryButton } from '@/components/landing/section'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'
import { ModelCatalog } from '@/components/models/model-catalog'
import { pageMeta } from '@/lib/constants/meta'

export const metadata: Metadata = pageMeta({
  title: 'Models',
  description:
    'Every model on Tera Router: input, output and cache prices per million tokens, context windows, and the saving against each listed price.',
  path: '/models',
})

// The listing changes when an operator edits a route, not per visit: render it
// at most every 5 minutes and let the Workers cache serve it in between.
export const revalidate = 300

/** GET /v1/public/models from the hosted API; null when it cannot be reached. */
async function loadModels(): Promise<PublicModel[] | null> {
  try {
    const res = await fetch(`${MODELS_API_URL}/v1/public/models`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: PublicModel[] }
    return body.data ?? []
  } catch {
    return null
  }
}

export default async function ModelsPage() {
  const models = await loadModels()

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <Rail className="px-5 pt-16 pb-20 sm:px-12 sm:pt-24 sm:pb-28">
          <div className="grid items-end gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <h1 className="font-display text-4xl leading-[1.05] font-medium tracking-[-0.035em] text-balance sm:text-5xl">
              Models
            </h1>
            <div>
              <p className="text-lg leading-relaxed text-pretty text-faint">
                Find a model, compare prices per million tokens, and copy its id into any OpenAI or
                Anthropic SDK.
              </p>
              <a className={`${primaryButton} mt-6`} href={APP_URL}>
                Get an API key
                <ArrowRight aria-hidden className="size-4" />
              </a>
            </div>
          </div>

          <div className="mt-12 sm:mt-16">
            {models ? (
              <ModelCatalog models={models} />
            ) : (
              <div
                role="alert"
                className="rounded-2xl border border-line bg-surface px-6 py-12 text-center elev-1"
              >
                <p className="font-display text-lg">The model list is unavailable right now</p>
                <p className="mt-1 text-sm text-faint">Please try again in a few minutes.</p>
              </div>
            )}
          </div>
        </Rail>
      </main>
      <SiteFooter />
    </div>
  )
}
