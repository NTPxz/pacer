import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { addPhoto, deletePhotos, MAX_PHOTOS } from '../lib/photos'
import { DIST_KM, newId, raceVdot, type DistKey, type Race } from '../lib/races'
import { fmtPace } from '../lib/vdot'
import { Photo } from './Photo'
import { Segmented } from './Segmented'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function RaceForm({
  initial,
  onSave,
  onClose,
}: {
  initial: Race | null
  onSave: (r: Race) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? today())
  const [dist, setDist] = useState<DistKey>(initial?.dist ?? '10K')
  const [km, setKm] = useState(initial?.dist === 'other' ? String(initial.km) : '')
  const s0 = initial?.seconds ?? 0
  const [h, setH] = useState(s0 ? String(Math.floor(s0 / 3600)) : '')
  const [m, setM] = useState(s0 ? String(Math.floor((s0 % 3600) / 60)) : '')
  const [s, setS] = useState(s0 ? String(s0 % 60) : '')
  const [bib, setBib] = useState(initial?.bib ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [tried, setTried] = useState(false)
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? [])
  const [busy, setBusy] = useState(0)
  const [photoError, setPhotoError] = useState('')
  const first = useRef<HTMLInputElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  // photos written to IndexedDB during this edit; discarded if the form is cancelled
  const added = useRef<string[]>([])
  const saved = useRef(false)

  useEffect(
    () => () => {
      if (!saved.current) deletePhotos(added.current).catch(() => {})
    },
    [],
  )

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return
    setPhotoError('')
    const room = MAX_PHOTOS - photos.length
    const list = [...files].slice(0, room)
    if (files.length > room) setPhotoError(`ใส่ได้สูงสุด ${MAX_PHOTOS} รูปต่อรายการ`)
    setBusy((b) => b + list.length)
    for (const f of list) {
      try {
        const id = await addPhoto(f)
        added.current.push(id)
        setPhotos((p) => [...p, id])
      } catch {
        setPhotoError('เปิดไฟล์รูปนี้ไม่ได้ — ลองใช้ JPG หรือ PNG')
      } finally {
        setBusy((b) => b - 1)
      }
    }
  }

  const removePhoto = (id: string) => {
    setPhotos((p) => p.filter((x) => x !== id))
    // photos that existed before this edit are only deleted once the edit is saved
    if (added.current.includes(id)) {
      added.current = added.current.filter((x) => x !== id)
      deletePhotos([id]).catch(() => {})
    }
  }

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const distKm = dist === 'other' ? Number(km.replace(',', '.')) : DIST_KM[dist]
  const seconds = Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(s || 0)
  const timeOk = seconds > 0 && Number(m || 0) < 60 && Number(s || 0) < 60
  const kmOk = Number.isFinite(distKm) && distKm > 0 && distKm <= 400
  const valid = name.trim() !== '' && !!date && kmOk && timeOk
  const pace = kmOk && timeOk ? seconds / distKm : null
  const vdot = kmOk && timeOk && distKm >= 1.5 ? raceVdot({ km: distKm, seconds }) : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!valid || busy) return
    saved.current = true
    const dropped = (initial?.photos ?? []).filter((id) => !photos.includes(id))
    deletePhotos(dropped).catch(() => {})
    onSave({
      id: initial?.id ?? newId(),
      name: name.trim(),
      date,
      dist,
      km: Math.round(distKm * 1000) / 1000,
      seconds,
      bib: bib.trim() || undefined,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
      photos: photos.length ? photos : undefined,
      source: initial?.source ?? 'manual',
      externalId: initial?.externalId,
    })
  }

  const digits = (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(e.target.value.replace(/\D/g, '').slice(0, max))

  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="race-form-title"
        onSubmit={submit}
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        noValidate
      >
        <header className="sheet-head">
          <h3 id="race-form-title">{initial ? 'แก้ไขรายการ' : 'เพิ่มรายการแข่ง'}</h3>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="ปิด">
            ×
          </button>
        </header>

        <label className="field">
          <span className="field-label">ชื่อรายการ</span>
          <input
            ref={first}
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น Bangkok Marathon 2026"
            aria-invalid={tried && !name.trim()}
          />
        </label>

        <div className="field">
          <span className="field-label">
            รูปความทรงจำ <output>{photos.length ? `${photos.length}/${MAX_PHOTOS}` : ''}</output>
          </span>
          <Reorder.Group axis="x" values={photos} onReorder={setPhotos} className="photo-picker">
            <AnimatePresence initial={false}>
              {photos.map((id, k) => (
                <Reorder.Item
                  key={id}
                  value={id}
                  className="photo-thumb"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  whileDrag={{ scale: 1.08, zIndex: 2 }}
                >
                  <Photo id={id} alt={`รูปที่ ${k + 1}`} />
                  {k === 0 && <span className="photo-cover">ปก</span>}
                  <button type="button" className="photo-remove" onClick={() => removePhoto(id)} aria-label={`ลบรูปที่ ${k + 1}`}>
                    ×
                  </button>
                </Reorder.Item>
              ))}
            </AnimatePresence>
            {Array.from({ length: busy }, (_, k) => (
              <li key={`busy-${k}`} className="photo-thumb is-busy" aria-label="กำลังย่อรูป" />
            ))}
            {photos.length + busy < MAX_PHOTOS && (
              <li className="photo-add-wrap">
                <button type="button" className="photo-add" onClick={() => pick.current?.click()}>
                  <span aria-hidden>+</span>
                  เพิ่มรูป
                </button>
              </li>
            )}
          </Reorder.Group>
          <input
            ref={pick}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              onPick(e.target.files)
              e.target.value = ''
            }}
          />
          <span className="field-hint">
            {photoError || (photos.length > 1 ? 'ลากเพื่อเรียงลำดับ — รูปแรกคือปกของการ์ด' : 'รูปถูกย่อขนาดและเก็บไว้ในเครื่องนี้เท่านั้น')}
          </span>
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">วันที่แข่ง</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">เลขบิบ</span>
            <input className="text-input" value={bib} onChange={(e) => setBib(e.target.value)} placeholder="ไม่บังคับ" />
          </label>
        </div>

        <Segmented
          id="race-dist"
          label="ระยะ"
          value={dist}
          onChange={setDist}
          options={[
            { value: '5K', label: '5K' },
            { value: '10K', label: '10K' },
            { value: 'HM', label: '21K' },
            { value: 'M', label: '42K' },
            { value: 'other', label: 'อื่น ๆ' },
          ]}
        />
        {dist === 'other' && (
          <label className="field">
            <span className="field-label">ระยะทาง (กม.)</span>
            <input
              className="text-input"
              inputMode="decimal"
              value={km}
              onChange={(e) => setKm(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="เช่น 15 หรือ 50.5"
              aria-invalid={tried && !kmOk}
            />
          </label>
        )}

        <div className="field">
          <span className="field-label">เวลาที่ทำได้ (ชิปไทม์)</span>
          <div className="time-fields" aria-invalid={tried && !timeOk}>
            <label>
              <input inputMode="numeric" value={h} onChange={digits(setH, 2)} placeholder="0" aria-label="ชั่วโมง" />
              <span>ชม.</span>
            </label>
            <label>
              <input inputMode="numeric" value={m} onChange={digits(setM, 2)} placeholder="00" aria-label="นาที" />
              <span>นาที</span>
            </label>
            <label>
              <input inputMode="numeric" value={s} onChange={digits(setS, 2)} placeholder="00" aria-label="วินาที" />
              <span>วินาที</span>
            </label>
          </div>
        </div>

        <div className="form-preview" aria-live="polite">
          <span>
            เพซเฉลี่ย <b>{pace ? `${fmtPace(pace)}/กม.` : '—'}</b>
          </span>
          <span>
            VDOT <b>{vdot ? vdot.toFixed(1) : '—'}</b>
          </span>
        </div>

        <label className="field">
          <span className="field-label">สถานที่</span>
          <input className="text-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ไม่บังคับ" />
        </label>
        <label className="field">
          <span className="field-label">บันทึก</span>
          <textarea
            className="text-input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="อากาศ ความรู้สึก สิ่งที่ได้เรียนรู้…"
          />
        </label>

        {tried && !valid && <p className="form-error">กรอกชื่อรายการ ระยะ และเวลาให้ครบก่อนนะ</p>}

        <footer className="sheet-foot">
          <button type="button" className="ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="primary" disabled={busy > 0}>
            {busy ? 'กำลังย่อรูป…' : initial ? 'บันทึกการแก้ไข' : 'เพิ่มเข้าตู้'}
          </button>
        </footer>
      </motion.form>
    </motion.div>
  )
}
