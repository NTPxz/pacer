import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  bestAt,
  DIST_SHORT,
  DIST_TONE,
  exportRaces,
  loadRaces,
  mergeRaces,
  parseImport,
  pbIds,
  raceVdot,
  saveRaces,
  type DistKey,
  type Race,
} from '../lib/races'
import { statsFor } from '../lib/overlay'
import { deletePhotos, importPhotos } from '../lib/photos'
import { fmtPace, fmtTime, RACE_LABEL, type RaceKey } from '../lib/vdot'
import { Lightbox } from './Lightbox'
import { Photo } from './Photo'
import { RaceForm } from './RaceForm'

const MEDALS: RaceKey[] = ['5K', '10K', 'HM', 'M']
const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', opts)
}

export function TrophyCase({ onUseVdot }: { onUseVdot: (vdot: number, race: Race) => void }) {
  const [races, setRaces] = useState<Race[]>(loadRaces)
  const [editing, setEditing] = useState<Race | 'new' | null>(null)
  const [filter, setFilter] = useState<DistKey | 'all'>('all')
  const [toast, setToast] = useState<{ text: string; pb: boolean } | null>(null)
  const [viewing, setViewing] = useState<{ race: Race; index: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => saveRaces(races), [races])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const pbs = useMemo(() => pbIds(races), [races])
  const sorted = useMemo(() => [...races].sort((a, b) => b.date.localeCompare(a.date)), [races])
  const shown = filter === 'all' ? sorted : sorted.filter((r) => r.dist === filter)
  const totalKm = races.reduce((s, r) => s + r.km, 0)
  // 'other' is usually trail/ultra where elevation makes VDOT misleading, so trend stats use road distances only
  const road = races.filter((r) => r.dist !== 'other')
  const vdots = road.map(raceVdot)
  const thisYear = String(new Date().getFullYear())

  const save = (r: Race) => {
    const before = races.filter((x) => x.id !== r.id)
    const sameDist = before.filter((x) => (r.dist === 'other' ? x.dist === 'other' && x.km === r.km : x.dist === r.dist))
    const prevBest = sameDist.sort((a, b) => a.seconds - b.seconds)[0]
    setRaces([...before, r])
    setEditing(null)
    const label = r.dist === 'other' ? `${r.km} กม.` : DIST_SHORT[r.dist]
    if (prevBest && r.seconds < prevBest.seconds) {
      setToast({ text: `PB ใหม่ ${label}! เร็วขึ้น ${fmtTime(prevBest.seconds - r.seconds)}`, pb: true })
    } else if (!prevBest) {
      setToast({ text: `เพิ่มสถิติแรกของระยะ ${label} แล้ว`, pb: true })
    } else {
      setToast({ text: 'บันทึกแล้ว', pb: false })
    }
  }

  // would this result be the fastest at its distance, ignoring the entry itself?
  const isPb = (c: Pick<Race, 'id' | 'dist' | 'km' | 'seconds'>) =>
    c.seconds > 0 &&
    races.every(
      (x) =>
        x.id === c.id ||
        (c.dist === 'other' ? !(x.dist === 'other' && x.km === c.km) : x.dist !== c.dist) ||
        x.seconds >= c.seconds,
    )

  const remove = (r: Race) => {
    if (!window.confirm(`ลบ "${r.name}" ออกจากตู้?`)) return
    setRaces((prev) => prev.filter((x) => x.id !== r.id))
    deletePhotos(r.photos ?? []).catch(() => {})
  }

  const backup = async () => {
    const n = races.reduce((s, r) => s + (r.photos?.length ?? 0), 0)
    if (n) setToast({ text: `กำลังรวม ${n} รูปเข้าไฟล์สำรอง…`, pb: false })
    try {
      await exportRaces(races)
    } catch {
      setToast({ text: 'สร้างไฟล์สำรองไม่สำเร็จ', pb: false })
    }
  }

  const onImport = async (file: File) => {
    const incoming = parseImport(await file.text())
    if (!incoming) {
      setToast({ text: 'ไฟล์นี้อ่านไม่ได้ — ต้องเป็นไฟล์ที่ export จาก TAYAN', pb: false })
      return
    }
    try {
      await importPhotos(incoming.photos)
    } catch {
      setToast({ text: 'นำเข้ารูปไม่สำเร็จ — เบราว์เซอร์นี้อาจปิดการเก็บข้อมูลไว้', pb: false })
    }
    setRaces((prev) => mergeRaces(prev, incoming.races))
    setToast({ text: `นำเข้า ${incoming.races.length} รายการ`, pb: false })
  }

  return (
    <div className="trophies">
      <dl className="summary">
        <div>
          <dt>รายการที่แข่ง</dt>
          <dd>
            {races.length} <small>รายการ</small>
          </dd>
        </div>
        <div>
          <dt>ระยะแข่งรวม</dt>
          <dd>
            {totalKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} <small>กม.</small>
          </dd>
        </div>
        <div>
          <dt>VDOT สูงสุด</dt>
          <dd>{vdots.length ? Math.max(...vdots).toFixed(1) : '—'}</dd>
        </div>
        <div>
          <dt>ปี {Number(thisYear) + 543}</dt>
          <dd>
            {races.filter((r) => r.date.startsWith(thisYear)).length} <small>รายการ</small>
          </dd>
        </div>
      </dl>

      <div className="medals">
        {MEDALS.map((k, i) => {
          const best = bestAt(races, k)
          return (
            <motion.div
              key={k}
              className={`medal ${best ? '' : 'is-empty'}`}
              data-tone={DIST_TONE[k]}
              initial={{ rotate: -16, opacity: 0 }}
              whileInView={{ rotate: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 90, damping: 7, delay: i * 0.12 }}
              whileHover={{ rotate: [0, -6, 4, -2, 0], transition: { duration: 0.9 } }}
            >
              <svg viewBox="0 0 80 112" aria-hidden>
                <path d="M22 0 L36 44 L44 44 L30 0 Z" className="medal-ribbon" />
                <path d="M58 0 L44 44 L36 44 L50 0 Z" className="medal-ribbon alt" />
                <circle cx="40" cy="76" r="30" className="medal-disc" />
                <circle cx="40" cy="76" r="23" className="medal-ring" />
                <text x="40" y="82" textAnchor="middle" className="medal-text">
                  {DIST_SHORT[k]}
                </text>
              </svg>
              <div className="medal-info">
                <span className="medal-label">{RACE_LABEL[k]}</span>
                {best ? (
                  <>
                    <strong>{fmtTime(best.seconds)}</strong>
                    <small>
                      {best.name} · {fmtDate(best.date, { month: 'short', year: '2-digit' })}
                    </small>
                  </>
                ) : (
                  <small>ยังไม่มีสถิติ</small>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {road.length >= 2 && <VdotChart races={road} />}

      <div className="trophy-bar">
        <div className="chips" role="radiogroup" aria-label="กรองตามระยะ">
          {(['all', '5K', '10K', 'HM', 'M', 'other'] as const).map((k) => {
            const n = k === 'all' ? races.length : races.filter((r) => r.dist === k).length
            if (k !== 'all' && !n) return null
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={filter === k}
                className={filter === k ? 'is-active' : ''}
                onClick={() => setFilter(k)}
              >
                {k === 'all' ? 'ทั้งหมด' : DIST_SHORT[k]} <i>{n}</i>
              </button>
            )
          })}
        </div>
        <div className="weeks-actions">
          {races.length > 0 && (
            <button type="button" className="ghost" onClick={backup}>
              สำรองข้อมูล
            </button>
          )}
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
            นำเข้า
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
          <button type="button" className="primary" onClick={() => setEditing('new')}>
            + เพิ่มรายการ
          </button>
        </div>
      </div>

      {races.length === 0 ? (
        <motion.div className="empty" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <svg viewBox="0 0 120 60" aria-hidden>
            <path d="M4 52 H116" />
            <path d="M44 52 V40 H76 V52" />
            <path d="M48 40 C40 40 38 16 46 12 H74 C82 16 80 40 72 40" />
            <path d="M46 18 C34 18 34 30 46 30 M74 18 C86 18 86 30 74 30" />
          </svg>
          <p>ตู้ยังว่างอยู่ — เพิ่มสนามแรกที่เคยวิ่ง แล้วดูพัฒนาการของตัวเอง</p>
          <button type="button" className="primary" onClick={() => setEditing('new')}>
            + เพิ่มรายการแรก
          </button>
        </motion.div>
      ) : (
        <motion.div className="bibs" layout>
          <AnimatePresence mode="popLayout">
            {shown.map((r) => (
              <Bib
                key={r.id}
                race={r}
                pb={pbs.has(r.id)}
                onEdit={() => setEditing(r)}
                onRemove={() => remove(r)}
                onUse={() => onUseVdot(raceVdot(r), r)}
                onOpenPhotos={(index) => setViewing({ race: r, index })}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <p className="trophy-note">
        ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น — กด “สำรองข้อมูล” เป็นระยะ หรือใช้ไฟล์เดียวกันย้ายไปเครื่องอื่น
      </p>

      {/* overlays go to <body> so no transformed ancestor (layout animations) can trap position: fixed */}
      {createPortal(
        <AnimatePresence>
          {editing && (
            <RaceForm
              initial={editing === 'new' ? null : editing}
              isPb={isPb}
              onSave={save}
              onClose={() => setEditing(null)}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}

      {createPortal(
      <AnimatePresence>
        {viewing && (
          <Lightbox
            photos={viewing.race.photos ?? []}
            overlays={viewing.race.photoMeta}
            stats={statsFor(viewing.race, pbs.has(viewing.race.id))}
            start={viewing.index}
            title={viewing.race.name}
            sub={`${viewing.race.dist === 'other' ? `${viewing.race.km} กม.` : DIST_SHORT[viewing.race.dist]} · ${fmtTime(viewing.race.seconds)} · ${fmtDate(viewing.race.date)}`}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>,
        document.body,
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.pb ? 'is-pb' : ''}`}
            role="status"
            initial={{ y: 60, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 60, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {toast.pb && <span className="toast-star" aria-hidden>★</span>}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Bib({
  race,
  pb,
  onEdit,
  onRemove,
  onUse,
  onOpenPhotos,
}: {
  race: Race
  pb: boolean
  onEdit: () => void
  onRemove: () => void
  onUse: () => void
  onOpenPhotos: (index: number) => void
}) {
  const vdotOk = race.km >= 1.5
  const photos = race.photos ?? []
  // a stable, slightly different tilt per card so the polaroids don't look stamped out
  const tilt = ((race.id.charCodeAt(0) + race.id.length) % 5) - 2
  return (
    <motion.article
      layout
      className="bib"
      data-tone={DIST_TONE[race.dist]}
      initial={{ opacity: 0, rotateX: -70, y: -20 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <div className="bib-band">
        <span>{race.dist === 'other' ? `${race.km} กม.` : DIST_SHORT[race.dist]}</span>
        <span>{fmtDate(race.date)}</span>
      </div>
      {photos.length > 0 && (
        <button
          type="button"
          className="bib-photo"
          style={{ '--tilt': `${tilt * 0.8}deg` } as React.CSSProperties}
          onClick={() => onOpenPhotos(0)}
          aria-label={`ดูรูป ${photos.length} รูปจาก ${race.name}`}
        >
          <Photo
            id={photos[0]}
            alt={race.name}
            layoutId={`photo-${photos[0]}`}
            overlay={race.photoMeta?.[photos[0]]}
            stats={statsFor(race, pb)}
            natural
          />
          {photos.length > 1 && <span className="bib-photo-count">+{photos.length - 1}</span>}
        </button>
      )}
      <div className="bib-body">
        {(race.bib || !photos.length) && <span className="bib-no">{race.bib || '—'}</span>}
        <h3>{race.name}</h3>
        {race.location && <p className="bib-loc">{race.location}</p>}
        <div className="bib-time">
          {fmtTime(race.seconds)}
          {pb && <span className="pb-badge">PB</span>}
        </div>
        <div className="bib-meta">
          <span>
            <b>{fmtPace(race.seconds / race.km)}</b> /กม.
          </span>
          {vdotOk && (
            <span>
              VDOT <b>{raceVdot(race).toFixed(1)}</b>
            </span>
          )}
          {race.source === 'strava' && <span className="bib-src">Strava</span>}
        </div>
        {race.note && <p className="bib-note">{race.note}</p>}
      </div>
      <div className="bib-actions">
        {vdotOk && (
          <button type="button" onClick={onUse} title="ใช้ความฟิตจากรายการนี้คำนวณโซนเพซและตารางซ้อม">
            ใช้คำนวณเพซ
          </button>
        )}
        <button type="button" onClick={onEdit}>
          แก้ไข
        </button>
        <button type="button" onClick={onRemove} className="danger">
          ลบ
        </button>
      </div>
    </motion.article>
  )
}

function VdotChart({ races }: { races: Race[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pts = [...races]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ r, t: new Date(r.date).getTime(), v: raceVdot(r) }))

  const H = 200
  const pad = { l: 36, r: 16, t: 16, b: 28 }
  const t0 = pts[0].t
  const t1 = pts[pts.length - 1].t
  const span = Math.max(1, t1 - t0)
  const vMin = Math.floor(Math.min(...pts.map((p) => p.v)) - 1)
  const vMax = Math.ceil(Math.max(...pts.map((p) => p.v)) + 1)
  const x = (t: number) => pad.l + ((t - t0) / span) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - vMin) / (vMax - vMin)) * (H - pad.t - pad.b)
  const step = Math.max(1, Math.round((vMax - vMin) / 4))
  const ticks: number[] = []
  for (let v = vMin; v <= vMax; v += step) ticks.push(v)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - box.left
    let best = 0
    pts.forEach((p, i) => {
      if (Math.abs(x(p.t) - mx) < Math.abs(x(pts[best].t) - mx)) best = i
    })
    setHover(best)
  }
  const hp = hover !== null ? pts[hover] : null

  return (
    <figure className="vdot-chart" ref={wrap}>
      <figcaption>
        <strong>พัฒนาการ VDOT</strong> จากรายการถนน 5K–42K ตามเวลา — ยิ่งสูงยิ่งฟิต
      </figcaption>
      <svg
        width={w}
        height={H}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`VDOT จาก ${pts[0].v.toFixed(1)} เป็น ${pts[pts.length - 1].v.toFixed(1)}`}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 8} className="axis">
          {fmtDate(pts[0].r.date, { month: 'short', year: '2-digit' })}
        </text>
        <text x={w - pad.r} y={H - 8} textAnchor="end" className="axis">
          {fmtDate(pts[pts.length - 1].r.date, { month: 'short', year: '2-digit' })}
        </text>
        <motion.path
          d={line}
          className="vdot-line"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.6, 0, 0.2, 1] }}
        />
        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={pad.t} y2={H - pad.b} className="crosshair" />}
        {pts.map((p, i) => (
          <circle
            key={p.r.id}
            cx={x(p.t)}
            cy={y(p.v)}
            r={hover === i ? 7 : 5}
            className="vdot-dot"
            data-tone={DIST_TONE[p.r.dist]}
          />
        ))}
      </svg>
      {hp && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(x(hp.t), 90), w - 90), top: y(hp.v) }}
        >
          <strong>{hp.r.name}</strong>
          <span>
            {hp.r.dist === 'other' ? `${hp.r.km} กม.` : DIST_SHORT[hp.r.dist]} · {fmtTime(hp.r.seconds)}
          </span>
          <span>
            VDOT <b>{hp.v.toFixed(1)}</b> · {fmtDate(hp.r.date)}
          </span>
        </div>
      )}
    </figure>
  )
}
