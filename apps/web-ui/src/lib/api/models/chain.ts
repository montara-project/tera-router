export type ChainStep = {
  provider: string
  model: string
  position: number
}

export type Chain = {
  id: string
  name: string
  strategy: string
  steps: ChainStep[]
}
