import type { AxiosResponse } from 'axios'

export type Metadata = {
  total?: number
  message?: string
  page?: number
  per_page?: number
  from?: number
  to?: number
  [key: string]: number | string | undefined
}

// For Multiple Response
export type ApiListResponse<TData, TMeta extends Metadata = Metadata> = {
  data: TData[]
  metadata: TMeta
}

// For Single Response
export type ApiItemResponse<TData, TMeta extends Metadata = Metadata> = {
  data: TData
  metadata: TMeta
  message?: string
}

// For Delete Response
export type ApiDeleteResponse<TMeta extends Metadata = Metadata> = {
  message?: TMeta['message']
}

export type AxiosListResponse<TData> = AxiosResponse<ApiListResponse<TData>>
export type AxiosItemResponse<TData> = AxiosResponse<ApiItemResponse<TData>>
export type AxiosDeleteResponse = AxiosResponse<ApiDeleteResponse>
