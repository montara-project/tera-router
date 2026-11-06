/** Column meta for a right-aligned figure cell. */
export const FIGURE = {
  headerClassName: 'text-right whitespace-nowrap',
  cellClassName: 'text-right align-top whitespace-nowrap tabular-nums',
}

/** Two-line cell content: main figure over an optional muted detail. */
export function Figure({ value, detail }: { value: string; detail?: string }) {
  return (
    <>
      <div className="text-[13px]">{value}</div>
      {detail && <div className="text-muted-foreground text-[11.5px]">{detail}</div>}
    </>
  )
}
