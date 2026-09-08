import ThemeProvider from './themes'

export default function DecorationProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
