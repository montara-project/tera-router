export type MediaCapability =
  | 'embed'
  | 'image'
  | 'tts'
  | 'stt'
  | 'search'
  | 'fetch'
  | 'image_to_text'

export type MediaCategory = 'embeddings' | 'image' | 'tts' | 'stt' | 'search' | 'fetch'

export type MediaProvider = {
  id: string
  name: string
  slug: string
  capabilities: MediaCapability[]
}
