import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { CustomProviderDto, ProviderRoutingDto } from '../../dtos/provider/schema'
import type { Models } from '../../models'

export type ProviderResources = {
  list: () => Promise<AxiosItemResponse<Models.ProvidersOverview>>
  customList: () => Promise<AxiosListResponse<Models.CustomProvider>>
  customGet: (id: string) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customGetBySlug: (slug: string) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customStore: (payload: CustomProviderDto) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customUpdate: (
    id: string,
    payload: CustomProviderDto
  ) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customDelete: (id: string) => Promise<AxiosDeleteResponse>
  /** Deletes the listed providers that have no account; the server skips the rest. */
  customBulkDelete: (
    ids: string[]
  ) => Promise<AxiosItemResponse<{ deleted: string[]; skipped: number }>>
  customModels: (
    id: string,
    params?: { search?: string; offset?: number; limit?: number }
  ) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  customModelsSync: (id: string) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  customModelsUpdate: (
    id: string,
    payload: { models: { id: string; state: Models.ProviderModelState }[] }
  ) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  /** catalog-provider model sync (openrouter, ollama, ollama-local, cline) */
  modelsSync: (slug: string) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  /** catalog-provider stored catalog with per-model states; server-side search + paging */
  modelsList: (
    slug: string,
    params?: { search?: string; offset?: number; limit?: number }
  ) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  modelsUpdate: (
    slug: string,
    payload: { models: { id: string; state: Models.ProviderModelState }[] }
  ) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  /** account strategy of any provider (catalog or custom slug) */
  routing: (slug: string) => Promise<AxiosItemResponse<Models.ProviderRouting>>
  updateRouting: (
    slug: string,
    payload: ProviderRoutingDto
  ) => Promise<AxiosItemResponse<Models.ProviderRouting>>
  /** catalog-provider one-shot model test (chat completion with the stored credential) */
  modelsTest: (
    slug: string,
    payload: { model: string; messages: Models.ModelTestMessage[] }
  ) => Promise<AxiosItemResponse<Models.ModelTestResult>>
  /** custom-provider one-shot model test */
  customModelsTest: (
    id: string,
    payload: { model: string; messages: Models.ModelTestMessage[] }
  ) => Promise<AxiosItemResponse<Models.ModelTestResult>>
  /** streamed model test: onDelta gets each text fragment, resolves with the final result */
  modelsTestStream: (
    slug: string,
    payload: { model: string; messages: Models.ModelTestMessage[] },
    onDelta: (text: string) => void
  ) => Promise<Models.ModelTestResult>
  customModelsTestStream: (
    id: string,
    payload: { model: string; messages: Models.ModelTestMessage[] },
    onDelta: (text: string) => void
  ) => Promise<Models.ModelTestResult>
}
