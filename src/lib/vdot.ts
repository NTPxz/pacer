// Jack Daniels / Jimmy Gilbert oxygen-cost model.
// v = velocity in metres per minute, t = race duration in minutes.

export type RaceKey = '5K' | '10K' | 'HM' | 'M'
export type ZoneKey = 'E' | 'M' | 'T' | 'I' | 'R'

export const RACE_METERS: Record<RaceKey, number> = {
  '5K': 5000,
  '10K': 10000,
  HM: 21097.5,
  M: 42195,
}

export const RACE_LABEL: Record<RaceKey, string> = {
  '5K': '5K',
  '10K': '10K',
  HM: 'ฮาล์ฟมาราธอน',
  M: 'มาราธอน',
}

const oxygenCost = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v

const fractionOfMax = (t: number) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)

export function vdotFrom(meters: number, seconds: number): number {
  const minutes = seconds / 60
  return oxygenCost(meters / minutes) / fractionOfMax(minutes)
}

/** velocity (m/min) that costs the given VO2 */
function velocityFor(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

const secPerKmAt = (vo2: number) => 60000 / velocityFor(vo2)

export function predictSeconds(vdot: number, meters: number): number {
  let lo = 60
  let hi = 10 * 3600
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    // vdotFrom decreases as time grows
    if (vdotFrom(meters, mid) > vdot) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export interface Zone {
  key: ZoneKey
  name: string
  thai: string
  purpose: string
  /** sec per km; fast end first */
  fast: number
  slow: number
}

export function zonesFor(vdot: number): Zone[] {
  const mPace = predictSeconds(vdot, RACE_METERS.M) / 42.195
  const iPace = secPerKmAt(vdot * 0.975)
  // R is roughly 6 s per 400 m quicker than I
  const rPace = iPace - 15
  return [
    {
      key: 'E',
      name: 'Easy',
      thai: 'วิ่งสบาย',
      purpose: 'สร้างฐานแอโรบิก หัวใจ เส้นเลือดฝอย พูดเป็นประโยคได้',
      fast: secPerKmAt(vdot * 0.7),
      slow: secPerKmAt(vdot * 0.62),
    },
    {
      key: 'M',
      name: 'Marathon',
      thai: 'เพซมาราธอน',
      purpose: 'ฝึกเผาผลาญพลังงานและความคุ้นชินกับเพซแข่งระยะยาว',
      fast: mPace - 3,
      slow: mPace + 3,
    },
    {
      key: 'T',
      name: 'Threshold',
      thai: 'เทมโป',
      purpose: 'ดันจุดแลคเตทให้สูงขึ้น เหนื่อยแบบคุมได้ ประมาณ 1 ชม.ที่ยืนไหว',
      fast: secPerKmAt(vdot * 0.88) - 2,
      slow: secPerKmAt(vdot * 0.88) + 3,
    },
    {
      key: 'I',
      name: 'Interval',
      thai: 'อินเทอร์วัล',
      purpose: 'ใช้ VO₂max เต็มที่ เซ็ตละ 3–5 นาที พักจ็อกเท่าเวลาวิ่ง',
      fast: iPace - 2,
      slow: iPace + 2,
    },
    {
      key: 'R',
      name: 'Repetition',
      thai: 'สปีด',
      purpose: 'ความเร็วและฟอร์ม เซ็ตสั้นไม่เกิน 2 นาที พักให้หายเหนื่อย',
      fast: rPace - 2,
      slow: rPace + 2,
    },
  ]
}

export const zoneMid = (z: Zone) => (z.fast + z.slow) / 2

export function fmtPace(sec: number): string {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function fmtTime(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

export const kmh = (secPerKm: number) => 3600 / secPerKm
