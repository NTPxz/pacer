// Stat overlays burned onto race photos with <canvas>, so the same pixels are shown
// in the app and saved/shared — what you see is exactly what you export.

import { getBlob } from './photos'
import { DIST_SHORT, type Race } from './races'
import { fmtPace, fmtTime } from './vdot'

export type OverlayStyle = 'poster' | 'sticker' | 'line'
export type Corner = 'tl' | 'tr' | 'bl' | 'br'

export interface Overlay {
  style: OverlayStyle
  /** sticker only */
  corner?: Corner
  /** poster / line: light text on dark shade, or the reverse */
  tone?: 'light' | 'dark'
}

export interface PhotoStats {
  name: string
  dist: string
  time: string
  pace: string
  date: string
  pb: boolean
}

export function statsFor(r: Pick<Race, 'name' | 'dist' | 'km' | 'seconds' | 'date'>, pb: boolean): PhotoStats {
  const [y, m, d] = r.date.split('-').map(Number)
  return {
    name: r.name || 'ชื่อรายการ',
    dist: r.dist === 'other' ? `${r.km} กม.` : DIST_SHORT[r.dist],
    time: r.seconds > 0 ? fmtTime(r.seconds) : '0:00:00',
    pace: r.seconds > 0 && r.km > 0 ? fmtPace(r.seconds / r.km) : '—',
    date: y ? new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    pb,
  }
}

const DISPLAY = `Archivo, 'IBM Plex Sans Thai', sans-serif`
const BODY = `'IBM Plex Sans Thai', sans-serif`
const MONO = `'IBM Plex Mono', 'IBM Plex Sans Thai', monospace`
const BRICK = '#c2462a'

let fontsReady: Promise<unknown> | null = null
const ensureFonts = () =>
  (fontsReady ??= Promise.all([
    document.fonts.load('800 condensed 100px Archivo'),
    document.fonts.load('600 100px Archivo'),
    document.fonts.load("600 100px 'IBM Plex Sans Thai'"),
    document.fonts.load("500 100px 'IBM Plex Mono'"),
  ]).catch(() => {}))

type Ctx = CanvasRenderingContext2D & { fontStretch?: string }

function font(ctx: Ctx, weight: number, px: number, family: string, condensed = false) {
  ctx.font = `${weight} ${px}px ${family}`
  // assigning ctx.font resets fontStretch, so set it afterwards (ignored where unsupported)
  if ('fontStretch' in ctx) ctx.fontStretch = condensed ? 'condensed' : 'normal'
}

function fit(ctx: Ctx, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

function pill(ctx: Ctx, x: number, baseline: number, size: number, label: string) {
  // keep the caller's fill/font/align intact
  ctx.save()
  ctx.shadowColor = 'transparent'
  font(ctx, 900, size, DISPLAY)
  const padX = size * 0.6
  const w = ctx.measureText(label).width + padX * 2
  const h = size * 1.55
  const top = baseline - size * 1.15
  const g = ctx.createLinearGradient(x, 0, x + w, 0)
  g.addColorStop(0, '#c7921f')
  g.addColorStop(0.5, '#ffe7a3')
  g.addColorStop(1, '#c7921f')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(x, top, w, h, size * 0.3)
  ctx.fill()
  ctx.fillStyle = '#3d2b06'
  ctx.textAlign = 'left'
  ctx.fillText(label, x + padX, baseline)
  ctx.restore()
  return w
}

function drawPoster(ctx: Ctx, w: number, h: number, s: PhotoStats, tone: 'light' | 'dark') {
  const u = Math.min(w, h) / 100
  const m = 6 * u
  const light = tone === 'light'
  const ink = light ? '#fff' : '#161513'
  const shade = ctx.createLinearGradient(0, h * 0.42, 0, h)
  shade.addColorStop(0, light ? 'rgba(10,9,8,0)' : 'rgba(250,247,240,0)')
  shade.addColorStop(1, light ? 'rgba(10,9,8,0.8)' : 'rgba(250,247,240,0.9)')
  ctx.fillStyle = shade
  ctx.fillRect(0, h * 0.42, w, h * 0.58)

  ctx.textBaseline = 'alphabetic'
  let y = h - m
  // brand mark
  font(ctx, 500, 2.4 * u, MONO)
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.7
  ctx.textAlign = 'right'
  ctx.fillText('TAYAN · ทะยาน', w - m, y)
  ctx.globalAlpha = 1

  // pace + PB
  ctx.textAlign = 'left'
  font(ctx, 600, 4.6 * u, DISPLAY, true)
  const paceText = `${s.pace} /กม.`
  ctx.fillText(paceText, m, y)
  if (s.pb) pill(ctx, m + ctx.measureText(paceText).width + 2.4 * u, y, 2.8 * u, 'PB')

  // finish time
  const timePx = Math.min(17 * u, (w - 2 * m) / (s.time.length * 0.42))
  y -= 6.6 * u
  font(ctx, 800, timePx, DISPLAY, true)
  ctx.fillText(s.time, m, y)

  // race name
  y -= timePx * 0.76 + 2.6 * u
  font(ctx, 600, 4.4 * u, BODY)
  ctx.fillText(fit(ctx, s.name, w - 2 * m), m, y)

  // distance · date with a brick accent
  y -= 6 * u
  ctx.fillStyle = BRICK
  ctx.fillRect(m, y - 2.3 * u, 5 * u, 0.9 * u)
  font(ctx, 500, 2.9 * u, MONO)
  ctx.fillStyle = ink
  ctx.fillText(fit(ctx, `${s.dist} · ${s.date}`, w - 2 * m - 7 * u), m + 7 * u, y)
}

function drawSticker(ctx: Ctx, w: number, h: number, s: PhotoStats, corner: Corner) {
  const u = Math.min(w, h) / 100
  const cw = 40 * u
  const band = 6.4 * u
  const pad = 3.2 * u
  const timePx = Math.min(10.5 * u, (cw - 2 * pad) / (s.time.length * 0.42))
  const ch = band + pad + timePx * 0.78 + 3 * u + 3.4 * u + 2.8 * u + 3 * u + pad
  const m = 5 * u
  const left = corner.endsWith('l')
  const top = corner.startsWith('t')
  const x = left ? m : w - m - cw
  const y = top ? m : h - m - ch
  const angle = ((left ? -1 : 1) * 3 * Math.PI) / 180

  ctx.save()
  ctx.translate(x + cw / 2, y + ch / 2)
  ctx.rotate(angle)
  ctx.translate(-cw / 2, -ch / 2)

  // card + shadow
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 3 * u
  ctx.shadowOffsetY = 1 * u
  ctx.fillStyle = '#fbf9f4'
  ctx.beginPath()
  ctx.roundRect(0, 0, cw, ch, 1.4 * u)
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // coloured band
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, cw, ch, 1.4 * u)
  ctx.clip()
  ctx.fillStyle = BRICK
  ctx.fillRect(0, 0, cw, band)
  ctx.restore()

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  font(ctx, 700, 3.2 * u, DISPLAY)
  ctx.fillText(s.dist, pad, band * 0.68)
  if (s.pb) {
    const pw = (() => {
      font(ctx, 900, 2.2 * u, DISPLAY)
      return ctx.measureText('PB').width + 2.2 * u * 1.2
    })()
    pill(ctx, cw - pad - pw, band * 0.66, 2.2 * u, 'PB')
  } else {
    font(ctx, 500, 2.3 * u, BODY)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.fillText(s.date, cw - pad, band * 0.66)
    ctx.textAlign = 'left'
  }

  // safety-pin holes
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  for (const hx of [2.2 * u, cw - 2.2 * u]) {
    ctx.beginPath()
    ctx.arc(hx, band + 2.2 * u, 0.75 * u, 0, Math.PI * 2)
    ctx.fill()
  }

  let cy = band + pad + timePx * 0.78
  ctx.fillStyle = '#161513'
  font(ctx, 800, timePx, DISPLAY, true)
  ctx.fillText(s.time, pad, cy)
  cy += 3 * u + 1.4 * u
  font(ctx, 600, 3.4 * u, DISPLAY, true)
  ctx.fillText(`${s.pace} /กม.`, pad, cy)
  cy += 2 * u + 2.8 * u
  font(ctx, 500, 2.6 * u, BODY)
  ctx.fillStyle = '#5c574f'
  ctx.fillText(fit(ctx, s.name, cw - 2 * pad), pad, cy)
  ctx.restore()
}

function drawLine(ctx: Ctx, w: number, h: number, s: PhotoStats, tone: 'light' | 'dark') {
  const u = Math.min(w, h) / 100
  const m = 5 * u
  const light = tone === 'light'
  const ink = light ? '#fff' : '#161513'
  const y = h - m
  ctx.shadowColor = light ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)'
  ctx.shadowBlur = 1.6 * u
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.8
  ctx.fillRect(m, y - 7.6 * u, w - 2 * m, Math.max(1, 0.25 * u))
  ctx.globalAlpha = 1
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  let x = m
  const seg = (text: string, weight: number, px: number, family: string, gap: number, condensed = false) => {
    font(ctx, weight, px, family, condensed)
    ctx.fillText(text, x, y)
    x += ctx.measureText(text).width + gap
  }
  seg(s.dist, 700, 4.4 * u, DISPLAY, 3 * u)
  seg(s.time, 800, 4.4 * u, DISPLAY, 3 * u, true)
  seg(`${s.pace}/กม.`, 500, 3 * u, MONO, 2.4 * u)
  if (s.pb) x += pill(ctx, x, y, 2.4 * u, 'PB') + 2.4 * u

  font(ctx, 500, 2.7 * u, BODY)
  ctx.textAlign = 'right'
  const right = fit(ctx, s.name, Math.max(0, w - m - x - 2 * u))
  if (right.length > 1) ctx.fillText(right, w - m, y)
  ctx.shadowColor = 'transparent'
}

export function drawOverlay(ctx: Ctx, w: number, h: number, o: Overlay, s: PhotoStats) {
  ctx.save()
  if (o.style === 'poster') drawPoster(ctx, w, h, s, o.tone ?? 'light')
  else if (o.style === 'sticker') drawSticker(ctx, w, h, s, o.corner ?? 'bl')
  else drawLine(ctx, w, h, s, o.tone ?? 'light')
  ctx.restore()
}

export async function composite(photoId: string, o: Overlay | undefined, s: PhotoStats, maxEdge = 1600): Promise<Blob> {
  const blob = await getBlob(photoId)
  if (!blob) throw new Error('photo missing')
  if (!o) return blob
  await ensureFonts()
  const bmp = await createImageBitmap(blob)
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d') as Ctx
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  drawOverlay(ctx, w, h, o, s)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.9),
  )
}

// ---------- small LRU of rendered composites as object URLs ----------
const cache = new Map<string, Promise<string | null>>()
const LIMIT = 40

export function compositeUrl(photoId: string, o: Overlay, s: PhotoStats, maxEdge = 1600): Promise<string | null> {
  const key = `${photoId}|${maxEdge}|${JSON.stringify(o)}|${JSON.stringify(s)}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const p = composite(photoId, o, s, maxEdge)
    .then((b) => URL.createObjectURL(b))
    .catch(() => null)
  cache.set(key, p)
  while (cache.size > LIMIT) {
    const [oldKey, old] = cache.entries().next().value as [string, Promise<string | null>]
    cache.delete(oldKey)
    old.then((u) => u && URL.revokeObjectURL(u))
  }
  return p
}

export async function saveOrShare(photoId: string, o: Overlay | undefined, s: PhotoStats, filename: string, share: boolean) {
  const blob = await composite(photoId, o, s)
  const file = new File([blob], filename, { type: 'image/jpeg' })
  if (share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: s.name })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File([new Blob()], 'x.jpg', { type: 'image/jpeg' })] })
  } catch {
    return false
  }
}
