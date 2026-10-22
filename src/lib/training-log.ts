import type { Kind } from './plan'
import { persist } from './sync'

/** how the runner felt before the session — drives same-day adjustments */
export type Feeling = 1 | 2 | 3 | 4 | 5
export type Status = 'done' | 'partial' | 'missed'
/** perceived effort of the session against what was asked */
export type Effort = 'easy' | 'ok' | 'hard' | 'fail'

export interface DayLog {
  feeling?: Feeling
  status?: Status
  /** distance actually run */
  km?: number
  effort?: Effort
  note?: string
  /** snapshot of what was planned when the log was written, so history survives plan changes */
  planned?: { kind: Kind; title: string; km: number }
}

/** keyed by local date YYYY-MM-DD */
export type TrainingLog = Record<string, DayLog>

export const FEELING_LABEL: Record<Feeling, string> = {
  1: 'หมดแรง',
  2: 'ล้า',
  3: 'ปกติ',
  4: 'สดชื่น',
  5: 'พร้อมลุย',
}

export const STATUS_LABEL: Record<Status, string> = {
  done: 'ทำครบ',
  partial: 'ทำได้บางส่วน',
  missed: 'ขาดซ้อม',
}

export const EFFORT_LABEL: Record<Effort, string> = {
  easy: 'ง่ายไป',
  ok: 'พอดี',
  hard: 'หนักไป',
  fail: 'ทำไม่ไหว',
}

const STORE = 'pacer:log:v1'

export function loadLog(): TrainingLog {
  try {
    const raw = localStorage.getItem(STORE)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function saveLog(log: TrainingLog) {
  persist('log', log)
}

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** "today", overridable with ?today=YYYY-MM-DD to preview how the plan adapts */
export function today(): Date {
  const q = new URLSearchParams(window.location.search).get('today')
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const [y, m, d] = q.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return startOfDay(new Date())
}
