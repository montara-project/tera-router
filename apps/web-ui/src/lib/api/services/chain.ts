import chainJson from '@/data/mock/chain.json'
import { HTTP_METHOD, type AxiosListResponse, type ResourceMethods } from '@/types/api'

import type { Models } from '../models'

import { clientResource } from '../resource'

const path = '/v1/chains'

const methods = [HTTP_METHOD.GET, HTTP_METHOD.POST, HTTP_METHOD.PUT, HTTP_METHOD.DELETE]

const resources = (): ResourceMethods<Models.Chain> => {
  return {
    ...clientResource(path, methods),
    list: (params?: Record<string, unknown>): Promise<AxiosListResponse<Models.Chain>> => {
      const offset = Number(params?.offset ?? 0)
      const limit = Number(params?.limit ?? 10)

      const response = {
        data: {
          data: chainJson.data as Models.Chain[],
          metadata: {
            total: chainJson.metadata.total,
            page: offset,
            per_page: limit,
          },
        },
      } as AxiosListResponse<Models.Chain>

      return Promise.resolve(response)
    },
  }
}

export const chainServices = resources()
