import type { ProviderHealthOverview } from '../models/provider-health'
import type { ProviderHealthResources } from './types/provider-health'

// TODO: wire to the backend `/v1/provider-health` endpoints once they exist.
// The seed is returned for every window until then, mirroring the
// pre-wiring mock pattern used by the guardrails page.

const SEED: ProviderHealthOverview = {
  fallbacks: 12,
  avgP95Ms: 412,
  providers: [
    {
      id: 'ph-openai',
      name: 'openai',
      status: 'healthy',
      requests: 1240,
      fallbackRate: 0.4,
      finalFailures: 1,
      affected: null,
    },
    {
      id: 'ph-anthropic',
      name: 'anthropic',
      status: 'healthy',
      requests: 986,
      fallbackRate: 0.6,
      finalFailures: 2,
      affected: null,
    },
    {
      id: 'ph-gemini',
      name: 'gemini',
      status: 'degraded',
      requests: 412,
      fallbackRate: 8.2,
      finalFailures: 14,
      affected: 'sonnet',
    },
    {
      id: 'ph-glm-cn',
      name: 'glm-cn',
      status: 'down',
      requests: 0,
      fallbackRate: 100,
      finalFailures: 36,
      affected: 'glm-free',
    },
    {
      id: 'ph-groq',
      name: 'groq',
      status: 'healthy',
      requests: 224,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
    {
      id: 'ph-ollama',
      name: 'ollama',
      status: 'healthy',
      requests: 64,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
  ],
  models: [
    {
      id: 'ph-m-gpt4o',
      name: 'gpt-4o',
      status: 'healthy',
      requests: 640,
      fallbackRate: 0.3,
      finalFailures: 1,
      affected: null,
    },
    {
      id: 'ph-m-sonnet',
      name: 'claude-sonnet-4',
      status: 'healthy',
      requests: 512,
      fallbackRate: 0.8,
      finalFailures: 2,
      affected: null,
    },
    {
      id: 'ph-m-gemini',
      name: 'gemini-2.0-flash',
      status: 'degraded',
      requests: 188,
      fallbackRate: 9.4,
      finalFailures: 11,
      affected: 'gpt-luna',
    },
    {
      id: 'ph-m-glm',
      name: 'glm-4-flash',
      status: 'down',
      requests: 0,
      fallbackRate: 100,
      finalFailures: 21,
      affected: 'glm-free',
    },
    {
      id: 'ph-m-deepseek',
      name: 'deepseek-v3',
      status: 'healthy',
      requests: 306,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
  ],
  chains: [
    {
      id: 'ph-c-sonnet',
      name: 'sonnet',
      status: 'healthy',
      requests: 0,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
    {
      id: 'ph-c-gptluna',
      name: 'gpt-luna',
      status: 'healthy',
      requests: 0,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
    {
      id: 'ph-c-ds4flash',
      name: 'deepseek-v4-flash',
      status: 'healthy',
      requests: 0,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
    {
      id: 'ph-c-glmfree',
      name: 'glm-free',
      status: 'healthy',
      requests: 0,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
    {
      id: 'ph-c-ds4free',
      name: 'deepseek-v4-flash-free',
      status: 'healthy',
      requests: 0,
      fallbackRate: 0.0,
      finalFailures: 0,
      affected: null,
    },
  ],
  probes: [
    {
      id: 'ph-pr-pii',
      name: 'PII redaction probe',
      target: 'openai',
      status: 'pass',
      latencyMs: 412,
      lastRun: '2026-09-27 13:41:02',
    },
    {
      id: 'ph-pr-injection',
      name: 'Injection jailbreak probe',
      target: 'anthropic',
      status: 'pass',
      latencyMs: 388,
      lastRun: '2026-09-27 13:41:02',
    },
    {
      id: 'ph-pr-topic',
      name: 'Topic scope probe',
      target: 'glm-cn',
      status: 'fail',
      latencyMs: 0,
      lastRun: '2026-09-27 13:41:02',
    },
  ],
}

const resources = (): ProviderHealthResources => {
  return {
    overview: (_window) => {
      return Promise.resolve({ data: SEED, metadata: {} })
    },
  }
}

export const providerHealthServices = resources()
