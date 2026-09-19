export type ProxyPoolStatus = 'active' | 'inactive'

export type ProxyPool = {
  id: string
  name: string
  url: string
  status: ProxyPoolStatus
  label?: string
  mode?: string
  testedAt: string
}
