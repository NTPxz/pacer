// Race photos live in IndexedDB — localStorage (~5 MB) can't hold images.
// Each photo is resized client-side before it's stored, and keyed by its own id;
// a Race keeps the ordered list of ids (first one is the cover).

const DB_NAME = 'tayan-photos'
const STORE = 'photos'
const MAX_EDGE = 1600
const QUALITY = 0.82

export const MAX_PHOTOS = 8

interface PhotoRow {
  id: string
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    dbPromise.catch(() => (dbPromise = null))
  }
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        t.oncomplete = () => resolve(req ? req.result : undefined)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

const newPhotoId = () =>
  'p-' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

/** downscale to MAX_EDGE and re-encode as JPEG; throws if the browser can't decode the file (e.g. HEIC on Chrome) */
export async function compress(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', QUALITY),
  )
}

export async function addPhoto(file: Blob): Promise<string> {
  const blob = await compress(file)
  const id = newPhotoId()
  await tx('readwrite', (s) => s.put({ id, blob } satisfies PhotoRow))
  // ask the browser not to evict our data under storage pressure; harmless if refused
  navigator.storage?.persist?.().catch(() => {})
  return id
}

export async function deletePhotos(ids: string[]) {
  if (!ids.length) return
  ids.forEach(revoke)
  await tx('readwrite', (s) => ids.forEach((id) => s.delete(id)))
}

async function getBlob(id: string): Promise<Blob | undefined> {
  const row = (await tx<PhotoRow>('readonly', (s) => s.get(id) as IDBRequest<PhotoRow>)) as PhotoRow | undefined
  return row?.blob
}

// ---------- object URL cache shared by every <img> ----------
const urls = new Map<string, Promise<string | null>>()

export function photoUrl(id: string): Promise<string | null> {
  let p = urls.get(id)
  if (!p) {
    p = getBlob(id)
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null)
    urls.set(id, p)
  }
  return p
}

function revoke(id: string) {
  const p = urls.get(id)
  urls.delete(id)
  p?.then((u) => u && URL.revokeObjectURL(u))
}

// ---------- backup ----------
const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })

export async function exportPhotos(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const id of ids) {
    const b = await getBlob(id).catch(() => undefined)
    if (b) out[id] = await toDataUrl(b)
  }
  return out
}

export async function importPhotos(photos: Record<string, string>) {
  const rows: PhotoRow[] = []
  for (const [id, dataUrl] of Object.entries(photos)) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue
    rows.push({ id, blob: await (await fetch(dataUrl)).blob() })
  }
  rows.forEach((r) => revoke(r.id))
  await tx('readwrite', (s) => rows.forEach((r) => s.put(r)))
}
