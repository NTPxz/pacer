import {
  fmtPace,
  fmtTime,
  predictSeconds,
  RACE_LABEL,
  RACE_METERS,
  zoneMid,
  zonesFor,
  type RaceKey,
  type Zone,
  type ZoneKey,
} from './vdot'

export type Phase = 'base' | 'build' | 'peak' | 'taper'
export type Kind =
  | 'rest'
  | 'easy'
  | 'strides'
  | 'fartlek'
  | 'long'
  | 'threshold'
  | 'interval'
  | 'rep'
  | 'marathon'
  | 'race'

export interface Workout {
  kind: Kind
  title: string
  detail: string
  km: number
  zone?: ZoneKey
  /** why the adaptive layer changed this session (shown to the runner) */
  adapted?: string
}

export const QUALITY: Kind[] = ['threshold', 'interval', 'rep', 'marathon', 'fartlek']
export const isQuality = (k: Kind) => QUALITY.includes(k)

/** adjustments the adaptive layer (adapt.ts) asks the generator to apply to one week */
export interface WeekMod {
  /** multiply weekly volume */
  volume?: number
  /** add to the week's VDOT (negative = slower paces) */
  vdot?: number
  /** swap the second quality session for easy running */
  downgrade?: boolean
  /** coming back from a break: no hard sessions at all */
  reentry?: boolean
  reason?: string
}

export interface Week {
  n: number
  phase: Phase
  cutback: boolean
  km: number
  start: Date
  days: Workout[]
  /** fitness the week's paces are based on */
  vdot: number
  mod?: WeekMod
}

export type Ambition = 'easy' | 'normal' | 'hard'

export interface PlanInput {
  vdot: number
  /** fitness expected on race day — see targetVdot() */
  targetVdot: number
  /** per-week adjustments keyed by week index (0-based) */
  mods?: Record<number, WeekMod>
  goal: RaceKey
  weeks: number
  daysPerWeek: 3 | 4 | 5 | 6
  startKm: number
  startDate: Date
}

export const PHASE_LABEL: Record<Phase, string> = {
  base: 'สร้างฐาน',
  build: 'เพิ่มความหนัก',
  peak: 'ช่วงพีค',
  taper: 'ลดโหลด',
}

export const KIND_LABEL: Record<Kind, string> = {
  rest: 'พัก',
  easy: 'อีซี่',
  strides: 'อีซี่ + สไตรด์',
  fartlek: 'ฟาร์ทเลค',
  long: 'ลองรัน',
  threshold: 'เทมโป',
  interval: 'อินเทอร์วัล',
  rep: 'สปีด',
  marathon: 'เพซมาราธอน',
  race: 'วันแข่ง',
}

type Slot = 'Q1' | 'Q2' | 'E' | 'L'

// index 0 = Monday
const LAYOUT: Record<PlanInput['daysPerWeek'], Partial<Record<number, Slot>>> = {
  3: { 1: 'Q1', 3: 'Q2', 6: 'L' },
  4: { 1: 'Q1', 3: 'Q2', 5: 'E', 6: 'L' },
  5: { 1: 'Q1', 2: 'E', 3: 'Q2', 5: 'E', 6: 'L' },
  6: { 0: 'E', 1: 'Q1', 2: 'E', 3: 'Q2', 5: 'E', 6: 'L' },
}

const LONG_SHARE: Record<RaceKey, number> = { '5K': 0.25, '10K': 0.27, HM: 0.29, M: 0.31 }
const LONG_CAP: Record<RaceKey, number> = { '5K': 16, '10K': 20, HM: 24, M: 34 }
const PEAK_GROWTH: Record<RaceKey, number> = { '5K': 1.3, '10K': 1.35, HM: 1.42, M: 1.55 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const half = (v: number) => Math.round(v * 2) / 2

const AMBITION: Record<Ambition, number> = { easy: 0.5, normal: 1, hard: 1.5 }

/**
 * Fitness expected after the block. Daniels' rule of thumb: newer runners gain about
 * one VDOT point per 4–6 weeks of consistent training, fitter runners progressively less.
 */
export function targetVdot(vdot: number, weeks: number, ambition: Ambition): number {
  const per4 = vdot < 40 ? 1 : vdot < 50 ? 0.8 : vdot < 60 ? 0.6 : 0.4
  return vdot + Math.min(5, Math.min(4, (weeks / 4) * per4) * AMBITION[ambition])
}

// share of the expected gain that each phase trains at; paces step up only as the block progresses
const PHASE_GAIN: Record<Phase, number> = { base: 0, build: 0.35, peak: 0.7, taper: 1 }

export function suggestedStartKm(vdot: number, days: number, goal: RaceKey): number {
  const goalBonus = goal === 'M' ? 10 : goal === 'HM' ? 5 : 0
  return Math.round(clamp(days * 6 + (vdot - 35) * 0.6 + goalBonus, 15, 90))
}

function phases(weeks: number, goal: RaceKey): Phase[] {
  const taper = goal === 'HM' || goal === 'M' ? 2 : 1
  const rest = weeks - taper
  const base = Math.max(2, Math.round(rest * 0.3))
  const build = Math.max(2, Math.round(rest * 0.35))
  const peak = rest - base - build
  return [
    ...Array<Phase>(base).fill('base'),
    ...Array<Phase>(build).fill('build'),
    ...Array<Phase>(peak).fill('peak'),
    ...Array<Phase>(taper).fill('taper'),
  ]
}

function nextMonday(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow))
  return d
}

/** Monday of the Mon–Sun week that contains `d` */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

export { nextMonday }

export function buildPlan(input: PlanInput): Week[] {
  const { vdot, goal, weeks, daysPerWeek, startKm } = input
  const goalVdot = input.targetVdot
  const zoneMap = (v: number) => Object.fromEntries(zonesFor(v).map((x) => [x.key, x])) as Record<ZoneKey, Zone>
  // reassigned per week; the session builders below read it through p() / per()
  let z = zoneMap(vdot)
  const p = (k: ZoneKey) => `${fmtPace(z[k].fast)}–${fmtPace(z[k].slow)}/กม.`
  const per = (k: ZoneKey, m: number) => fmtPace((zoneMid(z[k]) * m) / 1000)

  const phaseOf = phases(weeks, goal)
  const lastBuildWeek = phaseOf.lastIndexOf('peak')
  const peakKm = startKm * PEAK_GROWTH[goal]
  // the plan is laid out Mon–Sun, so it begins on the week of the chosen date
  const monday = mondayOf(input.startDate)

  const warm = (weekly: number) => (weekly < 30 ? 1.5 : 2)

  // ---------- session builders ----------
  const easy = (km: number): Workout => ({
    kind: 'easy',
    title: KIND_LABEL.easy,
    detail: `${half(km)} กม. @ ${p('E')} — คุยได้ไม่หอบ`,
    km: half(km),
    zone: 'E',
  })

  const strides = (km: number): Workout => ({
    kind: 'strides',
    title: KIND_LABEL.strides,
    detail: `${half(km)} กม. สบาย ๆ จบด้วยสไตรด์ 6 × 20 วิ (เร่งถึงเพซ ${per('R', 1000)}/กม.) เดินพักเต็มที่`,
    km: half(km),
    zone: 'E',
  })

  const fartlek = (weekly: number, prog: number): Workout => {
    const n = Math.round(6 + prog * 4)
    const w = warm(weekly)
    const km = w * 2 + n * 0.45
    return {
      kind: 'fartlek',
      title: KIND_LABEL.fartlek,
      detail: `วอร์ม ${w} กม. · ${n} × 1 นาทีเร็ว (ราว ${per('I', 1000)}/กม.) สลับ 1 นาทีจ็อก · คูลดาวน์ ${w} กม.`,
      km: half(km),
      zone: 'I',
    }
  }

  const threshold = (weekly: number, prog: number, continuous: boolean): Workout => {
    const vol = clamp(weekly * 0.1 * (0.8 + prog * 0.35), 3, 10)
    const w = warm(weekly)
    let main: string
    let mainKm: number
    if (continuous) {
      mainKm = clamp(Math.round(vol * 0.75), 3, 8)
      main = `เทมโปต่อเนื่อง ${mainKm} กม. @ ${p('T')}`
    } else if (vol >= 6) {
      const n = Math.round(vol / 2)
      mainKm = n * 2
      main = `${n} × 2 กม. @ ${p('T')} พักจ็อก 2 นาที`
    } else {
      const n = Math.round(vol)
      mainKm = n
      main = `${n} × 1 กม. @ ${p('T')} พักจ็อก 1 นาที`
    }
    return {
      kind: 'threshold',
      title: KIND_LABEL.threshold,
      detail: `วอร์ม ${w} กม. · ${main} · คูลดาวน์ ${w} กม.`,
      km: half(w * 2 + mainKm * 1.1),
      zone: 'T',
    }
  }

  const interval = (weekly: number, prog: number): Workout => {
    const vol = clamp(weekly * 0.08 * (0.8 + prog * 0.35), 3, 8)
    const w = warm(weekly)
    const rep = vol < 4.5 ? 800 : prog > 0.6 && vol >= 6 ? 1200 : 1000
    const n = Math.max(3, Math.round((vol * 1000) / rep))
    const mainKm = (n * rep) / 1000
    return {
      kind: 'interval',
      title: KIND_LABEL.interval,
      detail: `วอร์ม ${w} กม. + สไตรด์ 4 ครั้ง · ${n} × ${rep} ม. ใน ${per('I', rep)} (${p('I')}) พักจ็อกเท่าเวลาวิ่ง · คูลดาวน์ ${w} กม.`,
      km: half(w * 2 + mainKm * 1.6),
      zone: 'I',
    }
  }

  const reps = (weekly: number, prog: number): Workout => {
    const vol = clamp(weekly * 0.05 * (0.8 + prog * 0.35), 2, 5)
    const w = warm(weekly)
    const rep = vol < 3 ? 200 : 400
    const n = Math.round((vol * 1000) / rep)
    const mainKm = (n * rep) / 1000
    return {
      kind: 'rep',
      title: KIND_LABEL.rep,
      detail: `วอร์ม ${w} กม. · ${n} × ${rep} ม. ใน ${per('R', rep)} วิ/เซ็ต พักเดิน-จ็อก ${rep} ม. · คูลดาวน์ ${w} กม.`,
      km: half(w * 2 + mainKm * 2),
      zone: 'R',
    }
  }

  const marathonRun = (weekly: number, prog: number): Workout => {
    const mKm = Math.round(clamp(weekly * 0.18 * (0.8 + prog * 0.4), 6, 18))
    return {
      kind: 'marathon',
      title: KIND_LABEL.marathon,
      detail: `วอร์ม 2 กม. · ${mKm} กม. ต่อเนื่อง @ ${p('M')} ฝึกจิบน้ำ/เจลระหว่างทาง · คูลดาวน์ 1 กม.`,
      km: mKm + 3,
      zone: 'M',
    }
  }

  const longRun = (km: number, phase: Phase, n: number): Workout => {
    const k = Math.round(km)
    let detail = `${k} กม. @ ${p('E')} สม่ำเสมอ ไม่ต้องเร่ง`
    if (goal === 'M' && phase === 'peak' && n % 2 === 0) {
      const fin = Math.round(k * 0.35)
      detail = `${k} กม. — ${k - fin} กม. อีซี่ แล้วปิด ${fin} กม. สุดท้าย @ ${p('M')}`
    } else if (goal === 'HM' && phase === 'peak' && n % 2 === 0) {
      const fin = Math.min(5, Math.round(k * 0.25))
      detail = `${k} กม. — ปิด ${fin} กม. สุดท้ายที่ ${p('T')} ฝั่งช้า`
    } else if (phase === 'build' && n % 2 === 1) {
      detail = `${k} กม. @ ${p('E')} เพิ่มสไตรด์ 4 × 20 วิ ช่วงท้าย`
    }
    return { kind: 'long', title: KIND_LABEL.long, detail, km: k, zone: 'E' }
  }

  const rest: Workout = { kind: 'rest', title: KIND_LABEL.rest, detail: 'พักผ่อน ยืดเหยียด หรือเดินเบา ๆ', km: 0 }

  // ---------- quality selection per phase ----------
  const quality = (
    phase: Phase,
    slot: 'Q1' | 'Q2',
    weekly: number,
    prog: number,
    cutback: boolean,
    weekInPhase: number,
    phaseLen: number,
  ): Workout => {
    if (phase === 'base') {
      if (slot === 'Q1') return strides(weekly * 0.14)
      return weekInPhase >= phaseLen / 2 && !cutback ? fartlek(weekly, prog) : easy(weekly * 0.14)
    }
    if (cutback && slot === 'Q2') return strides(weekly * 0.13)
    const short = goal === '5K' || goal === '10K'
    if (phase === 'build') {
      if (slot === 'Q1') return short ? reps(weekly, prog) : interval(weekly, prog)
      return threshold(weekly, prog, false)
    }
    // peak
    if (short) {
      if (slot === 'Q1') return interval(weekly, prog)
      return goal === '5K' && weekInPhase % 2 === 1 ? reps(weekly, prog) : threshold(weekly, prog, weekInPhase % 2 === 1)
    }
    if (slot === 'Q1') return threshold(weekly, prog, weekInPhase % 2 === 1)
    return goal === 'M' ? marathonRun(weekly, prog) : interval(weekly, prog)
  }

  // ---------- assemble ----------
  const result: Week[] = []
  const phaseStart: Record<Phase, number> = {
    base: phaseOf.indexOf('base'),
    build: phaseOf.indexOf('build'),
    peak: phaseOf.indexOf('peak'),
    taper: phaseOf.indexOf('taper'),
  }
  const phaseLen = (ph: Phase) => phaseOf.filter((x) => x === ph).length

  for (let i = 0; i < weeks; i++) {
    const phase = phaseOf[i]
    const isLast = i === weeks - 1
    const wip = i - phaseStart[phase]
    const cutback = phase !== 'taper' && i % 4 === 3 && wip > 0 && i !== lastBuildWeek
    const ramp = lastBuildWeek > 0 ? Math.min(1, i / lastBuildWeek) : 1
    let weekly = startKm + (peakKm - startKm) * ramp
    if (cutback) weekly *= 0.8
    if (phase === 'taper') weekly = peakKm * (isLast ? 0.5 : 0.72)
    const mod = input.mods?.[i]
    if (mod?.volume) weekly *= mod.volume

    const len = phaseLen(phase)
    const prog = len > 1 ? wip / (len - 1) : 1
    const weekVdot = vdot + (goalVdot - vdot) * PHASE_GAIN[phase] + (mod?.vdot ?? 0)
    z = zoneMap(weekVdot)
    const layout = LAYOUT[daysPerWeek]
    const days: Workout[] = []

    if (phase === 'taper') {
      for (let d = 0; d < 7; d++) {
        const slot = layout[d]
        if (isLast && d === 6) {
          const t = predictSeconds(goalVdot + (mod?.vdot ?? 0), RACE_METERS[goal])
          const now = predictSeconds(vdot, RACE_METERS[goal])
          const faster = Math.round(now) - Math.round(t)
          days.push({
            kind: 'race',
            title: `${KIND_LABEL.race} ${RACE_LABEL[goal]}`,
            detail: `เป้าเวลา ${fmtTime(t)} (เพซเฉลี่ย ${fmtPace(t / (RACE_METERS[goal] / 1000))}/กม.)${faster > 0 ? ` เร็วกว่าความฟิตตอนเริ่มตาราง ${fmtTime(faster)}` : ''} — ออกตัวช้ากว่าเป้าเล็กน้อย แล้วค่อยไล่`,
            km: Math.round((RACE_METERS[goal] / 1000) * 10) / 10,
          })
        } else if (isLast && d === 5) {
          days.push(daysPerWeek >= 5 ? { ...easy(3), detail: `จ็อกเบา 3 กม. + สไตรด์ 3 ครั้ง เตรียมขา` } : rest)
        } else if (isLast && d === 4) {
          days.push(rest)
        } else if (!slot) {
          days.push(rest)
        } else if (slot === 'Q1') {
          const w = goal === 'M' || goal === 'HM' ? threshold(weekly, 0, false) : interval(weekly * 0.8, 0)
          days.push({ ...w, title: `${w.title} (ลดโหลด)` })
        } else if (slot === 'Q2') {
          days.push(strides(weekly * 0.14))
        } else if (slot === 'L') {
          days.push(longRun(clamp(weekly * 0.3, 8, LONG_CAP[goal] * 0.6), phase, i))
        } else {
          days.push(easy(Math.max(4, weekly * 0.12)))
        }
      }
    } else {
      const longKm = clamp(weekly * LONG_SHARE[goal], 6, LONG_CAP[goal])
      let q1 = quality(phase, 'Q1', weekly, prog, cutback, wip, len)
      let q2 = quality(phase, 'Q2', weekly, prog, cutback, wip, len)
      if (mod?.reentry) {
        q1 = { ...strides(weekly * 0.14), adapted: mod.reason }
        q2 = { ...easy(weekly * 0.14), adapted: mod.reason }
      } else if (mod?.downgrade && isQuality(q2.kind)) {
        q2 = { ...strides(weekly * 0.13), adapted: mod.reason }
      }
      const eDays = Object.values(layout).filter((s) => s === 'E').length
      const used = longKm + q1.km + q2.km
      // a single easy day should never outgrow the long run
      const eKm = eDays ? clamp((weekly - used) / eDays, 4, longKm * 0.7) : 0
      for (let d = 0; d < 7; d++) {
        const slot = layout[d]
        if (!slot) days.push(rest)
        else if (slot === 'Q1') days.push(q1)
        else if (slot === 'Q2') days.push(q2)
        else if (slot === 'L') days.push(longRun(longKm, phase, i))
        else days.push(easy(eKm))
      }
    }

    const start = new Date(monday)
    start.setDate(monday.getDate() + i * 7)
    result.push({
      n: i + 1,
      phase,
      cutback,
      km: Math.round(days.reduce((s, d) => s + d.km, 0)),
      start,
      days,
      vdot: weekVdot,
      mod,
    })
  }
  return result
}

/** a stand-alone easy run at the given fitness, used when the day's plan is softened */
export function easySession(km: number, vdot: number, detailSuffix = ''): Workout {
  const e = zonesFor(vdot).find((z) => z.key === 'E')!
  const k = half(km)
  return {
    kind: 'easy',
    title: KIND_LABEL.easy,
    detail: `${k} กม. @ ${fmtPace(e.fast)}–${fmtPace(e.slow)}/กม.${detailSuffix}`,
    km: k,
    zone: 'E',
  }
}
