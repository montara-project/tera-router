import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { AuditListParams } from '../services/types/audit'

import { services } from '../services'

export const AUDIT_QUERY_KEY = 'audit'

const list = (params: AuditListParams) =>
  queryOptions({
    queryKey: [AUDIT_QUERY_KEY, 'list', params],
    queryFn: async () => {
      const res = await services.audit.list(params)
      return res.data
    },
    // Keep the current page on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
  })

const stats = () =>
  queryOptions({
    queryKey: [AUDIT_QUERY_KEY, 'stats'],
    queryFn: async () => {
      const res = await services.audit.stats()
      return res.data
    },
  })

const verify = () =>
  mutationOptions({
    mutationFn: async () => {
      const res = await services.audit.verify()
      return res.data
    },
  })

const exportJsonl = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.audit.exportJsonl()
      return res.data
    },
    // The export is itself audited, so the list gains a row.
    onSuccess: () => qc.invalidateQueries({ queryKey: [AUDIT_QUERY_KEY] }),
  })
}

export const auditQueries = { list, stats, verify, exportJsonl }
