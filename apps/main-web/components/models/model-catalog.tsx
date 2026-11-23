'use client'

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  LayoutGrid,
  List,
  Search,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Input, InputWrapper } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { modelBrandIcon } from './brand-marks'
import {
  ALL_CATEGORY,
  DEFAULT_SORT,
  PAGE_SIZE,
  SAMPLE_LABEL,
  SORT_OPTIONS,
  capabilities,
  contextLabel,
  filterModels,
  formatSample,
  groupChips,
  isFree,
  listedDelta,
  priceCell,
  sampleCost,
  sortModels,
  sortOfValue,
  sortValueOf,
  type PublicModel,
  type Sort,
  type SortKey,
  type SortValue,
} from './format'

type View = 'grid' | 'table'

const outlineButton =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50'

/** The public model list: search, group chips, sort, and a grid or table view, as in the portal catalog. */
export function ModelCatalog({ models }: { models: PublicModel[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORY)
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  const [view, setView] = useState<View>('grid')
  const [page, setPage] = useState(1)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const counts = useMemo(() => {
    const out: Record<string, number> = { [ALL_CATEGORY]: models.length }
    for (const m of models) out[m.group ?? ''] = (out[m.group ?? ''] ?? 0) + 1
    return out
  }, [models])

  const filtered = useMemo(
    () => sortModels(filterModels(models, search, category), sort),
    [models, search, category, sort]
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const changeSort = (next: Sort) => {
    setSort(next)
    setPage(1)
  }
  // A new page starts at the top of the list, with focus there for keyboard and screen readers.
  const goToPage = (next: number) => {
    setPage(next)
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    headingRef.current?.focus({ preventScroll: true })
  }

  return (
    <section
      aria-labelledby="models-heading"
      className="overflow-hidden rounded-2xl border border-line bg-surface elev-1"
    >
      <h2 id="models-heading" ref={headingRef} tabIndex={-1} className="sr-only">
        Models
      </h2>

      <div className="flex flex-wrap items-center gap-2 border-b border-divide px-4 py-2.5">
        <InputWrapper variant="sm" className="w-full sm:w-72">
          <Search aria-hidden />
          <Input
            type="search"
            aria-label="Search models"
            placeholder="Search model"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </InputWrapper>
        <Select
          value={sortValueOf(sort)}
          onValueChange={(value) => changeSort(sortOfValue(value as SortValue))}
        >
          <SelectTrigger size="sm" aria-label="Sort models" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ms-auto text-xs whitespace-nowrap text-faint">
          {filtered.length === models.length
            ? `${models.length} ${models.length === 1 ? 'model' : 'models'}`
            : `${filtered.length} of ${models.length} models`}
        </p>
        <div
          role="group"
          aria-label="Display mode"
          className="inline-flex rounded-md border border-line bg-canvas p-0.5"
        >
          {(
            [
              { value: 'grid', label: 'Grid', Icon: LayoutGrid },
              { value: 'table', label: 'Table', Icon: List },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors ${
                view === value ? 'bg-surface text-ink elev-1' : 'text-faint hover:text-ink'
              }`}
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="Model category"
        className="flex flex-wrap gap-1.5 border-b border-divide px-4 py-2.5"
      >
        {groupChips(models).map((chip) => {
          const active = category === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setCategory(chip.value)
                setPage(1)
              }}
              className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium ${
                active
                  ? 'border-accent-strong bg-accent-strong text-on-accent'
                  : 'border-line bg-raised/60 text-faint hover:text-ink'
              }`}
            >
              {chip.label}
              <span className="tabular-nums opacity-80">{counts[chip.value] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {models.length === 0 ? (
        <Empty title="No models are published yet" body="Check back soon." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pb-10">
          <Empty title="No models match" body="Try another name, or look in every category." />
          <button
            type="button"
            className={outlineButton}
            onClick={() => {
              setSearch('')
              setCategory(ALL_CATEGORY)
              setPage(1)
            }}
          >
            Clear filters
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] table-fixed text-[13px]">
            <thead className="border-b border-divide text-xs text-faint">
              <tr>
                <SortHeader
                  label="Model"
                  sortKey="name"
                  sort={sort}
                  onSort={changeSort}
                  className="w-80"
                />
                <SortHeader
                  label="Context"
                  sortKey="context"
                  sort={sort}
                  onSort={changeSort}
                  right
                  className="w-24"
                />
                <SortHeader
                  label="Input"
                  sortKey="input"
                  sort={sort}
                  onSort={changeSort}
                  right
                  className="w-28"
                />
                <SortHeader
                  label="Output"
                  sortKey="output"
                  sort={sort}
                  onSort={changeSort}
                  right
                  className="w-28"
                />
                <SortHeader
                  label="vs listed"
                  sortKey="discount"
                  sort={sort}
                  onSort={changeSort}
                  right
                  className="w-36"
                />
                <th scope="col" className="w-28 px-4 py-2 text-right font-medium">
                  Cache read
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((model) => (
                <ModelRow key={model.id} model={model} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-divide px-4 py-2.5">
          <p className="text-xs text-faint">
            Page {safePage} of {pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={outlineButton}
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft aria-hidden className="size-4" />
              Prev
            </button>
            <button
              type="button"
              className={outlineButton}
              disabled={safePage >= pages}
              onClick={() => goToPage(safePage + 1)}
              aria-label="Next page"
            >
              Next
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mt-1 text-sm text-faint">{body}</p>
    </div>
  )
}

/** The brand tile, or the group's first letter when the brand is unknown. */
function BrandTile({ model, size }: { model: PublicModel; size: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-accent/10 font-semibold text-accent-soft ${
        size === 'md'
          ? 'size-10 rounded-lg text-base'
          : 'size-8 rounded-md text-sm [&>svg]:size-5 [&>img]:size-5'
      }`}
    >
      {modelBrandIcon(model.id, model.group) ?? (model.group || 'Other')[0].toUpperCase()}
    </span>
  )
}

/** "23% below listed" (or above), with what it was measured on. */
function ListedDelta({ model, className = '' }: { model: PublicModel; className?: string }) {
  const delta = listedDelta(model)
  if (delta === null) return null
  const title = `On a sample request (${SAMPLE_LABEL}): ${formatSample(sampleCost(model.pricing) ?? 0)} here vs ${formatSample(sampleCost(model.base_price) ?? 0)} listed upstream.`
  if (delta === 0) {
    return (
      <span className={`text-xs text-faint ${className}`} title={title}>
        Same as listed
      </span>
    )
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums ${
        delta > 0
          ? 'bg-accent/12 text-accent-soft'
          : 'bg-orange-500/12 text-orange-700 dark:text-orange-400'
      } ${className}`}
    >
      {delta > 0 ? `${delta}% below listed` : `${Math.abs(delta)}% above listed`}
    </span>
  )
}

function FreeBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`shrink-0 bg-accent/12 font-semibold text-accent-soft ${
        small ? 'rounded-sm px-1.5 py-px text-[11px]' : 'rounded-md px-2 py-0.5 text-xs'
      }`}
    >
      Free
    </span>
  )
}

function ModelCard({ model }: { model: PublicModel }) {
  const free = isFree(model)
  const sample = sampleCost(model.pricing)
  const headingId = `model-card-${model.id}`
  const meta = [
    model.context_length ? `${contextLabel(model.context_length)} context` : null,
    ...capabilities(model),
  ].filter(Boolean)

  return (
    <article
      aria-labelledby={headingId}
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
        free
          ? 'border-accent/40 bg-accent/5 hover:border-accent/60'
          : 'border-line bg-canvas hover:border-ink/25'
      }`}
    >
      <div className="flex items-start gap-3">
        <BrandTile model={model} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-faint">{model.group || 'Other'}</p>
          <h3 id={headingId} className="truncate text-[15px] font-semibold" title={model.name}>
            {model.name}
          </h3>
        </div>
        {free ? <FreeBadge /> : <ListedDelta model={model} className="shrink-0" />}
      </div>

      <div className="flex items-center gap-1">
        <code
          className="min-w-0 truncate rounded-md bg-raised px-2 py-1 font-mono text-xs"
          title={model.id}
        >
          {model.id}
        </code>
        <CopyIdButton id={model.id} />
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-md bg-raised/70 px-3 py-2.5">
        <CardStat label="Input / 1M" value={priceCell(model.pricing.prompt)} />
        <CardStat label="Output / 1M" value={priceCell(model.pricing.completion)} />
      </dl>

      {meta.length > 0 && <p className="text-xs text-faint">{meta.join(' · ')}</p>}

      <div className="mt-auto pt-1">
        {free ? (
          <>
            <p className="text-xl font-semibold text-accent-soft">Free</p>
            <p className="text-xs text-faint">No charge per request</p>
          </>
        ) : sample !== null ? (
          <>
            <p className="text-xl font-semibold tracking-tight text-accent-soft tabular-nums">
              ≈ {formatSample(sample)}
            </p>
            <p className="text-xs text-faint">per request ({SAMPLE_LABEL})</p>
          </>
        ) : null}
      </div>
    </article>
  )
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className="truncate font-mono text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** Icon-only copy button for a model id; the confirmation is announced, not only drawn. */
function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <>
      <button
        type="button"
        aria-label={`Copy ${id}`}
        onClick={copy}
        className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
      >
        {copied ? (
          <Check aria-hidden className="size-3.5 text-accent-soft" />
        ) : (
          <Copy aria-hidden className="size-3.5" />
        )}
      </button>
      <span className="sr-only" role="status">
        {copied ? `${id} copied` : ''}
      </span>
    </>
  )
}

/** A table header that toggles asc/desc on click. */
function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  right = false,
  className,
}: {
  label: string
  sortKey: SortKey
  sort: Sort
  onSort: (sort: Sort) => void
  right?: boolean
  className?: string
}) {
  const active = sort.key === sortKey
  const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown
  const state = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
  return (
    <th
      scope="col"
      aria-sort={state ?? 'none'}
      className={`px-4 py-2 font-medium ${right ? 'text-right' : 'text-left'} ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={() => onSort({ key: sortKey, dir: active && sort.dir === 'asc' ? 'desc' : 'asc' })}
        className={`inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-ink ${
          active ? 'text-ink' : ''
        } ${right ? 'flex-row-reverse' : ''}`}
        aria-label={
          state
            ? `${label}, sorted ${state}. Sort ${state === 'ascending' ? 'descending' : 'ascending'}`
            : `Sort by ${label}`
        }
      >
        {label}
        {active ? (
          <Arrow aria-hidden className="size-3.5" />
        ) : (
          <ChevronsUpDown aria-hidden className="size-3.5 opacity-40" />
        )}
      </button>
    </th>
  )
}

function ModelRow({ model }: { model: PublicModel }) {
  const free = isFree(model)
  return (
    <tr className="border-b border-divide last:border-0">
      <td className="max-w-0 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <BrandTile model={model} size="sm" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <code className="truncate font-mono text-[12.5px]" title={model.id}>
                {model.id}
              </code>
              <CopyIdButton id={model.id} />
              {free && <FreeBadge small />}
            </span>
            <span className="flex flex-wrap items-center gap-1 text-[11px] text-faint">
              <span>{model.group || 'Other'}</span>
              {capabilities(model).map((label) => (
                <span key={label} className="rounded-sm border border-line px-1.5 py-px">
                  {label}
                </span>
              ))}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
        <Muted value={contextLabel(model.context_length)} />
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
        <Muted value={priceCell(model.pricing.prompt)} />
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
        <Muted value={priceCell(model.pricing.completion)} />
      </td>
      <td className="px-4 py-2.5 text-right">
        {free || listedDelta(model) === null ? (
          <span className="text-xs text-faint">—</span>
        ) : (
          <ListedDelta model={model} />
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
        <Muted value={priceCell(model.pricing.input_cache_read)} />
      </td>
    </tr>
  )
}

/** A cell value, dimmed when it is the unset em dash. */
function Muted({ value }: { value: string }) {
  return <span className={value === '—' ? 'text-faint' : ''}>{value}</span>
}
