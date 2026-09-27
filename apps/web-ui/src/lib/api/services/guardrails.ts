import type { ApiItemResponse } from '@/types/api'

import type { GuardrailsOverview } from '../models/guardrails'

// TODO: wire to the backend `/v1/guardrails` endpoints once they exist.
// Until then the guardrails page renders on this seed data and its
// mutations only toast, mirroring the pre-wiring pattern used by the
// other pages before `feat: wire web-ui API layer`.

const SEED: GuardrailsOverview = {
  externalDetectors: true,
  policies: [
    {
      id: 'gr-global',
      name: 'Global Guardrails',
      enabled: true,
      scope: 'global',
      protections: ['PII', 'Injection', 'Topics', 'Toxicity', 'Bias'],
      config: {
        pii: {
          enabled: true,
          entities: [
            'EMAIL_ADDRESS',
            'PHONE_NUMBER',
            'CREDIT_CARD',
            'IBAN_CODE',
            'IP_ADDRESS',
            'URL',
            'ID_NIK',
            'ID_NPWP',
            'ID_PASSPORT',
            'PERSON',
          ],
          maskingStrategy: 'redact',
          minConfidence: 0.5,
          engine: 'native',
          scanOutput: false,
        },
        injection: { enabled: true, severity: 'high', action: 'block' },
        topics: {
          enabled: true,
          mode: 'block',
          topics: ['programming', 'devops', 'cyber security'],
          action: 'warn',
          engine: 'keyword',
        },
        toxicity: {
          enabled: true,
          categories: ['profanity', 'hate speech', 'harassment', 'violence', 'sexual'],
          threshold: 60,
          action: 'warn',
          engine: 'native',
        },
        bias: {
          enabled: true,
          categories: ['political', 'gender', 'ethnic', 'religious'],
          threshold: 60,
          action: 'log',
        },
      },
    },
    {
      id: 'gr-anthropic',
      name: 'Anthropic Safety',
      enabled: true,
      scope: 'provider',
      target: 'anthropic',
      protections: ['PII', 'Injection'],
    },
    {
      id: 'gr-openai',
      name: 'OpenAI Moderation Bridge',
      enabled: false,
      scope: 'provider',
      target: 'openai',
      protections: ['Toxicity'],
    },
    {
      id: 'gr-claude',
      name: 'Claude Model Guard',
      enabled: true,
      scope: 'model',
      target: 'claude',
      protections: ['Topics', 'Bias'],
    },
    {
      id: 'gr-gemini',
      name: 'Gemini Image Filter',
      enabled: false,
      scope: 'model',
      target: 'gemini',
      protections: ['Toxicity'],
    },
    {
      id: 'gr-rag',
      name: 'RAG Input Filter',
      enabled: true,
      scope: 'chain',
      target: 'support-rag',
      protections: ['Injection', 'Topics'],
    },
    {
      id: 'gr-coder',
      name: 'Coder Output Filter',
      enabled: false,
      scope: 'chain',
      target: 'coder-chain',
      protections: ['PII'],
    },
    {
      id: 'gr-prod-keys',
      name: 'Production Keys Policy',
      enabled: true,
      scope: 'key',
      target: 'key-production',
      protections: ['PII', 'Toxicity', 'Injection'],
    },
  ],
  audit: [
    {
      id: 'a-01',
      time: '2026-09-27 12:11:49',
      actor: 'admin@tera.local',
      action: 'policy.updated',
      target: 'Global Guardrails',
    },
    {
      id: 'a-02',
      time: '2026-09-27 11:48:19',
      actor: 'admin@tera.local',
      action: 'policy.created',
      target: 'Production Keys Policy',
    },
    {
      id: 'a-03',
      time: '2026-09-26 17:02:35',
      actor: 'admin@tera.local',
      action: 'policy.disabled',
      target: 'OpenAI Moderation Bridge',
    },
    {
      id: 'a-04',
      time: '2026-09-26 09:15:08',
      actor: 'system',
      action: 'export.completed',
      target: 'guardrails-2026-09-26.json',
    },
  ],
}

function overview(): Promise<ApiItemResponse<GuardrailsOverview>> {
  return Promise.resolve({ data: SEED, metadata: {} })
}

function updateExternalDetectors(_enabled: boolean): Promise<ApiItemResponse<GuardrailsOverview>> {
  return overview()
}

export const guardrailsServices = {
  overview,
  updateExternalDetectors,
}
