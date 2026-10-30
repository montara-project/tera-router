import { Link, useParams } from '@tanstack/react-router'

import { i18n } from '@/lib/i18n'

export function NotFound() {
  const { lang } = useParams({ strict: false })
  const id = lang !== undefined && lang !== i18n.defaultLanguage

  return (
    <div className="text-fd-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-16 text-center">
      <h1 className="text-fd-foreground text-2xl font-semibold">404</h1>
      <p className="text-sm">{id ? 'Halaman tidak ditemukan' : 'Page not found'}</p>
      <Link className="text-fd-primary text-sm underline" to="/">
        {id ? 'Kembali ke beranda' : 'Back to home'}
      </Link>
    </div>
  )
}
