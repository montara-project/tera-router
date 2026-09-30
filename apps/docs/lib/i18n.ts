import { defineI18n } from 'fumadocs-core/i18n'
import { uiTranslations } from 'fumadocs-ui/i18n'

export const i18n = defineI18n({
  defaultLanguage: 'en-US',
  languages: ['en-US', 'id-ID'],
  // English is served from unprefixed URLs (/docs/...), Indonesian from /id-ID/docs/...
  hideLocale: 'default-locale',
  // content/docs/* is the default locale, content/docs/id-ID/* is the Indonesian tree
  parser: 'dir',
})

export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    'en-US': {
      displayName: 'English',
    },
    'id-ID': {
      displayName: 'Bahasa Indonesia',
      'Ask AI(AI chat button)': 'Tanya AI',
      'Back to Home(404 page)': 'Kembali ke Beranda',
      'Choose a language(language switcher)': 'Pilih bahasa',
      'Choose a language(language switcher)(aria-label)': 'Pilih bahasa',
      'Close Search(search dialog)(aria-label)': 'Tutup pencarian',
      'Close Sidebar(aria-label)': 'Tutup sidebar',
      'Close Sidebar(sidebar)(aria-label)': 'Tutup sidebar',
      'Collapse Sidebar(sidebar)(aria-label)': 'Ciutkan sidebar',
      'Copied Text(code block)(aria-label)': 'Tersalin',
      'Copy Anchor Link(heading anchor)(aria-label)': 'Salin tautan anchor',
      'Copy Link(accordion)(aria-label)': 'Salin tautan',
      'Copy Markdown(page actions)': 'Salin Markdown',
      'Copy Text(code block)(aria-label)': 'Salin teks',
      'Dark(theme switcher)(aria-label)': 'Gelap',
      'Edit on GitHub(edit page)': 'Edit di GitHub',
      'Hide Sidebar(sidebar)': 'Sembunyikan sidebar',
      'Last updated on(page footer)': 'Terakhir diperbarui',
      'Light(theme switcher)(aria-label)': 'Terang',
      'Next Page(pagination)': 'Berikutnya',
      'No Headings(table of contents)': 'Tidak ada heading',
      'No results found(search dialog)': 'Tidak ada hasil',
      'On this page(table of contents)': 'Di halaman ini',
      'Open Search(search trigger)(aria-label)': 'Buka pencarian',
      'Open Sidebar(sidebar)(aria-label)': 'Buka sidebar',
      'Open in ChatGPT(page actions)': 'Buka di ChatGPT',
      'Open in Claude(page actions)': 'Buka di Claude',
      'Open in Cursor(page actions)': 'Buka di Cursor',
      'Open in GitHub(page actions)': 'Buka di GitHub',
      'Open in Scira AI(page actions)': 'Buka di Scira AI',
      'Open(page actions)': 'Buka',
      'Page Not Found(404 page)': 'Halaman Tidak Ditemukan',
      'Previous Page(pagination)': 'Sebelumnya',
      'Read {url}, I want to ask questions about it.(page actions)':
        'Baca {url}, saya ingin bertanya tentang hal itu.',
      'Search(search dialog)': 'Cari',
      'Search(search trigger)': 'Cari',
      'Show Sidebar(sidebar)': 'Tampilkan sidebar',
      'System(theme switcher)(aria-label)': 'Sistem',
      'Table of Contents(inline table of contents)': 'Daftar Isi',
      'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 page)':
        'Halaman yang kamu cari mungkin telah dihapus, diganti namanya, atau sementara tidak tersedia.',
      'Toggle Menu(mobile menu)(aria-label)': 'Buka menu',
      'Toggle Theme(theme switcher)(aria-label)': 'Ganti tema',
      'View as Markdown(page actions)': 'Lihat sebagai Markdown',
    },
  })
