import type { ReactNode } from 'react'

export type HomeCopy = {
  navCta: string
  badge: string
  heroTitle: { before: string; accent: string }
  heroDescription: ReactNode
  primaryCta: string
  secondaryCta: string
  stats: { value: string; label: string }[]
  terminalUserMessage: string
  exploreTitle: string
  exploreSubtitle: string
  cards: { title: string; description: string }[]
  footerText: string
  footerCta: string
}

export const dictionaries: Record<'en-US' | 'id-ID', HomeCopy> = {
  'en-US': {
    navCta: 'Open the docs',
    badge: 'Self-hosted LLM gateway',
    heroTitle: { before: 'One base URL for', accent: 'every model' },
    heroDescription: (
      <>
        Point your SDK, <code className="font-mono">curl</code>, or favorite coding agent at a
        single endpoint. The router takes care of providers, fallbacks, spend, and guardrails.
      </>
    ),
    primaryCta: 'Quick start',
    secondaryCta: 'Explore the Gateway API',
    stats: [
      { value: '3', label: 'API dialects' },
      { value: '20+', label: 'providers out of the box' },
      { value: '∞', label: 'fallback targets' },
    ],
    terminalUserMessage: 'Hi!',
    exploreTitle: 'Explore the documentation',
    exploreSubtitle: 'From zero to your first request, then everything in between.',
    cards: [
      {
        title: 'Getting started',
        description: 'Run the server and dashboard locally within minutes.',
      },
      {
        title: 'Gateway API',
        description: 'Three dialects at once — OpenAI, Anthropic, and Responses API.',
      },
      {
        title: 'Models & Routing',
        description: 'Alias pools, chains with fallbacks, and reasoning suffixes.',
      },
      {
        title: 'Guardrails',
        description: 'PII, prompt injection, topics, toxicity, and bias — layered.',
      },
      {
        title: 'API Reference',
        description: 'Every dashboard REST endpoint for automation and integrations.',
      },
      {
        title: 'Configuration',
        description: 'Environment variables, make targets, and built-in limits.',
      },
    ],
    footerText: 'Enjoy pointing every model at one door.',
    footerCta: 'Open the docs →',
  },
  'id-ID': {
    navCta: 'Buka dokumentasi',
    badge: 'Self-hosted LLM gateway',
    heroTitle: { before: 'Satu base URL untuk', accent: 'semua model' },
    heroDescription: (
      <>
        Arahkan SDK, <code className="font-mono">curl</code>, atau coding agent favoritmu ke satu
        pintu. Router yang mengurus provider, fallback, biaya, dan guardrails.
      </>
    ),
    primaryCta: 'Mulai cepat',
    secondaryCta: 'Lihat Gateway API',
    stats: [
      { value: '3', label: 'dialek API' },
      { value: '20+', label: 'provider siap pakai' },
      { value: '∞', label: 'fallback target' },
    ],
    terminalUserMessage: 'Halo!',
    exploreTitle: 'Jelajahi dokumentasi',
    exploreSubtitle: 'Dari nol sampai request pertama, lalu semua yang ada di antaranya.',
    cards: [
      {
        title: 'Memulai',
        description: 'Jalankan server dan dashboard secara lokal dalam hitungan menit.',
      },
      {
        title: 'Gateway API',
        description: 'Tiga dialek sekaligus — OpenAI, Anthropic, dan Responses API.',
      },
      {
        title: 'Model & Routing',
        description: 'Alias pool, chain dengan fallback, dan suffix reasoning.',
      },
      {
        title: 'Guardrails',
        description: 'PII, prompt injection, topik, toksisitas, dan bias — berlapis.',
      },
      {
        title: 'API Reference',
        description: 'Semua endpoint REST dashboard untuk otomasi dan integrasi.',
      },
      {
        title: 'Konfigurasi',
        description: 'Environment variables, target make, dan batas bawaan.',
      },
    ],
    footerText: 'Selamat mengarahkan semua model ke satu pintu.',
    footerCta: 'Buka dokumentasi →',
  },
}
