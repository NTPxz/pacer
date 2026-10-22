// Cloud sync for signed-in users.
//
// The app stays local-first: every component keeps reading/writing localStorage (and IndexedDB for
// photos). persist() is the single write path; when a user is connected it also pushes the changed
// document to Supabase (table user_docs, one row per user per document).
//
//  - First sign-in on a device that holds guest data → the two sides are MERGED (union, local wins).
//  - Later loads → whichever side was written last wins, so deletions made on another device stick.

import { clearPhotos, getBlob, setRemotePhotos } from './photos'
import { mergeRaces, type Race } from './races'
import { PHOTO_BUCKET, supabase } from './supabase'

export type DocKey = 'settings' | 'races' | 'log'
export type SyncStatus = 'guest' | 'syncing' | 'synced' | 'offline' | 'error'

const KEYS: DocKey[] = ['settings', 'races', 'log']
export const LOCAL_KEY: Record<DocKey, string> = {
  settings: 'pacer:v1',
  races: 'pacer:races:v1',
  log: 'pacer:log:v1',
}
const META_KEY = 'pacer:sync:v1'

interface Meta {
  /** user the local data was last linked to */
  user?: string
  /** last local write per document (ms) */
  ts: Partial<Record<DocKey, number>>
  /** photo ids already uploaded for `user` */
  photos: string[]
}

const readMeta = (): Meta => {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    return { user: m.user, ts: m.ts ?? {}, photos: Array.isArray(m.photos) ? m.photos : [] }
  } catch {
    return { ts: {}, photos: [] }
  }
}
const writeMeta = (m: Meta) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m))
  } catch {
    /* storage unavailable */
  }
}
const readLocal = (k: DocKey): unknown => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY[k])
    return raw == null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}
const writeLocal = (k: DocKey, v: unknown) => {
  try {
    localStorage.setItem(LOCAL_KEY[k], JSON.stringify(v))
  } catch {
    /* storage unavailable */
  }
}

// ---------- status ----------
let status: SyncStatus = 'guest'
const listeners = new Set<(s: SyncStatus) => void>()
const setStatus = (s: SyncStatus) => {
  status = s
  listeners.forEach((l) => l(s))
}
export const getStatus = () => status
export function onStatus(fn: (s: SyncStatus) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

// ---------- writes ----------
let user: string | null = null
const timers: Partial<Record<DocKey, ReturnType<typeof setTimeout>>> = {}

/** the one write path for synced documents; no-op when nothing changed (mount-time saves stay quiet) */
export function persist(k: DocKey, value: unknown) {
  const s = JSON.stringify(value)
  let prev: string | null
  try {
    prev = localStorage.getItem(LOCAL_KEY[k])
    if (prev === s) return
    localStorage.setItem(LOCAL_KEY[k], s)
  } catch {
    return
  }
  // the very first write is the app seeding defaults, not a user edit — it must never beat cloud data
  if (prev === null) return
  const m = readMeta()
  m.ts[k] = Date.now()
  writeMeta(m)
  if (user) {
    clearTimeout(timers[k])
    setStatus('syncing')
    timers[k] = setTimeout(() => {
      delete timers[k]
      void pushDoc(k).then(() => setStatus('synced'), fail)
    }, 1200)
  }
}

function fail(e: unknown) {
  console.warn('sync failed', e)
  setStatus(navigator.onLine ? 'error' : 'offline')
}

async function pushDoc(k: DocKey) {
  if (!supabase || !user) return
  const data = readLocal(k)
  if (data === undefined) return
  const ts = readMeta().ts[k] ?? Date.now()
  const { error } = await supabase
    .from('user_docs')
    .upsert({ user_id: user, key: k, data, updated_at: new Date(ts).toISOString() })
  if (error) throw error
  if (k === 'races') await pushPhotos()
}

async function pushPhotos() {
  if (!supabase || !user) return
  const races = (readLocal('races') as Race[] | undefined) ?? []
  const m = readMeta()
  const done = new Set(m.photos)
  for (const id of races.flatMap((r) => r.photos ?? [])) {
    if (done.has(id)) continue
    const blob = await getBlob(id).catch(() => undefined)
    if (!blob) continue
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(`${user}/${id}.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw error
    done.add(id)
    writeMeta({ ...readMeta(), photos: [...done] })
  }
}

// ---------- connect / disconnect ----------
function merge(k: DocKey, cloud: unknown, local: unknown): unknown {
  if (k === 'races') return mergeRaces((cloud as Race[]) ?? [], (local as Race[]) ?? [])
  if (k === 'log') return { ...(cloud as object), ...(local as object) }
  return local ?? cloud
}

/** link this device to `uid`; returns true when local data changed and the UI should re-read it */
export async function connect(uid: string): Promise<boolean> {
  if (!supabase) return false
  setStatus('syncing')
  const { data, error } = await supabase.from('user_docs').select('key, data, updated_at')
  if (error) {
    fail(error)
    return false
  }
  const cloud = new Map((data ?? []).map((r) => [r.key as DocKey, r]))
  const m = readMeta()
  const firstLink = m.user !== uid
  if (firstLink) m.photos = []
  let changed = false
  const toPush: DocKey[] = []

  for (const k of KEYS) {
    const local = readLocal(k)
    const c = cloud.get(k)
    if (!c) {
      if (local !== undefined) toPush.push(k)
      continue
    }
    const cloudTs = Date.parse(c.updated_at)
    if (local === undefined) {
      writeLocal(k, c.data)
      m.ts[k] = cloudTs
      changed = true
    } else if (firstLink && k !== 'settings') {
      writeLocal(k, merge(k, c.data, local))
      m.ts[k] = Date.now()
      toPush.push(k)
      changed = true
    } else if (cloudTs > (m.ts[k] ?? 0) || (firstLink && k === 'settings')) {
      // on first link the account's settings beat this device's guest settings
      writeLocal(k, c.data)
      m.ts[k] = cloudTs
      changed = true
    } else if ((m.ts[k] ?? 0) > cloudTs) {
      toPush.push(k)
    }
  }

  m.user = uid
  writeMeta(m)
  user = uid
  setRemotePhotos({
    download: async (id) => {
      const { data } = await supabase!.storage.from(PHOTO_BUCKET).download(`${uid}/${id}.jpg`)
      return data ?? undefined
    },
    remove: async (ids) => {
      await supabase!.storage.from(PHOTO_BUCKET).remove(ids.map((id) => `${uid}/${id}.jpg`))
    },
  })

  try {
    for (const k of toPush) await pushDoc(k)
    await pushPhotos()
    setStatus('synced')
  } catch (e) {
    fail(e)
  }
  return changed
}

/** sign-out: forget the link and wipe this user's personal data from the device */
export async function disconnect() {
  user = null
  setRemotePhotos(null)
  ;(Object.keys(timers) as DocKey[]).forEach((k) => {
    clearTimeout(timers[k])
    delete timers[k]
  })
  for (const k of ['races', 'log'] as DocKey[]) localStorage.removeItem(LOCAL_KEY[k])
  localStorage.removeItem(META_KEY)
  await clearPhotos().catch(() => {})
  setStatus('guest')
}

/** push anything pending right now (used before sign-out so nothing is lost) */
export async function flush() {
  const pending = Object.keys(timers) as DocKey[]
  for (const k of pending) {
    clearTimeout(timers[k])
    delete timers[k]
    await pushDoc(k)
  }
}
