import { IconCheck, IconPalette, IconUpload } from '@tabler/icons-react'
import { useTheme } from 'next-themes'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { AppSettings } from '@/lib/api/models/settings'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useThemePalette } from '@/lib/providers/themes'
import { THEME_PALETTES } from '@/lib/theme-palettes'
import { cn } from '@/lib/utils'

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
  /** e.g. "SVG or PNG" */
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex h-6 items-center justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-medium">
          {label}
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-sm text-xs text-muted-foreground hover:text-foreground"
          >
            Reset to default
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Default</span>
        )}
      </div>
      <div className="flex items-stretch gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {value ? (
            <img src={value} alt={`${label} preview`} className="size-12 object-contain" />
          ) : (
            <IconPalette className="size-5 text-muted-foreground" aria-hidden />
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
          className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 rounded-md border border-input px-3 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-medium">
            <IconUpload className="size-4" aria-hidden />
            {value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          </span>
          <span className="text-xs text-muted-foreground">{hint} · drop or click</span>
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

  const dirty =
    displayName !== settings.branding_display_name ||
    tagline !== settings.branding_tagline ||
    logo !== (settings.branding_logo ?? '') ||
    favicon !== (settings.branding_favicon ?? '') ||
    palette !== settings.branding_theme
  const block = 'border-b border-border p-4'
  const label = 'text-[12.5px] font-medium'

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <IconPalette className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold">White-label branding</h3>
          <p className="text-xs text-muted-foreground">
            Applies to this dashboard and the Usage Dashboard
          </p>
        </div>
      </header>

      <div className={cn(block, 'grid gap-4 sm:grid-cols-2')}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="branding-name" className={label}>
            Display name
          </label>
          <Input
            id="branding-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Sidebar, browser tab and login screens.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="branding-tagline" className={label}>
              Portal tagline
            </label>
            <span className="text-xs text-muted-foreground">Optional</span>
          </div>
          <Input
            id="branding-tagline"
            placeholder="Enter your API Key to view usage."
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Shown on the Usage Dashboard login.</p>
        </div>
      </div>

      <div className={cn(block, 'grid gap-6 sm:grid-cols-2')}>
        <UploadZone
          id="branding-logo"
          label="Logo"
          hint="SVG or PNG"
          value={logo}
          onChange={setLogo}
        />
        <UploadZone
          id="branding-favicon"
          label="Favicon"
          hint="PNG or ICO"
          value={favicon}
          onChange={setFavicon}
        />
      </div>

      <div className={block}>
        <p className={label}>Color theme</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Previews instantly. Save to keep it.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {THEME_PALETTES.map((option) => {
            const selected = option.value === palette
            const shades = [
              option.rows[0][1],
              option.rows[0][2],
              option.rows[0][3],
              option.rows[0][4],
            ]
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setPalette(option.value)}
                className={cn(
                  'flex cursor-pointer flex-col gap-2 rounded-md border p-2 text-left transition-colors',
                  selected
                    ? 'border-blue-500/30 bg-blue-500/10'
                    : 'border-border bg-card hover:bg-muted/40'
                )}
              >
                <span className="flex h-7 overflow-hidden rounded-sm" aria-hidden>
                  {shades.map((color) => (
                    <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                  <span className="w-5" style={{ backgroundColor: option.rows[1][2] }} />
                </span>
                <span
                  className={cn(
                    'flex items-center justify-between gap-2 px-0.5 text-[12.5px] font-medium',
                    selected ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'
                  )}
                >
                  {option.label}
                  {selected ? <IconCheck className="size-3.5" aria-hidden /> : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className={cn(block, 'flex flex-wrap items-center justify-between gap-3')}>
        <div>
          <p className={label}>Appearance</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Light, dark or your system setting. Saved in this browser.
          </p>
        </div>
        <SegmentedControl
          aria-label="Appearance"
          value={mode ?? 'system'}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
          onChange={setMode}
        />
      </div>

      <div className={block}>
        <p className={label}>Preview</p>
        <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-sidebar p-3">
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {logo ? (
              <img src={logo} alt="" className="size-7 object-contain" />
            ) : (
              <IconPalette className="size-4 text-muted-foreground" aria-hidden />
            )}
          </span>
          <span className="text-[13px] font-semibold">{displayName || 'Tera Router'}</span>
          <span className="ml-auto text-xs font-medium text-primary">Link color</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <Button type="button" disabled={!dirty} onClick={handleSave}>
          Save branding
        </Button>
      </div>
    </section>
  )
}
