export function SiteFooter() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-faint sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-md bg-accent font-mono text-xs font-bold text-[#052e16]">
            T
          </span>
          <span>© 2026 Tera Router</span>
        </div>
        <p className="font-mono text-xs">one endpoint · every provider · your box</p>
      </div>
    </footer>
  )
}
