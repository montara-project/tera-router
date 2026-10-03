export interface ThemePalette {
  value: string
  label: string
  rows: [string[], string[]]
}

export const DEFAULT_THEME_PALETTE = 'forest-amber'

export const STORAGE_KEY_THEME_PALETTE = 'tera-router-theme-palette'

export const THEME_PALETTES: ThemePalette[] = [
  {
    value: 'sage-terra',
    label: 'Sage & Terra',
    rows: [
      ['#d9d9c9', '#b9c4a3', '#8ba07a', '#647d55', '#4c5f3d', '#3a4429'],
      ['#e8b4a0', '#d1937f', '#a56a4e', '#7d4a35', '#5c3524', '#3d2418'],
    ],
  },
  {
    value: 'ocean-breeze',
    label: 'Ocean Breeze',
    rows: [
      ['#cfe3f5', '#9cc3e8', '#5f9bd6', '#3a6fb0', '#274d80', '#18304f'],
      ['#f5d9c8', '#e8a97e', '#d17f4e', '#a85a2d', '#7d3d1c', '#4f2610'],
    ],
  },
  {
    value: 'midnight-gold',
    label: 'Midnight Gold',
    rows: [
      ['#cfc9f0', '#a99ee8', '#7a6ad1', '#5447a8', '#382e75', '#221c47'],
      ['#f0e3b8', '#e8cf8a', '#d4ab52', '#a87f2e', '#75571c', '#473510'],
    ],
  },
  {
    value: 'forest-amber',
    label: 'Forest Amber',
    rows: [
      ['#c9e8d5', '#96d4b0', '#5cb887', '#2e9663', '#1c6b45', '#0f4028'],
      ['#f5dfb8', '#eac285', '#d99f4a', '#b87c26', '#7d5316', '#47300c'],
    ],
  },
  {
    value: 'rose-dusk',
    label: 'Rose Dusk',
    rows: [
      ['#f5cfe0', '#e89cc4', '#d15f9e', '#a82d75', '#751c52', '#471031'],
      ['#d9d0f5', '#b3a3e8', '#8a72d1', '#6247a8', '#422e75', '#291c47'],
    ],
  },
  {
    value: 'lavender-teal',
    label: 'Lavender Teal',
    rows: [
      ['#e0ccf0', '#c39fe8', '#a06ad1', '#7a44a8', '#542e75', '#331c47'],
      ['#b8e8e0', '#85d4c9', '#4ab8a8', '#269685', '#166b5e', '#0c4039'],
    ],
  },
  {
    value: 'monochrome',
    label: 'Monochrome',
    rows: [
      ['#e0e0e0', '#c4c4c4', '#a3a3a3', '#7d7d7d', '#5c5c5c', '#3d3d3d'],
      ['#d4d4d4', '#b0b0b0', '#8a8a8a', '#666666', '#474747', '#2e2e2e'],
    ],
  },
  {
    value: 'sunset-flame',
    label: 'Sunset Flame',
    rows: [
      ['#f5d9c0', '#eab385', '#de8a4a', '#c2611f', '#8f4312', '#5c2a0a'],
      ['#f0c0b8', '#e08a7d', '#cc5240', '#a82d1c', '#751c10', '#47100a'],
    ],
  },
  {
    value: 'arctic-frost',
    label: 'Arctic Frost',
    rows: [
      ['#d0f0f5', '#9cdce8', '#5fb8d1', '#2d8ba8', '#1c5f75', '#103d47'],
      ['#c8d0f5', '#9ca3e8', '#6a72d1', '#3d47a8', '#282e75', '#181c47'],
    ],
  },
  {
    value: 'cherry-navy',
    label: 'Cherry Navy',
    rows: [
      ['#f5d0d4', '#e89ca6', '#d15f72', '#a82d44', '#751c2e', '#47101c'],
      ['#d0dcf5', '#9cb0e8', '#5f7dd1', '#2d4ba8', '#1c2e75', '#101c47'],
    ],
  },
]

export const THEME_PALETTE_VALUES = THEME_PALETTES.map((palette) => palette.value)

export function resolveThemePalette(value: string | null | undefined): string {
  return value && THEME_PALETTE_VALUES.includes(value) ? value : DEFAULT_THEME_PALETTE
}
