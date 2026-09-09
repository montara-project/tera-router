import {
  IconActivityHeartbeat,
  IconBinaryTree,
  IconChartHistogram,
  IconClockHour4,
  IconCloud,
  IconHeartbeat,
  IconKey,
  IconLayoutDashboard,
  IconPackages,
  IconPhoto,
  IconPolygon,
  IconSettings,
  IconShieldChevron,
  IconSparkles,
  IconStack2,
  IconTerminal2,
  IconUsers,
  IconWallet
} from '@tabler/icons-react'

import type { NavMainItem, SidebarMenuData, TeamItem } from '@/types/menu'

// ── Share sidebar menus ───────────────────────────────────────────

const TEAMS: TeamItem[] = [
  {
    name: 'House of Wizard',
    logo: IconStack2,
    plan: 'Web3 Data Analyst',
  },
]

const NAV_DASHBOARD: NavMainItem = {
  title: 'Dashboard',
  url: '/dashboard',
  icon: IconLayoutDashboard,
  isActive: true,
  items: [],
}

const NAV_TRAFFIC_LOGIC: NavMainItem[] = [
  {
    title: 'Endpoints',
    url: '/endpoints',
    icon: IconBinaryTree,
    isActive: false,
    items: [],
  },
  {
    title: 'Chains',
    url: '/chains',
    icon: IconStack2,
    isActive: false,
    items: [],
  },
  {
    title: 'Skills',
    url: '/skills',
    icon: IconSparkles,
    isActive: false,
    items: [],
  },
]

const NAV_CONNECTIONS: NavMainItem[] = [
  {
    title: 'API Keys',
    url: '/keys',
    icon: IconKey,
    isActive: false,
    items: [],
  },
  {
    title: 'Providers',
    url: '/providers',
    icon: IconPackages,
    isActive: false,
    items: [],
  },
  {
    title: 'Media',
    url: '/media',
    icon: IconPhoto,
    isActive: false,
    items: [],
  },
  {
    title: 'Proxy Pools',
    url: '/proxy-pools',
    icon: IconPolygon,
    isActive: false,
    items: [],
  },
]

const NAV_SAFETY: NavMainItem[] = [
  {
    title: 'Guardrails',
    url: '/guardrails',
    icon: IconShieldChevron,
    isActive: false,
    items: [],
  },
  {
    title: 'Provider Health',
    url: '/provider-health',
    icon: IconHeartbeat,
    isActive: false,
    items: [],
  },
]

const NAV_COST_ANALYTICS: NavMainItem[] = [
  {
    title: 'Usage',
    url: '/usage',
    icon: IconChartHistogram,
    isActive: false,
    items: [],
  },
  {
    title: 'Plans',
    url: '/plans',
    icon: IconWallet,
    isActive: false,
    items: [],
  },
  {
    title: 'Quota Tracker',
    url: '/quota',
    icon: IconClockHour4,
    isActive: false,
    items: [],
  },
  {
    title: 'System',
    url: '/system',
    icon: IconActivityHeartbeat,
    isActive: false,
    items: [],
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: IconSettings,
    isActive: false,
    items: [],
  },
]

const NAV_DEVELOPER: NavMainItem[] = [
  {
    title: 'Console Log',
    url: '/console',
    icon: IconTerminal2,
    isActive: false,
    items: [],
  },
  {
    title: 'CLI Tools',
    url: '/cli-tools',
    icon: IconCloud,
    isActive: false,
    items: [],
  },
]

const NAV_USERS: NavMainItem = {
  title: 'Users',
  url: '#',
  icon: IconUsers,
  items: [
    {
      title: 'All Users',
      url: '/users/all',
    },
    {
      title: 'Roles',
      url: '/users/roles',
    },
  ],
}

const SIDEBAR_MENU_ADMIN: SidebarMenuData = {
  user: {
    name: 'Admin',
    email: 'admin@example.com',
    avatar: '/avatars/admin.jpg',
  },
  teams: TEAMS,
  navMenu: {
    overview: [NAV_DASHBOARD],
    traffic: NAV_TRAFFIC_LOGIC,
    connections: NAV_CONNECTIONS,
    safety: NAV_SAFETY,
    analytics: NAV_COST_ANALYTICS,
    developer: NAV_DEVELOPER,
  },
  navSetting: [NAV_USERS],
}

// ── Lookup ─────────────────────────────────────────────────────────────

export function getSidebarMenu(): SidebarMenuData {
  return SIDEBAR_MENU_ADMIN
}
