/** One headline figure on the savings card. */
export type SavingsStat = { value: string; label: string }

const WIDTH = 1200
const HEIGHT = 630

/**
 * Render a shareable 1200×630 PNG of the token-saving stats on a canvas, so
 * the card needs no server round trip.
 */
export function renderSavingsCard(
  appName: string,
  periodLabel: string,
  stats: SavingsStat[]
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas is not supported in this browser'))

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  background.addColorStop(0, '#022c22')
  background.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const font = (weight: number, size: number) =>
    `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`

  ctx.fillStyle = '#34d399'
  ctx.font = font(600, 28)
  ctx.fillText(appName, 80, 110)

  ctx.fillStyle = '#fafafa'
  ctx.font = font(700, 64)
  ctx.fillText('Token savings', 80, 200)

  ctx.fillStyle = '#a1a1aa'
  ctx.font = font(400, 28)
  ctx.fillText(periodLabel, 80, 248)

  // Up to four stats in a 2×2 grid.
  stats.slice(0, 4).forEach((stat, i) => {
    const x = 80 + (i % 2) * 520
    const y = 380 + Math.floor(i / 2) * 150
    ctx.fillStyle = '#fafafa'
    ctx.font = font(700, 56)
    ctx.fillText(stat.value, x, y)
    ctx.fillStyle = '#a1a1aa'
    ctx.font = font(400, 26)
    ctx.fillText(stat.label, x, y + 40)
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the card'))),
      'image/png'
    )
  })
}
