import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TimeInput } from './components/TimeInput'
import { Track } from './components/Track'
import { ZoneTable } from './components/ZoneTable'
import { Predictions } from './components/Predictions'
import { PlanBuilder, type PlanSettings } from './components/PlanBuilder'
import { TrophyCase } from './components/TrophyCase'
import { Donate } from './components/Donate'
import { fmtPace, fmtTime, predictSeconds, RACE_LABEL, RACE_METERS, vdotFrom, zonesFor, type RaceKey } from './lib/vdot'
import { DIST_SHORT, type Race } from './lib/races'
import { nextMonday } from './lib/plan'

// storage keys keep the old 'pacer' prefix so existing users don't lose their data
const STORE = 'pacer:v1'
const DISTS: RaceKey[] = ['5K', '10K', 'HM', 'M']

// the formula is trustworthy for roughly a 26:00–1:45:00 10K; carry that fitness band to every distance
const VDOT_MAX = vdotFrom(10000, 26 * 60)
const VDOT_MIN = vdotFrom(10000, 105 * 60)
const LIMITS = Object.fromEntries(
  DISTS.map((k) => [
    k,
    [
      Math.ceil(predictSeconds(VDOT_MAX, RACE_METERS[k]) / 60) * 60,
      Math.floor(predictSeconds(VDOT_MIN, RACE_METERS[k]) / 60) * 60,
    ],
  ]),
) as Record<RaceKey, [number, number]>

const PRESETS: Record<RaceKey, number[]> = {
  '5K': [17 * 60, 20 * 60 + 30, 24 * 60, 28 * 60, 32 * 60],
  '10K': [35 * 60, 42 * 60 + 30, 50 * 60, 58 * 60, 65 * 60],
  HM: [80 * 60, 95 * 60, 110 * 60, 125 * 60, 140 * 60],
  M: [179 * 60, 210 * 60, 239 * 60, 270 * 60, 300 * 60],
}
const NUDGE: Record<RaceKey, number> = { '5K': 5, '10K': 5, HM: 15, M: 30 }

interface Saved {
  pb: number
  /** distance the pb was run at; older saves are 10K */
  dist: RaceKey
  plan: PlanSettings
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function load(): Saved {
  const fallback: Saved = {
    pb: 50 * 60,
    dist: '10K',
    plan: { goal: '10K', weeks: 12, days: 4, startKm: null, startDate: iso(nextMonday(new Date())) },
  }
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Saved
    return {
      pb: saved.pb ?? fallback.pb,
      dist: DISTS.includes(saved.dist) ? saved.dist : '10K',
      plan: { ...fallback.plan, ...saved.plan },
    }
  } catch {
    return fallback
  }
}

function levelOf(vdot: number) {
  if (vdot < 33) return 'เริ่มต้น'
  if (vdot < 42) return 'นักวิ่งสมัครเล่น'
  if (vdot < 50) return 'จริงจัง'
  if (vdot < 58) return 'ระดับสโมสร'
  if (vdot < 66) return 'แนวหน้า'
  return 'ระดับอีลิท'
}

const ease = [0.2, 0.8, 0.2, 1] as const

export default function App() {
  const initial = useMemo(load, [])
  const [dist, setDist] = useState<RaceKey>(initial.dist)
  const [pb, setPb] = useState(initial.pb)
  const [plan, setPlan] = useState<PlanSettings>(initial.plan)
  const [MIN_PB, MAX_PB] = LIMITS[dist]
  const inRange = (t: number, k: RaceKey) => t >= LIMITS[k][0] && t <= LIMITS[k][1]
  const lastValid = useRef(
    inRange(initial.pb, initial.dist) ? initial.pb : Math.round(predictSeconds(vdotFrom(10000, 50 * 60), RACE_METERS[initial.dist])),
  )

  const valid = inRange(pb, dist)
  if (valid) lastValid.current = pb
  const km = RACE_METERS[dist] / 1000
  const vdot = vdotFrom(RACE_METERS[dist], lastValid.current)
  const zones = useMemo(() => zonesFor(vdot), [vdot])

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ pb: lastValid.current, dist, plan }))
    } catch {
      /* storage unavailable — settings just won't persist */
    }
  }, [pb, dist, plan])

  /** switch distance but keep the same fitness: the time morphs to its equivalent */
  const switchDist = (k: RaceKey) => {
    if (k === dist) return
    const t = Math.round(predictSeconds(vdot, RACE_METERS[k]))
    lastValid.current = t
    setDist(k)
    setPb(t)
  }

  const applyRaceFitness = (v: number, race: Race) => {
    // a standard-distance race is used as-is; anything else is converted to its 10K equivalent
    const k: RaceKey = race.dist === 'other' ? '10K' : race.dist
    const t = race.dist === 'other' ? Math.round(predictSeconds(v, RACE_METERS['10K'])) : race.seconds
    const [lo, hi] = LIMITS[k]
    const clamped = Math.min(hi, Math.max(lo, t))
    lastValid.current = clamped
    setDist(k)
    setPb(clamped)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nudge = (d: number) => setPb((p) => Math.min(MAX_PB, Math.max(MIN_PB, p + d)))

  return (
    <>
      <header className="topbar">
        <a href="#top" className="brand" aria-label="TAYAN ทะยาน">
          <svg viewBox="0 0 40 22" aria-hidden>
            <rect x="1.5" y="1.5" width="37" height="19" rx="9.5" />
            <circle r="3">
              <animateMotion dur="6s" repeatCount="indefinite" path="M 12 20.5 H 28 A 9.5 9.5 0 0 0 28 1.5 H 12 A 9.5 9.5 0 0 0 12 20.5 Z" />
            </circle>
          </svg>
          <span className="brand-name">
            TAYAN<small>ทะยาน</small>
          </span>
        </a>
        <nav>
          <a href="#zones">
            <i>01</i> โซนเพซ
          </a>
          <a href="#races">
            <i>02</i> เวลาแข่ง
          </a>
          <a href="#plan">
            <i>03</i> ตารางซ้อม
          </a>
          <a href="#trophies">
            <i>04</i> ตู้ถ้วย
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-input">
            <motion.div
              className="hero-head"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
            >
              <p className="eyebrow">เวลาที่ดีที่สุดของคุณ ระยะ</p>
              <div className="dist-tabs" role="radiogroup" aria-label="ระยะที่ใช้คำนวณ">
                {DISTS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={dist === k}
                    aria-label={RACE_LABEL[k]}
                    className={dist === k ? 'is-active' : ''}
                    onClick={() => switchDist(k)}
                  >
                    {dist === k && (
                      <motion.span
                        layoutId="dist-tab"
                        className="dist-tab-thumb"
                        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                      />
                    )}
                    <span>{DIST_SHORT[k]}</span>
                  </button>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.08, ease }}
            >
              <TimeInput seconds={pb} onChange={setPb} />
            </motion.div>

            <motion.div
              className="hero-tools"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              <div className="nudges">
                <button type="button" onClick={() => nudge(-NUDGE[dist])} aria-label={`ลด ${NUDGE[dist]} วินาที`}>
                  −{NUDGE[dist]}″
                </button>
                <button type="button" onClick={() => nudge(NUDGE[dist])} aria-label={`เพิ่ม ${NUDGE[dist]} วินาที`}>
                  +{NUDGE[dist]}″
                </button>
              </div>
              <span className="avg">
                เฉลี่ย <b>{fmtPace(lastValid.current / km)}</b> /กม.
              </span>
            </motion.div>

            {!valid && (
              <p className="warn" role="alert">
                ระยะ {RACE_LABEL[dist]} สูตรนี้แม่นยำในช่วง {fmtTime(MIN_PB)} – {fmtTime(MAX_PB)} — ตอนนี้ใช้ค่าล่าสุด{' '}
                {fmtTime(lastValid.current)}
              </p>
            )}

            <motion.p
              className="hero-copy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6, ease }}
            >
              วันอีซี่ควรช้าแค่ไหน วันเทมโปต้องเร็วเท่าไหร่ — ใส่เวลาจริงที่เคยทำได้ แล้วเราคำนวณโซนเพซด้วยสูตร VDOT
              พร้อมวางตารางซ้อมไปจนถึงวันแข่ง
            </motion.p>

            <div className="presets">
              <span>ลองใส่</span>
              {PRESETS[dist].map((t) => (
                <button key={t} type="button" className={t === pb ? 'is-active' : ''} onClick={() => setPb(t)}>
                  {fmtTime(t)}
                </button>
              ))}
            </div>
          </div>

          <Track zones={zones} vdot={vdot} level={levelOf(vdot)} />
        </section>

        <div className="ticker" aria-hidden>
          <div className="ticker-run">
            {[0, 1].map((copy) => (
              <span key={copy}>
                {zones.map((z) => (
                  <span key={z.key} className="ticker-item" data-tone={z.key}>
                    <b>{z.key}</b> {z.name} {fmtPace(z.fast)}–{fmtPace(z.slow)}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        <Section id="zones" n="01" title="โซนเพซสำหรับซ้อม" sub="ช่วงเพซที่ควรใช้ในแต่ละประเภทการซ้อม ยิ่งเลนในยิ่งเร็ว ยิ่งต้องพักนาน">
          <ZoneTable zones={zones} />
        </Section>

        <Section id="races" n="02" title="เวลาที่น่าจะทำได้" sub="คาดการณ์จากความฟิตปัจจุบัน — สำหรับระยะยาว ต้องมีการซ้อมระยะไกลรองรับด้วย">
          <Predictions vdot={vdot} yours={dist} />
        </Section>

        <Section id="plan" n="03" title="ตารางซ้อมของคุณ" sub="ฐาน → เพิ่มความหนัก → พีค → ลดโหลด มีสัปดาห์พักฟื้นทุก 4 สัปดาห์ แตะสัปดาห์เพื่อดูรายละเอียด">
          <PlanBuilder vdot={vdot} settings={plan} onChange={setPlan} />
        </Section>

        <Section id="trophies" n="04" title="ตู้ถ้วยรางวัล" sub="บันทึกทุกสนามที่เคยแข่ง ระบบหา PB ของแต่ละระยะให้เอง และกด “ใช้คำนวณเพซ” เพื่อตั้งค่าจากผลแข่งล่าสุดได้">
          <TrophyCase onUseVdot={applyRaceFitness} />
        </Section>

        <Section
          id="donate"
          n="05"
          title="จุดให้น้ำ"
          sub="TAYAN ใช้ฟรี ไม่มีโฆษณา ไม่เก็บข้อมูลของคุณ ถ้าช่วยให้ซ้อมได้ดีขึ้น แวะเติมน้ำให้คนทำสักแก้วก็ได้"
        >
          <Donate />
        </Section>
      </main>

      <footer className="footer">
        <p>
          คำนวณจากโมเดล VDOT ของ Jack Daniels &amp; Jimmy Gilbert — เป็นแนวทาง ไม่ใช่กฎตายตัว อากาศร้อนชื้นแบบบ้านเรา
          เพซช้าลง 10–20 วิ/กม. ถือว่าปกติ
        </p>
        <span className="mono-label">tayan · ซ้อมให้ถูกเพซ แล้วทะยานไปข้างหน้า</span>
      </footer>
    </>
  )
}

function Section({
  id,
  n,
  title,
  sub,
  children,
}: {
  id: string
  n: string
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="section">
      <motion.header
        className="section-head"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease }}
      >
        <span className="section-n">{n}</span>
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
      </motion.header>
      {children}
    </section>
  )
}
