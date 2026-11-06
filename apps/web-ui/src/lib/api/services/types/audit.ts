import type { AxiosResponse } from 'axios'

import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { AuditEntry, AuditOutcome, AuditStats, AuditVerification } from '../../models/audit'

export type AuditListParams = {
  search?: string
  outcome?: AuditOutcome
  /** Action prefix, e.g. "keys". */
  category?: string
  offset?: number
  limit?: number
}

export type AuditResources = {
  list: (params?: AuditListParams) => Promise<AxiosListResponse<AuditEntry>>
  stats: () => Promise<AxiosItemResponse<AuditStats>>
  verify: () => Promise<AxiosItemResponse<AuditVerification>>
  exportJsonl: () => Promise<AxiosResponse<Blob>>
}
