import { type ApiItemResponse, type AxiosItemResponse } from '@/types/api'

import type { Provider, ProvidersOverview } from '../models/provider'

const path = '/v1/providers'

/**
 * The providers endpoint is not available on the server yet, so this service
 * keeps an in-memory catalog matching what GET /v1/providers would return.
 */
const connected: Provider[] = [
  {
    id: 'prov-mimo-free',
    name: 'MiMo Free',
    slug: 'mimo-free',
    connected: true,
    accounts: 1,
    capabilities: ['chat', 'stt'],
  },
  {
    id: 'prov-gonka',
    name: 'Gonka',
    slug: 'custom-openai-gonka',
    connected: true,
    accounts: 1,
    capabilities: ['chat'],
  },
  {
    id: 'prov-id-qzz',
    name: 'ID QZZ',
    slug: 'custom-openai-id-qzz',
    connected: true,
    accounts: 1,
    capabilities: ['chat'],
  },
  {
    id: 'prov-code-craft',
    name: 'Code Craft API',
    slug: 'custom-openai-code-craft-api',
    connected: true,
    accounts: 1,
    capabilities: ['chat', 'embeddings'],
  },
  {
    id: 'prov-orcarouter',
    name: 'OrcaRouter',
    slug: 'custom-openai-orcarouter',
    connected: true,
    accounts: 1,
    capabilities: ['chat'],
  },
  {
    id: 'prov-vyce-ai',
    name: 'Vyce AI',
    slug: 'custom-openai-vyce-ai',
    connected: true,
    accounts: 1,
    capabilities: ['chat'],
  },
  {
    id: 'prov-kira-ai',
    name: 'Kira AI',
    slug: 'custom-openai-kira-ai',
    connected: true,
    accounts: 1,
    capabilities: ['chat'],
  },
]

const available: Provider[] = [
  {
    id: 'prov-custom-openai',
    name: 'Custom (OpenAI-compatible)',
    slug: 'custom-openai',
    connected: false,
    capabilities: ['chat', 'embeddings', 'image', 'tts', 'stt'],
  },
  {
    id: 'prov-custom-anthropic',
    name: 'Custom (Anthropic-compatible)',
    slug: 'custom-anthropic',
    connected: false,
    capabilities: ['chat'],
  },
  {
    id: 'prov-openai',
    name: 'OpenAI',
    slug: 'openai',
    connected: false,
    capabilities: ['chat', 'embeddings', 'image', 'tts', 'stt'],
  },
  {
    id: 'prov-anthropic',
    name: 'Anthropic',
    slug: 'anthropic',
    connected: false,
    capabilities: ['chat'],
  },
  {
    id: 'prov-claude-code',
    name: 'Claude Code',
    slug: 'claude',
    connected: false,
    official: false,
    capabilities: ['chat'],
  },
  {
    id: 'prov-gemini',
    name: 'Gemini',
    slug: 'gemini',
    connected: false,
    capabilities: ['chat', 'embeddings', 'image', 'stt', 'tts'],
  },
  {
    id: 'prov-deepseek',
    name: 'DeepSeek',
    slug: 'deepseek',
    connected: false,
    capabilities: ['chat'],
  },
  {
    id: 'prov-xai',
    name: 'xAI (Grok)',
    slug: 'xai',
    connected: false,
    capabilities: ['chat'],
  },
  {
    id: 'prov-mistral',
    name: 'Mistral',
    slug: 'mistral',
    connected: false,
    capabilities: ['chat', 'embeddings'],
  },
  {
    id: 'prov-groq',
    name: 'Groq',
    slug: 'groq',
    connected: false,
    capabilities: ['chat'],
  },
  {
    id: 'prov-cohere',
    name: 'Cohere',
    slug: 'cohere',
    connected: false,
    capabilities: ['chat', 'embeddings', 'search'],
  },
  {
    id: 'prov-perplexity',
    name: 'Perplexity',
    slug: 'perplexity',
    connected: false,
    capabilities: ['chat', 'search'],
  },
]

function list(): Promise<AxiosItemResponse<ProvidersOverview>> {
  const body: ApiItemResponse<ProvidersOverview> = {
    data: {
      connected: [...connected],
      available: [...available],
    },
    metadata: {},
  }

  const response = { data: body } as AxiosItemResponse<ProvidersOverview>

  return Promise.resolve(response)
}

export const providerServices = {
  path,
  list,
}
