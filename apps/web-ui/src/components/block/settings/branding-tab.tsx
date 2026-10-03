import { IconCheck, IconPalette, IconUpload } from '@tabler/icons-react'
import { useTheme } from 'next-themes'
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
import { useThemePalette } from '@/lib/providers/themes'
import { THEME_PALETTES } from '@/lib/theme-palettes'

import { SegmentedControl } from './setting-row'

interface BrandingTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

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
          <span className="text-muted-foreground text-xs">
            PNG, SVG, ICO — drag &amp; drop or click
          </span>
        </button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
    </div>
  )
}

export default function BrandingTab({ settings, onUpdate }: BrandingTabProps) {
  const [displayName, setDisplayName] = useState(settings.branding_display_name)
  const [tagline, setTagline] = useState(settings.branding_tagline)
  const { palette, setPalette } = useThemePalette()
  const { theme: mode, setTheme: setMode } = useTheme()

  const handleSave = () => {
    onUpdate({
      branding_display_name: displayName,
      branding_tagline: tagline,
      branding_theme: palette,
    })
    toast.success('Branding saved')
  }

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
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
          <p className="text-xs font-medium text-muted-foreground">Appearance</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Choose how the dashboard looks — light, dark, or follow your system setting. Saved in
            this browser.
          </p>
          <div className="mt-3">
            <SegmentedControl
              value={mode ?? 'system'}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
              onChange={setMode}
            />
          </div>
        </div>

        <div className="border-t border-border p-5">
          <p className="text-xs font-medium text-muted-foreground">Color Theme</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Choose a color palette for the dashboard. Changes apply instantly across all UI elements
            and are saved in this browser.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {THEME_PALETTES.map((option) => {
              const selected = option.value === palette

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${option.label} theme`}
                  onClick={() => setPalette(option.value)}
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
              {displayName || 'Tera Router'}
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
