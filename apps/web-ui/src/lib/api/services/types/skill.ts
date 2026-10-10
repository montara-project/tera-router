import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { CreateSkillDto } from '../../dtos/skill/schema'
import type { Skill } from '../../models/skill'

export type SkillResources = {
  list: () => Promise<AxiosListResponse<Skill>>
  store: (payload: CreateSkillDto) => Promise<AxiosItemResponse<Skill>>
  /** switches gateway injection of the skill's prompt on or off */
  setEnabled: (id: string, enabled: boolean) => Promise<AxiosItemResponse<Skill>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
}
