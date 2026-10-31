import {
  IconActivityHeartbeat,
  IconBinaryTree2,
  IconBook,
  IconBrandGithub,
  IconChartHistogram,
  IconClockHour4,
  IconCoin,
  IconCloud,
  IconHeartbeat,
  IconKey,
  IconLayoutDashboard,
  IconMessageChatbot,
  IconMessageReport,
  IconPackages,
  IconPhoto,
  IconPigMoney,
  IconPolygon,
  IconReplace,
  IconSettings,
  IconShieldChevron,
  IconSparkles,
  IconStack2,
  IconTerminal2,
  IconWallet,
} from '@tabler/icons-react'

import type { NavMainItem, NavSecondaryItem, SidebarMenuData } from '@/types/menu'

// ── Share sidebar menus ───────────────────────────────────────────

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
    icon: IconBinaryTree2,
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
  {
    title: 'Model Alias',
    url: '/model-alias',
    icon: IconReplace,
    isActive: false,
    items: [],
  },
  {
    title: 'Pricing',
    url: '/pricing',
    icon: IconCoin,
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
    title: 'Budgets',
    url: '/budgets',
    icon: IconPigMoney,
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
    title: 'Playground',
    url: '/playground',
    icon: IconMessageChatbot,
    isActive: false,
    items: [],
  },
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

// const NAV_USERS: NavMainItem = {
//   title: 'Users',
//   url: '#',
//   icon: IconUsers,
//   items: [
//     {
//       title: 'All Users',
//       url: '/users/all',
//     },
//     {
//       title: 'Roles',
//       url: '/users/roles',
//     },
//   ],
// }

const REPO_URL = 'https://github.com/montara-project/tera-router'

const NAV_SECONDARY: NavSecondaryItem[] = [
  { title: 'Documentation', url: 'https://docs.terarouter.xyz/docs', icon: IconBook },
  { title: 'GitHub', url: REPO_URL, icon: IconBrandGithub },
  { title: 'Feedback', url: `${REPO_URL}/issues`, icon: IconMessageReport },
]

const SIDEBAR_MENU_ADMIN: SidebarMenuData = {
  user: {
    name: 'Admin',
    email: 'admin@example.com',
    avatar: '/avatars/admin.jpg',
  },
  navMenu: {
    overview: [NAV_DASHBOARD],
    traffic: NAV_TRAFFIC_LOGIC,
    connections: NAV_CONNECTIONS,
    safety: NAV_SAFETY,
    analytics: NAV_COST_ANALYTICS,
    developer: NAV_DEVELOPER,
  },
  navSetting: [],
  navSecondary: NAV_SECONDARY,
}

/** Sidebar group order and labels; also drives the ⌘K search sections. */
export const SIDEBAR_GROUPS = [
  { key: 'overview', title: 'Overview' },
  { key: 'traffic', title: 'Traffic' },
  { key: 'connections', title: 'Connections' },
  { key: 'safety', title: 'Safety' },
  { key: 'analytics', title: 'Cost & Analytics' },
  { key: 'developer', title: 'Developer' },
] as const satisfies readonly { key: keyof SidebarMenuData['navMenu']; title: string }[]

// ── Lookup ─────────────────────────────────────────────────────────────

export function getSidebarMenu(): SidebarMenuData {
  return SIDEBAR_MENU_ADMIN
}
