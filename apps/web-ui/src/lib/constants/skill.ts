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
    description: 'Text-to-image via OpenAI or any OpenAI-compatible provider.',
    endpoint: '/v1/images/generations',
  },
  {
    slug: 'text-to-speech',
    name: 'Text-to-Speech',
    description: 'OpenAI, ElevenLabs, and Deepgram voices.',
    endpoint: '/v1/audio/speech',
  },
  {
    slug: 'speech-to-text',
    name: 'Speech-to-Text',
    description: 'Transcribe via OpenAI, Groq, ElevenLabs, and Deepgram.',
    endpoint: '/v1/audio/transcriptions',
  },
  {
    slug: 'embeddings',
    name: 'Embeddings',
    description: 'Vectors for RAG and semantic search via OpenAI, OpenRouter, NVIDIA, Cloudflare, Jina AI.',
    endpoint: '/v1/embeddings',
  },
  {
    slug: 'web-search',
    name: 'Web Search',
    description: 'Exa, Tavily, Firecrawl, Jina AI, Brave Search, Serper.',
    endpoint: '/v1/search',
  },
  {
    slug: 'web-fetch',
    name: 'Web Fetch',
    description: 'URL to markdown/text via Exa, Tavily, Firecrawl, Jina AI.',
    endpoint: '/v1/web/fetch',
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
