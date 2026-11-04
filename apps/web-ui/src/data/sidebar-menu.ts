import {
  IconActivity,
  IconArrowsShuffle,
  IconBook,
  IconBrandGithub,
  IconChartBar,
  IconCoin,
  IconCpu,
  IconGauge,
  IconHistory,
  IconKey,
  IconLayoutGrid,
  IconMessageChatbot,
  IconMessageReport,
  IconPackages,
  IconPhoto,
  IconPigMoney,
  IconPlug,
  IconReceipt,
  IconSchool,
  IconScript,
  IconSettings,
  IconShield,
  IconStack2,
  IconTerminal2,
  IconTopologyRing,
} from '@tabler/icons-react'

import type { NavMainItem, NavSecondaryItem, SidebarMenuData } from '@/types/menu'

// ── Share sidebar menus ───────────────────────────────────────────

function nav(
  title: string,
  url: string,
  icon: NavMainItem['icon'],
  extra?: Partial<NavMainItem>
): NavMainItem {
  return { title, url, icon, isActive: false, items: [], ...extra }
}

const NAV_OVERVIEW: NavMainItem[] = [
  nav('Overview', '/dashboard', IconLayoutGrid, { isActive: true }),
  nav('Usage', '/usage', IconChartBar),
  nav('Console', '/console', IconScript, { live: true }),
]

const NAV_ROUTING: NavMainItem[] = [
  nav('Endpoints', '/endpoints', IconPlug),
  nav('Chains', '/chains', IconStack2),
  nav('Model Alias', '/model-alias', IconArrowsShuffle),
  nav('Skills', '/skills', IconSchool),
  nav('Pricing', '/pricing', IconCoin),
]

const NAV_PROVIDERS: NavMainItem[] = [
  nav('Providers', '/providers', IconPackages),
  nav('Media', '/media', IconPhoto),
  nav('Health', '/provider-health', IconActivity),
  nav('Quota', '/quota', IconGauge),
  nav('Proxy pools', '/proxy-pools', IconTopologyRing),
]

const NAV_ACCESS: NavMainItem[] = [
  nav('API keys', '/keys', IconKey),
  nav('Plans & budgets', '/plans', IconReceipt, { activeOn: ['/budgets'] }),
  nav('Budgets', '/budgets', IconPigMoney, { hidden: true }),
  nav('Guardrails', '/guardrails', IconShield),
  // ponytail: menu only; the /audit-log page and its list endpoint are not built yet.
  nav('Audit log', '/audit-log', IconHistory),
]

const NAV_WORKSPACE: NavMainItem[] = [
  nav('Playground', '/playground', IconMessageChatbot, { hidden: true }),
  nav('CLI tools', '/cli-tools', IconTerminal2),
  nav('System', '/system', IconCpu),
  nav('Settings', '/settings', IconSettings),
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
    overview: NAV_OVERVIEW,
    routing: NAV_ROUTING,
    providers: NAV_PROVIDERS,
    access: NAV_ACCESS,
    workspace: NAV_WORKSPACE,
  },
  navSetting: [],
  navSecondary: NAV_SECONDARY,
}

/** Sidebar group order and labels; also drives the ⌘K search sections. */
export const SIDEBAR_GROUPS = [
  { key: 'overview', title: 'Overview', hideLabel: true },
  { key: 'routing', title: 'Routing' },
  { key: 'providers', title: 'Providers' },
  { key: 'access', title: 'Access' },
  { key: 'workspace', title: 'Workspace' },
] as const satisfies readonly {
  key: keyof SidebarMenuData['navMenu']
  title: string
  hideLabel?: boolean
}[]

// ── Lookup ─────────────────────────────────────────────────────────────

export function getSidebarMenu(): SidebarMenuData {
  return SIDEBAR_MENU_ADMIN
}
