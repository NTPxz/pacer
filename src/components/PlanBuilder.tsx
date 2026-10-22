import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { buildPlan, KIND_LABEL, PHASE_LABEL, suggestedStartKm, type Kind, type Phase, type Week } from '../lib/plan'
import { RACE_LABEL, type RaceKey } from '../lib/vdot'
import { Segmented } from './Segmented'

export interface PlanSettings {
  goal: RaceKey
  weeks: number
  days: 3 | 4 | 5 | 6
  startKm: number | null
  startDate: string
}

const DAY = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

const KIND_TONE: Record<Kind, string> = {
  rest: 'rest',
  easy: 'E',
  strides: 'E',
  long: 'E',
  fartlek: 'I',
  interval: 'I',
  threshold: 'T',
  rep: 'R',
  marathon: 'M',
  race: 'race',
}

const PHASE_TONE: Record<Phase, string> = { base: 'E', build: 'T', peak: 'I', taper: 'M' }

const fmtDate = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
const plusDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(d.getDate() + n)
  return x
}

function parseDate(v: string): Date {
  const [y, m, d] = v.split('-').map(Number)
  return y ? new Date(y, m - 1, d) : new Date()
}

export function PlanBuilder({
  vdot,
  settings,
  onChange,
}: {
  vdot: number
  settings: PlanSettings
  onChange: (s: PlanSettings) => void
}) {
  const suggested = suggestedStartKm(vdot, settings.days, settings.goal)
  const startKm = settings.startKm ?? suggested
  const set = (patch: Partial<PlanSettings>) => onChange({ ...settings, ...patch })

  const plan = useMemo(
    () =>
      buildPlan({
        vdot,
        goal: settings.goal,
        weeks: settings.weeks,
        daysPerWeek: settings.days,
        startKm,
        startDate: parseDate(settings.startDate),
      }),
    [vdot, settings.goal, settings.weeks, settings.days, settings.startDate, startKm],
  )

  const [open, setOpen] = useState<Set<number>>(() => new Set([1]))
  const toggle = (n: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  const allOpen = open.size >= plan.length

  const total = plan.reduce((s, w) => s + w.km, 0)
  const peak = Math.max(...plan.map((w) => w.km))
  const longest = Math.max(...plan.flatMap((w) => w.days.filter((d) => d.kind === 'long').map((d) => d.km)))
  const raceDay = plusDays(plan[plan.length - 1].start, 6)

  const printPlan = () => {
    setOpen(new Set(plan.map((w) => w.n)))
    setTimeout(() => window.print(), 350)
  }

  return (
    <div className="planner">
      <aside className="controls">
        <Segmented
          id="goal"
          label="ซ้อมเพื่อแข่ง"
          value={settings.goal}
          onChange={(goal) => set({ goal, startKm: null })}
          options={[
            { value: '5K', label: '5K' },
            { value: '10K', label: '10K' },
            { value: 'HM', label: '21K' },
            { value: 'M', label: '42K' },
          ]}
        />
        <Segmented
          id="days"
          label="วิ่งกี่วัน / สัปดาห์"
          value={settings.days}
          onChange={(days) => set({ days, startKm: null })}
          options={[3, 4, 5, 6].map((d) => ({ value: d as 3 | 4 | 5 | 6, label: String(d) }))}
        />
        <div className="field">
          <span className="field-label">
            ระยะเวลา <output>{settings.weeks} สัปดาห์</output>
          </span>
          <input
            type="range"
            min={8}
            max={20}
            value={settings.weeks}
            onChange={(e) => set({ weeks: Number(e.target.value) })}
            style={{ '--fill': `${((settings.weeks - 8) / 12) * 100}%` } as React.CSSProperties}
          />
        </div>
        <div className="field">
          <span className="field-label">
            ระยะสัปดาห์แรก <output>{startKm} กม.</output>
          </span>
          <input
            type="range"
            min={10}
            max={120}
            value={startKm}
            onChange={(e) => set({ startKm: Number(e.target.value) })}
            style={{ '--fill': `${((startKm - 10) / 110) * 100}%` } as React.CSSProperties}
          />
          <span className="field-hint">
            {settings.startKm === null ? (
              'ค่าแนะนำจากระดับความฟิต — ปรับให้ใกล้ระยะที่วิ่งอยู่ตอนนี้'
            ) : (
              <button type="button" className="link" onClick={() => set({ startKm: null })}>
                กลับไปใช้ค่าแนะนำ ({suggested} กม.)
              </button>
            )}
          </span>
        </div>
        <label className="field">
          <span className="field-label">เริ่มสัปดาห์ของวันที่</span>
          <input type="date" value={settings.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </label>
      </aside>

      <div className="plan-out">
        <dl className="summary">
          <div>
            <dt>วันแข่ง {RACE_LABEL[settings.goal]}</dt>
            <dd>{raceDay.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</dd>
          </div>
          <div>
            <dt>ระยะรวม</dt>
            <dd>
              {total.toLocaleString()} <small>กม.</small>
            </dd>
          </div>
          <div>
            <dt>สัปดาห์พีค</dt>
            <dd>
              {peak} <small>กม.</small>
            </dd>
          </div>
          <div>
            <dt>ลองรันยาวสุด</dt>
            <dd>
              {longest} <small>กม.</small>
            </dd>
          </div>
        </dl>

        <VolumeChart plan={plan} peak={peak} onPick={(n) => {
          setOpen((prev) => new Set(prev).add(n))
          document.getElementById(`week-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }} />

        <div className="weeks-bar">
          <div className="legend">
            {(['E', 'M', 'T', 'I', 'R'] as const).map((z) => (
              <span key={z} data-tone={z}>
                {z}
              </span>
            ))}
          </div>
          <div className="weeks-actions">
            <button type="button" className="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(plan.map((w) => w.n)))}>
              {allOpen ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด'}
            </button>
            <button type="button" className="ghost" onClick={printPlan}>
              พิมพ์ / PDF
            </button>
          </div>
        </div>

        <ol className="weeks">
          {plan.map((w) => (
            <WeekCard key={w.n} week={w} open={open.has(w.n)} onToggle={() => toggle(w.n)} />
          ))}
        </ol>
      </div>
    </div>
  )
}

function VolumeChart({ plan, peak, onPick }: { plan: Week[]; peak: number; onPick: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, margin: '-60px' })
  return (
    <div className="volume" aria-label="ระยะวิ่งรายสัปดาห์" ref={ref}>
      <div className="volume-bars">
        {plan.map((w, i) => (
          <button key={w.n} type="button" className="volume-col" onClick={() => onPick(w.n)} title={`สัปดาห์ ${w.n}: ${w.km} กม.`}>
            <span className="volume-km">{w.km}</span>
            <motion.span
              className="volume-bar"
              data-tone={PHASE_TONE[w.phase]}
              data-cutback={w.cutback || undefined}
              initial={{ height: '0%' }}
              animate={{ height: seen ? `${(w.km / peak) * 100}%` : '0%' }}
              transition={{ type: 'spring', stiffness: 120, damping: 18, delay: i * 0.025 }}
            />
            <span className="volume-n">{w.n}</span>
          </button>
        ))}
      </div>
      <div className="volume-phases">
        {(['base', 'build', 'peak', 'taper'] as Phase[]).map((p) => {
          const n = plan.filter((w) => w.phase === p).length
          return n ? (
            <span key={p} style={{ flexGrow: n }} data-tone={PHASE_TONE[p]}>
              {PHASE_LABEL[p]}
            </span>
          ) : null
        })}
      </div>
    </div>
  )
}

function WeekCard({ week, open, onToggle }: { week: Week; open: boolean; onToggle: () => void }) {
  const end = plusDays(week.start, 6)
  return (
    <motion.li
      id={`week-${week.n}`}
      className={`week ${open ? 'is-open' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <button type="button" className="week-head" onClick={onToggle} aria-expanded={open}>
        <span className="week-n">{String(week.n).padStart(2, '0')}</span>
        <span className="week-meta">
          <span className="week-phase" data-tone={PHASE_TONE[week.phase]}>
            {PHASE_LABEL[week.phase]}
            {week.cutback && ' · พักฟื้น'}
          </span>
          <span className="week-dates">
            {fmtDate(week.start)} – {fmtDate(end)}
          </span>
        </span>
        <span className="week-km">
          {week.km}
          <small>กม.</small>
        </span>
        <motion.span className="week-chev" animate={{ rotate: open ? 180 : 0 }} aria-hidden>
          ↓
        </motion.span>
      </button>

      <div className="days">
        {week.days.map((d, i) => (
          <div key={i} className="day" data-tone={KIND_TONE[d.kind]}>
            <span className="day-name">{DAY[i]}</span>
            <span className="day-kind">{d.kind === 'race' ? KIND_LABEL.race : d.title}</span>
            <span className="day-km">{d.km ? `${d.km}` : '—'}</span>
          </div>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="week-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <ul>
              {week.days.map((d, i) =>
                d.kind === 'rest' ? null : (
                  <li key={i} data-tone={KIND_TONE[d.kind]}>
                    <span className="wd-day">
                      {DAY[i]} <small>{fmtDate(plusDays(week.start, i))}</small>
                    </span>
                    <span className="wd-body">
                      <strong>{d.title}</strong>
                      {d.detail}
                    </span>
                    <span className="wd-km">{d.km} กม.</span>
                  </li>
                ),
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
