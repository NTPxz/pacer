import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { adaptPlan, weeklyDone } from '../lib/adapt'
import {
  KIND_LABEL,
  mondayOf,
  PHASE_LABEL,
  suggestedStartKm,
  targetVdot,
  type Ambition,
  type Kind,
  type Phase,
  type Week,
} from '../lib/plan'
import { fmtPace, fmtTime, predictSeconds, RACE_LABEL, RACE_METERS, type RaceKey } from '../lib/vdot'
import { isoDate, loadLog, saveLog, STATUS_LABEL, today, type DayLog, type TrainingLog } from '../lib/training-log'
import { DayLogSheet } from './DayLogSheet'
import { Roll } from './Roll'
import { TodayCard } from './TodayCard'
import { Segmented } from './Segmented'

export interface PlanSettings {
  goal: RaceKey
  weeks: number
  days: 3 | 4 | 5 | 6
  startKm: number | null
  startDate: string
  /** how much faster the race-day target is than current fitness */
  ambition?: Ambition
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

  const chosenStart = parseDate(settings.startDate)
  const planMonday = mondayOf(chosenStart)
  const offWeekStart = chosenStart.getTime() !== planMonday.getTime()

  const ambition = settings.ambition ?? 'normal'
  const goalVdot = targetVdot(vdot, settings.weeks, ambition)
  const goalMeters = RACE_METERS[settings.goal]
  const nowTime = predictSeconds(vdot, goalMeters)

  const now = useMemo(today, [])
  const [log, setLog] = useState<TrainingLog>(loadLog)
  useEffect(() => saveLog(log), [log])
  const [logging, setLogging] = useState<{ w: number; d: number } | null>(null)
  const patchLog = (iso: string, patch: Partial<DayLog>) =>
    setLog((prev) => ({ ...prev, [iso]: { ...prev[iso], ...patch } }))

  const adapted = useMemo(
    () =>
      adaptPlan(
        {
          vdot,
        targetVdot: goalVdot,
        goal: settings.goal,
        weeks: settings.weeks,
        daysPerWeek: settings.days,
        startKm,
          startDate: parseDate(settings.startDate),
        },
        log,
        now,
      ),
    [vdot, goalVdot, settings.goal, settings.weeks, settings.days, settings.startDate, startKm, log, now],
  )
  const plan = adapted.plan
  const done = useMemo(() => weeklyDone(plan, log), [plan, log])
  const targetTime = predictSeconds(adapted.targetVdot, goalMeters)
  const dayDate = (w: number, d: number) => plusDays(plan[w].start, d)
  const openDay = (w: number, d: number) => setLogging({ w, d })

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
        <Segmented
          id="ambition"
          label="เป้าหมาย"
          value={ambition}
          onChange={(a) => set({ ambition: a })}
          options={[
            { value: 'easy', label: 'ชิล ๆ' },
            { value: 'normal', label: 'ปกติ' },
            { value: 'hard', label: 'ท้าทาย' },
          ]}
        />
        <span className="field-hint ambition-hint">
          คาดว่า VDOT จะขึ้นจาก {vdot.toFixed(1)} เป็น <b>{goalVdot.toFixed(1)}</b> เมื่อซ้อมครบ — เพซซ้อมจะค่อย ๆ
          เร็วขึ้นทีละช่วง ถ้าเซ็ตไหนหนักเกินไป ให้กลับไปใช้เพซของช่วงก่อนหน้า
        </span>
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
          <span className="field-label">เริ่มซ้อมวันที่</span>
          <input
            type="date"
            value={settings.startDate}
            onChange={(e) => e.target.value && set({ startDate: e.target.value })}
          />
          {offWeekStart && (
            <span className="field-hint">
              ตารางจัดเป็นสัปดาห์ จ.–อา. จึงเริ่มสัปดาห์ของ{' '}
              {planMonday.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })} — วันก่อน{' '}
              {fmtDate(chosenStart)} จะแสดงเป็นสีจาง
            </span>
          )}
        </label>
      </aside>

      <div className="plan-out">
        <TodayCard adapted={adapted} log={log} now={now} onPatch={patchLog} onOpen={openDay} />

        <dl className="summary">
          <div>
            <dt>วันแข่ง {RACE_LABEL[settings.goal]}</dt>
            <dd>{raceDay.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</dd>
          </div>
          <div className="summary-target">
            <dt>เป้าเวลาวันแข่ง</dt>
            <dd>
              <Roll value={fmtTime(targetTime)} />
            </dd>
            <span className="summary-sub">
              {fmtPace(targetTime / (goalMeters / 1000))}/กม. · เร็วกว่าตอนนี้ {fmtTime(Math.round(nowTime) - Math.round(targetTime))}
            </span>
          </div>
          <div>
            <dt>ระยะรวม</dt>
            <dd>
              {total.toLocaleString()} <small>กม.</small>
            </dd>
          </div>
          <div>
            <dt>สัปดาห์พีค · ลองรันยาวสุด</dt>
            <dd>
              {peak} <small>·</small> {longest} <small>กม.</small>
            </dd>
          </div>
        </dl>

        <VolumeChart plan={plan} done={done} peak={peak} onPick={(n) => {
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
            <WeekCard
              key={w.n}
              week={w}
              startsOn={chosenStart}
              now={now}
              log={log}
              current={adapted.currentWeek === w.n - 1}
              open={open.has(w.n)}
              onToggle={() => toggle(w.n)}
              onOpenDay={(d) => openDay(w.n - 1, d)}
            />
          ))}
        </ol>
      </div>

      {createPortal(
        <AnimatePresence>
          {logging && plan[logging.w] && (
            <DayLogSheet
              key={`${logging.w}-${logging.d}`}
              date={dayDate(logging.w, logging.d)}
              workout={plan[logging.w].days[logging.d]}
              value={log[isoDate(dayDate(logging.w, logging.d))]}
              onSave={(l) => {
                setLog((prev) => ({ ...prev, [isoDate(dayDate(logging.w, logging.d))]: l }))
                setLogging(null)
              }}
              onDelete={() => {
                setLog((prev) => {
                  const next = { ...prev }
                  delete next[isoDate(dayDate(logging.w, logging.d))]
                  return next
                })
                setLogging(null)
              }}
              onClose={() => setLogging(null)}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function VolumeChart({
  plan,
  done,
  peak,
  onPick,
}: {
  plan: Week[]
  done: (number | null)[]
  peak: number
  onPick: (n: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, margin: '-60px' })
  return (
    <div className="volume" aria-label="ระยะวิ่งรายสัปดาห์" ref={ref}>
      <div className="volume-bars">
        {plan.map((w, i) => (
          <button
            key={w.n}
            type="button"
            className="volume-col"
            onClick={() => onPick(w.n)}
            title={`สัปดาห์ ${w.n}: แผน ${w.km} กม.${done[i] != null ? ` · ทำได้ ${done[i]} กม.` : ''}`}
          >
            <span className="volume-km">{done[i] != null ? `${done[i]}/${w.km}` : w.km}</span>
            <motion.span
              className="volume-bar"
              data-tone={PHASE_TONE[w.phase]}
              data-cutback={w.cutback || undefined}
              data-tracked={done[i] != null || undefined}
              initial={{ height: '0%' }}
              animate={{ height: seen ? `${(w.km / peak) * 100}%` : '0%' }}
              transition={{ type: 'spring', stiffness: 120, damping: 18, delay: i * 0.025 }}
            >
              {done[i] != null && (
                <motion.span
                  className="volume-done"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.min(1, (done[i] ?? 0) / Math.max(1, w.km)) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                />
              )}
            </motion.span>
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

function WeekCard({
  week,
  startsOn,
  now,
  log,
  current,
  open,
  onToggle,
  onOpenDay,
}: {
  week: Week
  startsOn: Date
  now: Date
  log: TrainingLog
  current: boolean
  open: boolean
  onToggle: () => void
  onOpenDay: (d: number) => void
}) {
  const logOf = (i: number) => log[isoDate(plusDays(week.start, i))]
  const loggable = (i: number) => plusDays(week.start, i).getTime() <= now.getTime()
  const isToday = (i: number) => plusDays(week.start, i).getTime() === now.getTime()
  const end = plusDays(week.start, 6)
  // days in the first week that fall before the chosen start date
  const before = (i: number) => plusDays(week.start, i).getTime() < startsOn.getTime()
  return (
    <motion.li
      id={`week-${week.n}`}
      className={`week ${open ? 'is-open' : ''} ${current ? 'is-current' : ''}`}
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
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={week.start.getTime()}
              className="week-dates"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {fmtDate(week.start)} – {fmtDate(end)} · VDOT {week.vdot.toFixed(1)}
            </motion.span>
          </AnimatePresence>
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
          <button
            type="button"
            key={i}
            className={`day ${before(i) ? 'is-before' : ''} ${isToday(i) ? 'is-today' : ''}`}
            data-tone={KIND_TONE[d.kind]}
            data-status={logOf(i)?.status}
            data-adapted={d.adapted ? true : undefined}
            disabled={!loggable(i)}
            onClick={() => onOpenDay(i)}
            title={
              before(i)
                ? 'ก่อนวันเริ่มตาราง'
                : loggable(i)
                  ? `บันทึกผลวัน${DAY[i]}${logOf(i)?.status ? ` (${STATUS_LABEL[logOf(i)!.status!]})` : ''}`
                  : undefined
            }
          >
            <span className="day-name">{isToday(i) ? 'วันนี้' : DAY[i]}</span>
            <span className="day-kind">{d.kind === 'race' ? KIND_LABEL.race : d.title}</span>
            <span className="day-km">{d.km ? `${d.km}` : '—'}</span>
            {logOf(i)?.status && (
              <span className="day-mark" aria-label={STATUS_LABEL[logOf(i)!.status!]}>
                {logOf(i)!.status === 'done' ? '✓' : logOf(i)!.status === 'partial' ? '½' : '✕'}
              </span>
            )}
          </button>
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
                d.kind === 'rest' && !d.adapted ? null : (
                  <li key={i} data-tone={KIND_TONE[d.kind]} className={before(i) ? 'is-before' : undefined}>
                    <span className="wd-day">
                      {DAY[i]} <small>{fmtDate(plusDays(week.start, i))}</small>
                    </span>
                    <span className="wd-body">
                      <strong>{d.title}</strong>
                      {d.detail}
                      {d.adapted && <em className="adapted-tag">ปรับแล้ว · {d.adapted}</em>}
                      {logOf(i)?.status && (
                        <em className="wd-log" data-status={logOf(i)!.status}>
                          {STATUS_LABEL[logOf(i)!.status!]}
                          {logOf(i)!.km != null && logOf(i)!.status !== 'missed' ? ` ${logOf(i)!.km} กม.` : ''}
                          {logOf(i)!.note ? ` — ${logOf(i)!.note}` : ''}
                        </em>
                      )}
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
