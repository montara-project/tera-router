import type { ChangeEvent } from 'react'

import {
  IconAlertTriangle,
  IconArchive,
  IconDownload,
  IconLoader2,
  IconTransfer,
  IconUpload,
} from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { LegacyImportResult, LegacyImportSource } from '@/lib/api/models/backup'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import ConfigExportDialog from '@/components/block/settings/config-export-dialog'
import ConfigImportDialog from '@/components/block/settings/config-import-dialog'
import ImportResultDialog from '@/components/block/settings/import-result-dialog'
import SettingRow, { SettingsSection } from '@/components/block/settings/setting-row'
import { Button } from '@/components/ui/button'
import { useReauthDialog } from '@/hooks/use-reauth-dialog'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { readJsonObject, saveFile } from '@/lib/file'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

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
  const { confirm, dialog } = useReauthDialog()

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

  // The snapshot carries every sealed credential, so it re-authenticates.
  const handleDownloadDatabase = async () => {
    const file = await confirm('download the database snapshot', (creds) =>
      downloadDatabase.mutateAsync(creds)
    )
    if (!file) return
    saveFile(file.blob, file.filename)
    toast.success('Database snapshot downloaded')
  }

  // The upload brings its own users and credentials, so it re-authenticates.
  const handleRestoreDatabase = async () => {
    const file = pendingDb
    if (!file) return
    setPendingDb(null)
    const restored = await confirm('restore the database', (creds) =>
      restoreDatabase.mutateAsync({ file, ...creds })
    )
    if (!restored) return
    toast.success('Database restored', {
      description: `Safety copy: ${restored.safety_copy}`,
    })
  }

  const sqliteActive = dbInfo?.data.driver === 'sqlite'

  return (
    <div className="flex flex-col gap-4">
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

      <SettingsSection icon={IconArchive} title="Backups">
        <SettingRow
          title="Download configuration"
          description="JSON file. Local, or portable with a passphrase."
        >
          <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
            <IconDownload />
            Download backup
          </Button>
        </SettingRow>
        <SettingRow
          title="Restore configuration"
          description="Merges a JSON backup. Nothing is deleted."
        >
          <Button type="button" variant="outline" onClick={() => configInput.current?.click()}>
            <IconUpload />
            Restore backup
          </Button>
        </SettingRow>
        <SettingRow
          title="Database snapshot"
          badge={
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-sm border px-1.5 text-[11.5px] font-medium',
                sqliteActive
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-border bg-muted text-muted-foreground'
              )}
            >
              {sqliteActive ? 'SQLite active' : dbInfo ? 'SQLite unavailable' : 'Checking…'}
            </span>
          }
          info="A consistent copy made with SQLite VACUUM INTO. It holds every sealed credential, so downloading asks for your password."
          description={
            <span className="font-mono [overflow-wrap:anywhere]">
              {dbInfo?.data.path ?? '…'}
              {dbInfo
                ? ` · ${formatBytes(dbInfo.data.size_bytes, 1)} · schema v${dbInfo.data.schema_version}`
                : ''}
            </span>
          }
        >
          <Button
            type="button"
            variant="outline"
            disabled={!sqliteActive || downloadDatabase.isPending}
            onClick={() => void handleDownloadDatabase()}
          >
            {downloadDatabase.isPending ? (
              <IconLoader2 className="motion-safe:animate-spin" />
            ) : (
              <IconDownload />
            )}
            Download .db
          </Button>
        </SettingRow>
      </SettingsSection>

      <section className="overflow-hidden rounded-lg border border-red-500/40 bg-card">
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
            <IconAlertTriangle className="size-4" aria-hidden />
          </span>
          <h3 className="text-[13px] font-semibold text-red-600 dark:text-red-400">
            Restore database
          </h3>
        </header>
        <SettingRow
          title="Restore from SQLite backup"
          description="Upload a .db or .sqlite backup. Current data is replaced; restart required."
          info="The file is checked for integrity first, and a safety copy of the current database is written before it is replaced."
        >
          <Button
            type="button"
            variant="outline"
            className="border-red-500/35 text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
            disabled={!sqliteActive || restoreDatabase.isPending}
            onClick={() => dbInput.current?.click()}
          >
            {restoreDatabase.isPending ? (
              <IconLoader2 className="motion-safe:animate-spin" />
            ) : (
              <IconUpload />
            )}
            Restore .db / .sqlite
          </Button>
        </SettingRow>
      </section>

      <SettingsSection
        icon={IconTransfer}
        title="Import from other routers"
        description="JSON imports keep existing data"
      >
        <SettingRow
          title="9router backup"
          badge={<ImportBadge>Full credential transfer</ImportBadge>}
          info="API keys are re-generated: reveal the new key and update your clients. Combos become chains."
          description="Providers, keys, chains, proxy pools and aliases."
        >
          <Button
            type="button"
            variant="outline"
            disabled={importLegacy.isPending}
            onClick={() => pickLegacy('9router')}
          >
            {importLegacy.isPending && importLegacy.variables?.source === '9router' ? (
              <IconLoader2 className="motion-safe:animate-spin" />
            ) : (
              <IconUpload />
            )}
            Select 9router JSON
          </Button>
        </SettingRow>
        <SettingRow
          title="OmniRoute backup"
          badge={<ImportBadge>Credentials redacted</ImportBadge>}
          info="OmniRoute exports leave out credentials, so accounts arrive as disabled stubs. API keys must be re-created."
          description="Accounts arrive disabled. Re-authenticate after import."
        >
          <Button
            type="button"
            variant="outline"
            disabled={importLegacy.isPending}
            onClick={() => pickLegacy('omniroute')}
          >
            {importLegacy.isPending && importLegacy.variables?.source === 'omniroute' ? (
              <IconLoader2 className="motion-safe:animate-spin" />
            ) : (
              <IconUpload />
            )}
            Select OmniRoute JSON
          </Button>
        </SettingRow>
      </SettingsSection>

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
        variant="destructive"
        onConfirm={() => void handleRestoreDatabase()}
      />
      {dialog}
    </div>
  )
}

function ImportBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-sm border border-border bg-muted px-1.5 text-[11.5px] font-medium text-muted-foreground">
      {children}
    </span>
  )
}
