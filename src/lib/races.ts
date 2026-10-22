import type { Overlay } from './overlay'
import { exportPhotos } from './photos'
import { RACE_METERS, vdotFrom, type RaceKey } from './vdot'

export type DistKey = RaceKey | 'other'

export interface Race {
  id: string
  name: string
  /** YYYY-MM-DD */
  date: string
  dist: DistKey
  km: number
  seconds: number
  bib?: string
  location?: string
  note?: string
  /** photo ids in IndexedDB (see photos.ts); the first is the cover */
  photos?: string[]
  /** per-photo stat overlay; a photo without an entry is shown as-is */
  photoMeta?: Record<string, Overlay>
  /** where the entry came from — 'strava' entries keep their activity id to avoid duplicates on re-import */
  source: 'manual' | 'strava'
  externalId?: string
}

const STORE = 'pacer:races:v1'

export const DIST_KM: Record<RaceKey, number> = {
  '5K': RACE_METERS['5K'] / 1000,
  '10K': RACE_METERS['10K'] / 1000,
  HM: RACE_METERS.HM / 1000,
  M: RACE_METERS.M / 1000,
}

export const DIST_SHORT: Record<DistKey, string> = { '5K': '5K', '10K': '10K', HM: '21K', M: '42K', other: 'อื่น ๆ' }

/** colour token per distance; 'other' falls back to the wine tone */
export const DIST_TONE: Record<DistKey, string> = { '5K': 'E', '10K': 'M', HM: 'T', M: 'I', other: 'R' }

export function loadRaces(): Race[] {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRace) : []
  } catch {
    return []
  }
}

export function saveRaces(races: Race[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(races))
  } catch {
    /* storage unavailable */
  }
}

function isRace(r: unknown): r is Race {
  const x = r as Race
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.date === 'string' &&
    typeof x.km === 'number' && x.km > 0 && typeof x.seconds === 'number' && x.seconds > 0
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** accepts "42:30", "1:32:05" or plain minutes "45" */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(/[:.]/).map((p) => p.trim())
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null
  const n = parts.map(Number)
  let s: number
  if (n.length === 1) s = n[0] * 60
  else if (n.length === 2) s = n[0] * 60 + n[1]
  else if (n.length === 3) s = n[0] * 3600 + n[1] * 60 + n[2]
  else return null
  if (n.length > 1 && n[n.length - 1] >= 60) return null
  return s > 0 ? s : null
}

export const raceVdot = (r: Pick<Race, 'km' | 'seconds'>) => vdotFrom(r.km * 1000, r.seconds)

const pbKey = (r: Race) => (r.dist === 'other' ? `other:${r.km.toFixed(2)}` : r.dist)

/** ids of races that are (or were, at the time) the fastest at their distance */
export function pbIds(races: Race[]): Set<string> {
  const best = new Map<string, Race>()
  for (const r of races) {
    const k = pbKey(r)
    const cur = best.get(k)
    if (!cur || r.seconds < cur.seconds) best.set(k, r)
  }
  return new Set([...best.values()].map((r) => r.id))
}

export function bestAt(races: Race[], dist: RaceKey): Race | undefined {
  return races.filter((r) => r.dist === dist).sort((a, b) => a.seconds - b.seconds)[0]
}

export async function exportRaces(races: Race[]) {
  const photos = await exportPhotos(races.flatMap((r) => r.photos ?? []))
  const blob = new Blob([JSON.stringify({ app: 'tayan', version: 2, races, photos })], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tayan-trophies-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseImport(text: string): { races: Race[]; photos: Record<string, string> } | null {
  try {
    const data = JSON.parse(text)
    const list = Array.isArray(data) ? data : data?.races
    if (!Array.isArray(list)) return null
    return {
      races: list.filter(isRace).map((r) => ({ ...r, source: r.source ?? 'manual' })),
      photos: data && typeof data.photos === 'object' && !Array.isArray(data.photos) ? data.photos : {},
    }
  } catch {
    return null
  }
}

/** merge by id (and strava activity id), incoming wins */
export function mergeRaces(current: Race[], incoming: Race[]): Race[] {
  const byId = new Map(current.map((r) => [r.id, r]))
  const ext = new Map(current.filter((r) => r.externalId).map((r) => [r.externalId!, r.id]))
  for (const r of incoming) {
    const existing = r.externalId ? ext.get(r.externalId) : undefined
    byId.set(existing ?? r.id, { ...r, id: existing ?? r.id })
  }
  return [...byId.values()]
}
