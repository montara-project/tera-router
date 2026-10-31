import { IconCheck } from '@tabler/icons-react'

export type Role = 'admin'

export type NavSubItem = {
  title: string
  url: string
  icon?: typeof IconCheck
}

export type NavMainItem = {
  title: string
  url: string
  icon: typeof IconCheck
  isActive?: boolean
  items: NavSubItem[]
}

export type ProjectItem = {
  name: string
  url: string
  icon: typeof IconCheck
}

export type UserInfo = {
  name: string
  email: string
  avatar: string
}

export type SidebarMenuData = {
  user: UserInfo
  navMenu: {
    overview: NavMainItem[]
    traffic: NavMainItem[]
    connections: NavMainItem[]
    safety: NavMainItem[]
    analytics: NavMainItem[]
    developer: NavMainItem[]
  }
  navSetting: NavMainItem[]
  navSecondary: NavSecondaryItem[]
}

/** External link pinned to the bottom of the sidebar (docs, repo, feedback). */
export type NavSecondaryItem = {
  title: string
  url: string
  icon: typeof IconCheck
}
