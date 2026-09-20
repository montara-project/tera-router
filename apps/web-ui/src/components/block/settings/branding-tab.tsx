import { IconCheck, IconPalette, IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { AppSettings } from '@/lib/api/models/settings'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface BrandingTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

type ThemePalette = { value: string; label: string; rows: [string[], string[]] }

const THEMES: ThemePalette[] = [
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

function UploadZone({ label, hint, id }: { label: string; hint: string; id: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-stretch gap-2">
        <div className="bg-muted/60 flex w-14 shrink-0 items-center justify-center rounded-lg border border-border">
          <IconPalette className="h-5 w-5 text-muted-foreground" />
        </div>
        <button
          id={id}
          type="button"
          className="hover:border-border/80 flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border px-4 py-3 transition-colors"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <IconUpload className="h-4 w-4" />
            Upload image
          </span>
          <span className="text-muted-foreground text-xs">PNG, SVG, ICO — drag &amp; drop or click</span>
        </button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
    </div>
  )
}

export default function BrandingTab({ settings, onUpdate }: BrandingTabProps) {
  const [displayName, setDisplayName] = useState(settings.brandingDisplayName)
  const [tagline, setTagline] = useState(settings.brandingTagline)
  const [theme, setTheme] = useState(settings.brandingTheme)

  const handleSave = () => {
    onUpdate({ brandingDisplayName: displayName, brandingTagline: tagline, brandingTheme: theme })
    toast.success('Branding saved')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconPalette}
            variant="soft"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>White-Label Branding</CardTitle>
            <CardDescription>
              Customize the dashboard name, logo, and favicon. Changes apply to both the admin
              dashboard and the public Usage Dashboard.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid gap-6 border-t border-border p-5 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="branding-name">
              Display Name
            </label>
            <Input
              id="branding-name"
              aria-label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Shown in sidebar, tab title, login screen, and Usage Dashboard.
            </p>
          </div>
          <div className="min-w-0 space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="branding-tagline">
              Portal Tagline
            </label>
            <Input
              id="branding-tagline"
              aria-label="Portal Tagline"
              placeholder="Enter your API Key to view usage."
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Optional message on the Usage Dashboard login screen.
            </p>
          </div>
        </div>

        <div className="grid gap-6 border-t border-border p-5 sm:grid-cols-2">
          <UploadZone
            id="branding-logo"
            label="Logo"
            hint="SVG or PNG recommended. Leave empty for default."
          />
          <UploadZone
            id="branding-favicon"
            label="Favicon"
            hint="PNG or ICO recommended. Leave empty for default."
          />
        </div>

        <div className="border-t border-border p-5">
          <p className="text-xs font-medium text-muted-foreground">Color Theme</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Choose a color palette for the entire dashboard. This changes the accent and highlight
            colors across all UI elements.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {THEMES.map((option) => {
              const selected = option.value === theme

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${option.label} theme`}
                  onClick={() => setTheme(option.value)}
                  className={`bg-card relative flex cursor-pointer flex-col items-center gap-2.5 rounded-lg border px-4 py-4 transition-colors ${
                    selected
                      ? 'border-foreground ring-ring/30 ring-2'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  {selected && (
                    <span className="bg-background absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border border-border">
                      <IconCheck className="h-3 w-3 text-foreground" />
                    </span>
                  )}
                  {option.rows.map((row, rowIndex) => (
                    <span key={rowIndex} className="flex gap-1">
                      {row.map((color, colorIndex) => (
                        <span
                          key={`${rowIndex}-${colorIndex}`}
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                  ))}
                  <span className="text-muted-foreground text-xs">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-border p-5">
          <p className="text-xs font-medium text-muted-foreground">Preview</p>
          <div className="bg-sidebar mt-3 flex items-center gap-3 rounded-lg border border-border p-4">
            <div className="bg-muted/60 flex h-8 w-8 items-center justify-center rounded-md border border-border">
              <IconPalette className="text-muted-foreground h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              {displayName || 'KeiRouter'}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-end border-t border-border">
        <Button
          type="button"
          className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
          onClick={handleSave}
        >
          Save Branding
        </Button>
      </CardFooter>
    </Card>
  )
}
