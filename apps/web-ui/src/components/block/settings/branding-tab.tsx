import { IconCheck, IconPalette, IconUpload } from '@tabler/icons-react'
import { useTheme } from 'next-themes'
import { useRef, useState } from 'react'
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

/** Matches the server's cap on a branding image data URL. */
const MAX_IMAGE_BYTES = 256 * 1024
const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico'

/** Read an image file as a data URL the server accepts. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.onload = () => {
      let url = String(reader.result)
      // Some browsers report .ico files with no MIME type.
      if (!file.type && file.name.toLowerCase().endsWith('.ico')) {
        url = url.replace(/^data:[^;]*;/, 'data:image/x-icon;')
      }
      if (url.length > MAX_IMAGE_BYTES) {
        reject(new Error(`${file.name} is too large — keep images under ~190 KB`))
        return
      }
      resolve(url)
    }
    reader.readAsDataURL(file)
  })
}

function UploadZone({
  label,
  hint,
  id,
  value,
  onChange,
}: {
  label: string
  hint: string
  id: string
  /** Image data URL; '' means the default. */
  value: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (file: File | undefined) => {
    if (!file) return
    readImage(file)
      .then(onChange)
      .catch((error: Error) => toast.error(error.message))
  }

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-stretch gap-2">
        <div className="bg-muted/60 flex w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border">
          {value ? (
            <img src={value} alt={`${label} preview`} className="h-10 w-10 object-contain" />
          ) : (
            <IconPalette className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <button
          id={id}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files[0])
          }}
          className="hover:border-border/80 flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border px-4 py-3 transition-colors"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <IconUpload className="h-4 w-4" />
            {value ? 'Replace image' : 'Upload image'}
          </span>
          <span className="text-muted-foreground text-xs">
            PNG, SVG, ICO — drag &amp; drop or click
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGES}
          className="hidden"
          aria-label={`Upload ${label}`}
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{hint}</p>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}

export default function BrandingTab({ settings, onUpdate }: BrandingTabProps) {
  const [displayName, setDisplayName] = useState(settings.branding_display_name)
  const [tagline, setTagline] = useState(settings.branding_tagline)
  const [logo, setLogo] = useState(settings.branding_logo ?? '')
  const [favicon, setFavicon] = useState(settings.branding_favicon ?? '')
  const { palette, setPalette } = useThemePalette()
  const { theme: mode, setTheme: setMode } = useTheme()

  const handleSave = () => {
    onUpdate({
      branding_display_name: displayName,
      branding_tagline: tagline,
      branding_theme: palette,
      branding_logo: logo,
      branding_favicon: favicon,
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
            value={logo}
            onChange={setLogo}
          />
          <UploadZone
            id="branding-favicon"
            label="Favicon"
            hint="PNG or ICO recommended. Leave empty for default."
            value={favicon}
            onChange={setFavicon}
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
            <div className="bg-muted/60 flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-border">
              {logo ? (
                <img src={logo} alt="" className="h-7 w-7 object-contain" />
              ) : (
                <IconPalette className="text-muted-foreground h-4 w-4" />
              )}
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
