// Adaptive layer: reads what actually happened (training log) and reshapes the plan.
//
// Rules, roughly in the spirit of Daniels / common coaching practice:
//  - same day: a bad "battery" check-in softens that day's session
//  - missed quality session: moved to a free easy day later that week (never back-to-back with another hard day)
//  - low completion last week: next week's volume drops, then eases back
//  - several tired check-ins: next week lighter, second hard session swapped for easy running
//  - sessions logged "too hard" / "too easy": upcoming paces shift by a fraction of a VDOT point
//  - a break of 10+ days: a re-entry week without hard sessions and slower paces
// Every change carries a human-readable reason so the runner sees why.

import { buildPlan, easySession, isQuality, type PlanInput, type Week, type WeekMod, type Workout } from './plan'
import { isoDate, type DayLog, type Feeling, type TrainingLog } from './training-log'

export interface Adjustment {
  week: number
  text: string
  tone: 'down' | 'up' | 'info'
}

export interface ProgressStats {
  /** run days whose date has passed (or that are logged) */
  runDays: number
  done: number
  partial: number
  missed: number
  kmDone: number
  kmPlanned: number
  streak: number
}

export interface Adapted {
  plan: Week[]
  notes: Adjustment[]
  /** index of the week containing `now`; <0 before the plan starts, >= length after it ends */
  currentWeek: number
  stats: ProgressStats
  targetVdot: number
}

const DAY_NAMES = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const DAY_MS = 86_400_000
const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY_MS)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const half = (v: number) => Math.round(v * 2) / 2

/** km credited for a logged day */
export function creditedKm(l: DayLog | undefined, plannedKm: number): number | null {
  if (!l?.status) return null
  if (l.status === 'missed') return 0
  if (l.km != null) return l.km
  return l.status === 'done' ? plannedKm : plannedKm / 2
}

/** soften a session according to the pre-run check-in */
export function applyFeeling(w: Workout, f: Feeling, vdot: number): Workout {
  if (w.kind === 'rest' || f >= 3) return w
  if (w.kind === 'race') {
    return { ...w, adapted: 'ฟีลไม่ดี — วอร์มนานขึ้น ออกตัวช้ากว่าเป้า 5–10 วิ/กม. แล้วค่อยดูอาการ' }
  }
  if (f === 1) {
    return {
      kind: 'rest',
      title: 'พัก',
      detail: 'ร่างกายบอกว่าต้องพัก นอนเพิ่ม กินให้ดี ถ้าอยากขยับ ให้เดินหรือจ็อกเบามาก ๆ 15–20 นาที',
      km: 0,
      adapted: `หมดแรง → เปลี่ยนจาก${w.title}เป็นพัก`,
    }
  }
  if (isQuality(w.kind)) {
    return {
      ...easySession(w.km * 0.6, vdot, ' — ไม่ต้องทำเซ็ตเร็ววันนี้'),
      adapted: `ล้า → เปลี่ยนจาก${w.title}เป็นวิ่งเบา`,
    }
  }
  const km = half(w.km * 0.7)
  return {
    ...easySession(km, vdot, ' — วิ่งสบาย ๆ หยุดได้ถ้ายังไม่ดีขึ้น'),
    kind: w.kind === 'long' ? 'long' : 'easy',
    title: w.kind === 'long' ? 'ลองรัน (ย่อ)' : w.title,
    adapted: `ล้า → ลดระยะจาก ${w.km} เหลือ ${km} กม.`,
  }
}

export function adaptPlan(input: PlanInput, log: TrainingLog, now: Date): Adapted {
  const base = buildPlan(input)
  const start = base[0].start
  const currentWeek = Math.floor(dayDiff(now, start) / 7)
  const weeks = base.length
  const nowIso = isoDate(now)
  const dateOf = (w: number, d: number) => isoDate(addDays(start, w * 7 + d))

  const mods: Record<number, WeekMod> = {}
  const notes: Adjustment[] = []
  const addMod = (i: number, m: WeekMod) => {
    if (i < 0 || i >= weeks) return
    const cur = mods[i] ?? {}
    mods[i] = {
      volume: (cur.volume ?? 1) * (m.volume ?? 1),
      vdot: (cur.vdot ?? 0) + (m.vdot ?? 0),
      downgrade: cur.downgrade || m.downgrade,
      reentry: cur.reentry || m.reentry,
      reason: m.reason ?? cur.reason,
    }
  }
  // volume changes never touch race week
  const addVolume = (i: number, volume: number, extra: WeekMod = {}) => addMod(i, i === weeks - 1 ? extra : { volume, ...extra })

  const pastEntries = Object.entries(log)
    .filter(([d]) => d <= nowIso)
    .sort(([a], [b]) => a.localeCompare(b))
  const engaged = pastEntries.some(([, l]) => l.status)

  if (currentWeek >= 0 && currentWeek < weeks && engaged) {
    // 1) a long break → re-entry
    const lastRun = [...pastEntries].reverse().find(([, l]) => l.status === 'done' || l.status === 'partial')?.[0]
    const since = lastRun ? lastRun : isoDate(start)
    const [y, m, d] = since.split('-').map(Number)
    const gap = dayDiff(now, new Date(y, m - 1, d))
    if (gap >= 10) {
      const penalty = -Math.min(4, Math.max(0.5, (gap - 7) / 7))
      for (let i = currentWeek; i < weeks; i++) addMod(i, { vdot: penalty })
      addMod(currentWeek, { reentry: true, reason: `ไม่ได้วิ่งมา ${gap} วัน — สัปดาห์นี้กลับมาแบบเบา ๆ ก่อน` })
      addVolume(currentWeek, 0.7)
      addVolume(currentWeek + 1, 0.85)
      notes.push({
        week: currentWeek + 1,
        tone: 'down',
        text: `ไม่ได้วิ่งมา ${gap} วัน: สัปดาห์นี้ไม่มีเซ็ตหนัก ลดระยะ 30% และเพซช้าลง ${Math.abs(penalty).toFixed(1)} VDOT แล้วค่อยเพิ่มกลับ`,
      })
    } else if (currentWeek >= 1) {
      // 2) completion of last week
      const w = base[currentWeek - 1]
      let planned = 0
      let credited = 0
      let known = 0
      w.days.forEach((day, i) => {
        if (!day.km) return
        const c = creditedKm(log[dateOf(currentWeek - 1, i)], day.km)
        if (c == null) return
        known++
        planned += day.km
        credited += c
      })
      if (known >= 2 && planned > 0) {
        const ratio = credited / planned
        if (ratio < 0.35) {
          addVolume(currentWeek, 0.8, { downgrade: true, reason: 'สัปดาห์ก่อนทำได้น้อย — ลดเซ็ตหนักลง 1 ครั้ง' })
          addVolume(currentWeek + 1, 0.92)
          notes.push({
            week: currentWeek + 1,
            tone: 'down',
            text: `สัปดาห์ที่แล้วทำได้ ${Math.round(ratio * 100)}% ของแผน: สัปดาห์นี้ลดระยะ 20% เหลือเซ็ตหนักครั้งเดียว แล้วค่อยกลับเข้าแผน`,
          })
        } else if (ratio < 0.65) {
          addVolume(currentWeek, 0.88)
          notes.push({
            week: currentWeek + 1,
            tone: 'down',
            text: `สัปดาห์ที่แล้วทำได้ ${Math.round(ratio * 100)}% ของแผน: สัปดาห์นี้ลดระยะ 12% ไม่ต้องวิ่งชดเชย`,
          })
        } else if (ratio >= 0.95) {
          notes.push({ week: currentWeek + 1, tone: 'info', text: `สัปดาห์ที่แล้วทำได้ ${Math.round(Math.min(ratio, 1) * 100)}% เยี่ยมมาก ไปต่อตามแผน` })
        }
      }
    }

    // 3) fatigue from recent check-ins
    const weekAgo = isoDate(addDays(now, -7))
    const feelings = pastEntries.filter(([d, l]) => d > weekAgo && l.feeling).map(([, l]) => l.feeling!)
    if (feelings.length >= 3) {
      const avg = feelings.reduce((s, f) => s + f, 0) / feelings.length
      if (avg <= 2.2) {
        addVolume(currentWeek + 1, 0.9, { downgrade: true, reason: 'ช่วงนี้ล้าสะสม — เปลี่ยนเซ็ตหนักครั้งที่ 2 เป็นวิ่งเบา' })
        notes.push({
          week: currentWeek + 2,
          tone: 'down',
          text: `เช็กอิน 7 วันล่าสุดเฉลี่ย ${avg.toFixed(1)}/5 (ล้าสะสม): สัปดาห์หน้าลดระยะ 10% และเหลือเซ็ตหนักครั้งเดียว`,
        })
      }
    }

    // 4) perceived effort on recent hard sessions → nudge paces
    const efforts = pastEntries.filter(([, l]) => l.effort && l.planned && isQuality(l.planned.kind)).slice(-4)
    if (efforts.length) {
      const score = { easy: 0.3, ok: 0, hard: -0.5, fail: -0.8 } as const
      const delta = Math.max(-2.5, Math.min(1, efforts.reduce((s, [, l]) => s + score[l.effort!], 0)))
      if (Math.abs(delta) >= 0.3) {
        for (let i = currentWeek + 1; i < weeks; i++) addMod(i, { vdot: delta })
        notes.push({
          week: currentWeek + 2,
          tone: delta < 0 ? 'down' : 'up',
          text:
            delta < 0
              ? `เซ็ตหนักล่าสุดรู้สึกหนักเกินไป: ตั้งแต่สัปดาห์หน้าเพซช้าลง ${Math.abs(delta).toFixed(1)} VDOT`
              : `เซ็ตหนักล่าสุดรู้สึกง่าย: ตั้งแต่สัปดาห์หน้าเพซเร็วขึ้น ${delta.toFixed(1)} VDOT`,
        })
      }
    }
  }

  const plan = Object.keys(mods).length ? buildPlan({ ...input, mods }) : base

  // 5) move a missed hard session within the current week
  if (currentWeek >= 0 && currentWeek < weeks) {
    const days = plan[currentWeek].days
    const todayIdx = dayDiff(now, plan[currentWeek].start)
    for (let d = 0; d < todayIdx; d++) {
      if (!isQuality(days[d].kind) || log[dateOf(currentWeek, d)]?.status !== 'missed') continue
      for (let t = Math.max(d + 1, todayIdx); t < 7; t++) {
        const free =
          days[t].kind === 'easy' &&
          !log[dateOf(currentWeek, t)]?.status &&
          // the missed day itself didn't happen, so it doesn't count as a hard neighbour
          (t - 1 === d || !isQuality(days[t - 1]?.kind ?? 'rest')) &&
          !(days[t + 1] && (isQuality(days[t + 1].kind) || days[t + 1].kind === 'race'))
        if (!free) continue
        days[t] = { ...days[d], adapted: `ย้ายมาจากวัน${DAY_NAMES[d]}ที่ขาดไป` }
        // km goes with the session, so the week total isn't counted twice
        days[d] = { ...days[d], km: 0, adapted: `ขาดซ้อม → ย้ายไปวัน${DAY_NAMES[t]}` }
        notes.push({ week: currentWeek + 1, tone: 'info', text: `ย้าย${days[t].title}ที่ขาดไปวัน${DAY_NAMES[d]} มาเป็นวัน${DAY_NAMES[t]}` })
        break
      }
      break
    }
  }

  // 6) same-day softening from check-ins
  plan.forEach((w, wi) =>
    w.days.forEach((day, di) => {
      const f = log[dateOf(wi, di)]?.feeling
      if (f && f <= 2) w.days[di] = applyFeeling(day, f, w.vdot)
    }),
  )
  plan.forEach((w) => (w.km = Math.round(w.days.reduce((s, d) => s + d.km, 0))))

  // progress
  const stats: ProgressStats = { runDays: 0, done: 0, partial: 0, missed: 0, kmDone: 0, kmPlanned: 0, streak: 0 }
  const runs: { iso: string; l?: DayLog }[] = []
  plan.forEach((w, wi) =>
    w.days.forEach((day, di) => {
      const iso = dateOf(wi, di)
      const l = log[iso]
      const planned = l?.planned?.km ?? day.km
      if (!planned || (iso >= nowIso && !l?.status)) return
      runs.push({ iso, l })
      stats.runDays++
      stats.kmPlanned += planned
      const c = creditedKm(l, planned)
      if (c != null) stats.kmDone += c
      if (l?.status) stats[l.status]++
    }),
  )
  for (let i = runs.length - 1; i >= 0; i--) {
    const s = runs[i].l?.status
    if (s === 'done' || s === 'partial') stats.streak++
    else if (runs[i].iso === nowIso && !s) continue
    else break
  }

  return {
    plan,
    notes,
    currentWeek,
    stats,
    targetVdot: input.targetVdot + (mods[weeks - 1]?.vdot ?? 0),
  }
}

/** km actually credited per week, for the volume chart */
export function weeklyDone(plan: Week[], log: TrainingLog): (number | null)[] {
  return plan.map((w) => {
    let any = false
    let sum = 0
    w.days.forEach((day, i) => {
      const l = log[isoDate(addDays(w.start, i))]
      const c = creditedKm(l, l?.planned?.km ?? day.km)
      if (c != null) {
        any = true
        sum += c
      }
    })
    return any ? Math.round(sum) : null
  })
}
