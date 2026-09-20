import { IconDatabase, IconDownload, IconShield, IconUpload } from '@tabler/icons-react'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'

const SQLITE_PATH = '/data/keirouter.db'

export default function ImportExportTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconUpload}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Import from other routers</CardTitle>
              <CardDescription>
                Migrate providers, keys, and routing chains from a 9router or OmniRoute backup.
                Imports are additive — existing data is kept.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-4 border-t border-border p-5 lg:grid-cols-2">
            <div className="bg-muted/40 flex min-w-0 flex-col rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-900 text-xs font-bold text-emerald-300">
                  9R
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">9router backup</p>
                  <p className="text-muted-foreground text-xs">Full credential transfer</p>
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                Imports provider connections (API keys &amp; OAuth tokens re-sealed), custom
                provider nodes, API keys (re-hashed — same key string keeps working), combos (→
                chains), proxy pools, and model aliases.
              </p>
              <Button type="button" variant="outline" className="mt-4 w-full">
                <IconUpload className="h-4 w-4" />
                Select 9router backup JSON
              </Button>
            </div>

            <div className="bg-muted/40 flex min-w-0 flex-col rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-900 text-xs font-bold text-amber-300">
                  OR
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">OmniRoute backup</p>
                  <p className="text-muted-foreground text-xs">
                    Structural import (creds redacted)
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                OmniRoute JSON exports redact credentials, so accounts are imported as disabled
                stubs — re-authenticate after import. Custom provider nodes, combos (→ chains),
                proxy pools, and aliases transfer fully. API keys must be re-created.
              </p>
              <Button type="button" variant="outline" className="mt-4 w-full">
                <IconUpload className="h-4 w-4" />
                Select OmniRoute backup JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconDatabase}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Configuration backup</CardTitle>
              <CardDescription>
                Export or import KeiRouter configuration as JSON. Portable mode re-keys credentials
                with a passphrase.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap gap-3 border-t border-border p-5">
            <Button type="button" variant="outline">
              <IconDownload className="h-4 w-4" />
              Download JSON backup
            </Button>
            <Button type="button" variant="outline">
              <IconUpload className="h-4 w-4" />
              Import JSON backup
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconShield}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>SQLite database file</CardTitle>
              <CardDescription>
                Download or restore the raw SQLite database. Only available when database.driver is
                sqlite.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-t border-border p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-emerald-900 px-2 py-1 text-xs font-semibold text-emerald-300">
                  SQLite active
                </span>
                <code className="text-muted-foreground font-mono text-xs">driver=sqlite</code>
              </p>
              <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
                Backup uses SQLite VACUUM INTO for a consistent .db snapshot. Restore validates
                integrity and creates a safety copy before replacement.
              </p>
              <p className="text-muted-foreground font-mono text-xs">{SQLITE_PATH}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button type="button" variant="outline">
                <IconDownload className="h-4 w-4" />
                Download .db
              </Button>
              <Button type="button" variant="outline">
                <IconUpload className="h-4 w-4" />
                Restore .db
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
