import { IconSearch } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { getSidebarMenu, SIDEBAR_GROUPS } from '@/data/sidebar-menu'
import { useBranding } from '@/hooks/use-branding'

/** Top-bar search: ⌘K / Ctrl+K opens a palette that jumps to any sidebar page. */
export default function CommandSearch() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const branding = useBranding()
  const menu = getSidebarMenu()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const go = (url: string) => {
    setOpen(false)
    void navigate({ to: url })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground flex h-8 w-full max-w-sm cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 text-sm transition-colors hover:bg-muted/60"
      >
        <IconSearch className="size-4" />
        <span className="flex-1 truncate text-left">Search {branding.name}…</span>
        <kbd className="pointer-events-none hidden rounded border border-border bg-background px-1.5 font-mono text-[10px] sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          {SIDEBAR_GROUPS.map(({ key, title }) => (
            <CommandGroup key={key} heading={title}>
              {menu.navMenu[key].flatMap((item) => [
                <CommandItem
                  key={item.url}
                  value={`${title} ${item.title}`}
                  onSelect={() => go(item.url)}
                >
                  <item.icon />
                  {item.title}
                </CommandItem>,
                ...item.items.map((sub) => (
                  <CommandItem
                    key={sub.url}
                    value={`${title} ${item.title} ${sub.title}`}
                    onSelect={() => go(sub.url)}
                  >
                    {sub.icon ? <sub.icon /> : <item.icon />}
                    {item.title} / {sub.title}
                  </CommandItem>
                )),
              ])}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
