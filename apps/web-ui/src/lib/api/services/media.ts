import { type ApiItemResponse, type AxiosItemResponse } from '@/types/api'

import type { MediaProvider } from '../models/media'

const path = '/v1/media'

/**
 * The media endpoint is not available on the server yet, so this service keeps
 * an in-memory catalog matching what GET /v1/media would return.
 */
const providers: MediaProvider[] = [
  {
    id: 'media-openrouter',
    name: 'OpenRouter',
    slug: 'openrouter',
    capabilities: ['embed', 'image_to_text'],
  },
  {
    id: 'media-nvidia',
    name: 'NVIDIA NIM',
    slug: 'nvidia',
    capabilities: ['tts', 'embed'],
  },
  {
    id: 'media-vllm',
    name: 'vLLM',
    slug: 'vllm',
    capabilities: ['embed'],
  },
  {
    id: 'media-gemini',
    name: 'Gemini',
    slug: 'gemini',
    capabilities: ['embed', 'image', 'search', 'tts', 'stt', 'image_to_text'],
  },
  {
    id: 'media-github',
    name: 'GitHub Copilot',
    slug: 'github',
    capabilities: ['embed'],
  },
  {
    id: 'media-openai',
    name: 'OpenAI',
    slug: 'openai',
    capabilities: ['embed', 'tts', 'stt', 'image', 'search'],
  },
  {
    id: 'media-mistral',
    name: 'Mistral',
    slug: 'mistral',
    capabilities: ['embed', 'image_to_text'],
  },
  {
    id: 'media-together',
    name: 'Together AI',
    slug: 'together',
    capabilities: ['embed'],
  },
  {
    id: 'media-fireworks',
    name: 'Fireworks AI',
    slug: 'fireworks',
    capabilities: ['embed'],
  },
  {
    id: 'media-nebius',
    name: 'Nebius AI',
    slug: 'nebius',
    capabilities: ['embed'],
  },
  {
    id: 'media-venice',
    name: 'Venice AI',
    slug: 'venice',
    capabilities: ['embed', 'image'],
  },
  {
    id: 'media-voyage',
    name: 'Voyage AI',
    slug: 'voyage-ai',
    capabilities: ['embed'],
  },
  {
    id: 'media-jina',
    name: 'Jina AI',
    slug: 'jina-ai',
    capabilities: ['embed'],
  },
]

function list(): Promise<AxiosItemResponse<{ providers: MediaProvider[] }>> {
  const body: ApiItemResponse<{ providers: MediaProvider[] }> = {
    data: { providers: [...providers] },
    metadata: {},
  }

  const response = { data: body } as AxiosItemResponse<{ providers: MediaProvider[] }>

  return Promise.resolve(response)
}

export const mediaServices = {
  path,
  list,
}
