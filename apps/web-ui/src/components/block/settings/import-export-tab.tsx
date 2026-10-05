import type { ChangeEvent } from 'react'

import {
  IconDatabase,
  IconDownload,
  IconLoader2,
  IconShield,
  IconUpload,
} from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { LegacyImportResult, LegacyImportSource } from '@/lib/api/models/backup'

import IconBadge from '@/components/block/common/icon-badge'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import ConfigExportDialog from '@/components/block/settings/config-export-dialog'
import ConfigImportDialog from '@/components/block/settings/config-import-dialog'
import ImportResultDialog from '@/components/block/settings/import-result-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { formatBytes } from '@/hooks/use-file-upload'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { readJsonObject, saveFile } from '@/lib/file'

/** Take the picked file and reset the input so the same file can be picked again. */
function takeFile(e: ChangeEvent<HTMLInputElement>): File | undefined {
  const file = e.target.files?.[0]
  e.target.value = ''
  return file
}

export default function ImportExportTab() {
  const { data: dbInfo } = useQuery(queries.backup.databaseInfo())
  const importLegacy = useMutation(queries.backup.importLegacy())
  const downloadDatabase = useMutation(queries.backup.downloadDatabase())
  const restoreDatabase = useMutation(queries.backup.restoreDatabase())

  const legacyInput = useRef<HTMLInputElement>(null)
  const legacySource = useRef<LegacyImportSource>('9router')
  const configInput = useRef<HTMLInputElement>(null)
  const dbInput = useRef<HTMLInputElement>(null)

  const [legacyResult, setLegacyResult] = useState<LegacyImportResult | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [pendingConfig, setPendingConfig] = useState<{
    backup: Record<string, unknown>
    fileName: string
  } | null>(null)
  const [pendingDb, setPendingDb] = useState<File | null>(null)

  const pickLegacy = (source: LegacyImportSource) => {
    legacySource.current = source
    legacyInput.current?.click()
  }

  const handleLegacyFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = takeFile(e)
    if (!file) return
    try {
      const backup = await readJsonObject(file)
      importLegacy.mutate(
        { source: legacySource.current, backup },
        { onSuccess: (res) => setLegacyResult(res.data), onError: toastAxiosError }
      )
    } catch (err) {
      toastAxiosError(err)
    }
  }

  const handleConfigFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = takeFile(e)
    if (!file) return
    try {
      setPendingConfig({ backup: await readJsonObject(file), fileName: file.name })
    } catch (err) {
      toastAxiosError(err)
    }
  }

  const handleDbFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = takeFile(e)
    if (file) setPendingDb(file)
  }

  const handleDownloadDatabase = () => {
    downloadDatabase.mutate(undefined, {
      onSuccess: (file) => {
        saveFile(file.blob, file.filename)
        toast.success('Database snapshot downloaded')
      },
      onError: toastAxiosError,
    })
  }

  const handleRestoreDatabase = () => {
    if (!pendingDb) return
    restoreDatabase.mutate(pendingDb, {
      onSuccess: (res) => {
        toast.success('Database restored', {
          description: `Safety copy: ${res.data.safety_copy}`,
        })
      },
      onError: toastAxiosError,
    })
    setPendingDb(null)
  }

  const sqliteActive = dbInfo?.data.driver === 'sqlite'

  return (
    <div className="space-y-4">
      <input
        ref={legacyInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleLegacyFile}
      />
      <input
        ref={configInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleConfigFile}
      />
      <input
        ref={dbInput}
        type="file"
        accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/x-sqlite3"
        className="hidden"
        onChange={handleDbFile}
      />

      <Card className="bg-background">
        <CardHeader className="h-20">
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
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                disabled={importLegacy.isPending}
                onClick={() => pickLegacy('9router')}
              >
                {importLegacy.isPending && importLegacy.variables?.source === '9router' ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconUpload className="h-4 w-4" />
                )}
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
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                disabled={importLegacy.isPending}
                onClick={() => pickLegacy('omniroute')}
              >
                {importLegacy.isPending && importLegacy.variables?.source === 'omniroute' ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconUpload className="h-4 w-4" />
                )}
                Select OmniRoute backup JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="h-20">
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
                Export or import Tera Router configuration as JSON. Portable mode re-keys
                credentials with a passphrase.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap gap-3 border-t border-border p-5">
            <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
              <IconDownload className="h-4 w-4" />
              Download JSON backup
            </Button>
            <Button type="button" variant="outline" onClick={() => configInput.current?.click()}>
              <IconUpload className="h-4 w-4" />
              Import JSON backup
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="h-20">
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
                {sqliteActive ? (
                  <span className="rounded-md bg-emerald-900 px-2 py-1 text-xs font-semibold text-emerald-300">
                    SQLite active
                  </span>
                ) : (
                  <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-semibold">
                    {dbInfo ? 'SQLite unavailable' : 'Checking…'}
                  </span>
                )}
                <code className="text-muted-foreground font-mono text-xs">
                  driver={dbInfo?.data.driver ?? '…'}
                </code>
                {dbInfo && (
                  <code className="text-muted-foreground font-mono text-xs">
                    {formatBytes(dbInfo.data.size_bytes, 1)} · schema v{dbInfo.data.schema_version}
                  </code>
                )}
              </p>
              <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
                Backup uses SQLite VACUUM INTO for a consistent .db snapshot. Restore validates
                integrity and creates a safety copy before replacement.
              </p>
              <p className="text-muted-foreground font-mono text-xs break-all">
                {dbInfo?.data.path ?? '…'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={!sqliteActive || downloadDatabase.isPending}
                onClick={handleDownloadDatabase}
              >
                {downloadDatabase.isPending ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconDownload className="h-4 w-4" />
                )}
                Download .db
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!sqliteActive || restoreDatabase.isPending}
                onClick={() => dbInput.current?.click()}
              >
                {restoreDatabase.isPending ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconUpload className="h-4 w-4" />
                )}
                Restore .db
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ImportResultDialog result={legacyResult} onClose={() => setLegacyResult(null)} />
      <ConfigExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ConfigImportDialog
        backup={pendingConfig?.backup ?? null}
        fileName={pendingConfig?.fileName ?? ''}
        onClose={() => setPendingConfig(null)}
      />
      <SimpleAlertDialog
        open={pendingDb !== null}
        onOpenChange={(open) => !open && setPendingDb(null)}
        title={`Restore database from ${pendingDb?.name ?? ''}?`}
        description="This replaces the entire database — configuration, users, and usage history. You may need to sign in again. A safety copy of the current database is written first."
        confirmText="Restore"
        onConfirm={handleRestoreDatabase}
      />
    </div>
  )
}
