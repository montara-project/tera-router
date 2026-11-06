import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { ReauthDto } from '../../dtos/auth/schema'
import type { CreateKeyDto, UpdateKeyDto } from '../../dtos/key/schema'
import type { PaginateDto } from '../../dtos/paginate'
import type { ApiKey, ApiKeyDetail, KeyGuardrailStats, KeyUsage } from '../../models/key'

export type KeyResources = {
  list: (params?: PaginateDto) => Promise<AxiosListResponse<ApiKey>>
  get: (id: string) => Promise<AxiosItemResponse<ApiKeyDetail>>
  usage: (id: string) => Promise<AxiosItemResponse<KeyUsage>>
  guardrailStats: (id: string) => Promise<AxiosItemResponse<KeyGuardrailStats>>
  store: (payload?: CreateKeyDto) => Promise<AxiosItemResponse<ApiKey>>
  update: (id: string, payload: UpdateKeyDto) => Promise<AxiosItemResponse<ApiKey>>
  toggleStatus: (id: string, disabled: boolean) => Promise<AxiosItemResponse<{ id: string }>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
  issuePortal: (id: string) => Promise<AxiosItemResponse<{ portal_token: string }>>
  revokePortal: (id: string) => Promise<AxiosItemResponse<{ portal_token: string }>>
  reveal: (
    id: string,
    payload: ReauthDto
  ) => Promise<AxiosItemResponse<{ id: string; full_key: string } | { totp_required: true }>>
  rotate: (
    id: string,
    payload: ReauthDto
  ) => Promise<
    AxiosItemResponse<
      { id: string; key_preview: string; full_key: string } | { totp_required: true }
    >
  >
}
