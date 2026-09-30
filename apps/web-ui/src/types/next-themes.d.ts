// pnpm isolates packages, and `@types/react` is not visible from inside
// next-themes' .pnpm context — so `React.PropsWithChildren` in its shipped
// d.ts fails silently (skipLibCheck) and `children` disappears from
// ThemeProviderProps. Re-declare it via augmentation.
import type * as React from 'react'

declare module 'next-themes' {
  interface ThemeProviderProps {
    children?: React.ReactNode
  }
}
