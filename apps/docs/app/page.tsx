import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-4xl font-bold">Tera Router Docs</h1>
      <p className="mt-4 text-fd-muted-foreground">Documentation site powered by Fumadocs.</p>
      <Link
        href="/docs"
        className="mt-6 inline-block rounded-lg bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground"
      >
        Open docs
      </Link>
    </main>
  )
}
