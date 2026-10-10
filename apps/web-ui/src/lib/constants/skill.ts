import { env } from '@/config/env'

export type ReferenceSkill = {
  slug: string
  name: string
  description: string
  /** Router endpoint this skill teaches, shown as a code chip */
  endpoint?: string
  /** The gateway does not serve this endpoint yet, so there is no guide to copy */
  comingSoon?: boolean
}

export const REFERENCE_SKILLS: ReferenceSkill[] = [
  {
    slug: 'tera-router',
    name: 'Tera Router (Entry)',
    description: 'Setup guide and index of all capabilities.',
  },
  {
    slug: 'chat',
    name: 'Chat',
    description: 'Chat and code generation via OpenAI or Anthropic format with streaming.',
    endpoint: '/v1/chat/completions',
  },
  {
    slug: 'image-generation',
    name: 'Image Generation',
    description: 'Text-to-image via DALL-E, Imagen, FLUX, and more.',
    endpoint: '/v1/images/generations',
    comingSoon: true,
  },
  {
    slug: 'text-to-speech',
    name: 'Text-to-Speech',
    description: 'OpenAI, ElevenLabs, Edge, Google, Deepgram voices.',
    endpoint: '/v1/audio/speech',
    comingSoon: true,
  },
  {
    slug: 'speech-to-text',
    name: 'Speech-to-Text',
    description: 'Transcribe via Whisper, Groq, Gemini, Deepgram, AssemblyAI.',
    endpoint: '/v1/audio/transcriptions',
    comingSoon: true,
  },
  {
    slug: 'embeddings',
    name: 'Embeddings',
    description: 'Vectors for RAG and semantic search.',
    endpoint: '/v1/embeddings',
    comingSoon: true,
  },
  {
    slug: 'web-search',
    name: 'Web Search',
    description: 'Tavily, Exa, Brave, Serper, SearXNG, Google PSE, You.com.',
    endpoint: '/v1/search',
    comingSoon: true,
  },
  {
    slug: 'web-fetch',
    name: 'Web Fetch',
    description: 'URL to markdown/text/HTML via Firecrawl, Jina, Tavily, Exa.',
    endpoint: '/v1/web/fetch',
    comingSoon: true,
  },
]

/**
 * Build the public URL an AI agent fetches to learn a skill.
 */
export function skillUrl(slug: string): string {
  // Served by the API server, which is not the page origin in a split setup.
  return `${env.VITE_API_URL}/skills/${slug}/SKILL.md`
}

export const DIALECT_OPTIONS = [
  {
    value: 'openai',
    label: 'OpenAI-compatible',
  },
  {
    value: 'anthropic',
    label: 'Anthropic-compatible',
  },
]
