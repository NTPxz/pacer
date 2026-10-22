import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TimeInput } from './components/TimeInput'
import { Track } from './components/Track'
import { ZoneTable } from './components/ZoneTable'
import { Predictions } from './components/Predictions'
import { PlanBuilder, type PlanSettings } from './components/PlanBuilder'
import { fmtPace, fmtTime, vdotFrom, zonesFor } from './lib/vdot'
import { nextMonday } from './lib/plan'

const STORE = 'pacer:v1'
const MIN_PB = 26 * 60
const MAX_PB = 105 * 60
const PRESETS = [35 * 60, 42 * 60 + 30, 50 * 60, 58 * 60, 65 * 60]

interface Saved {
  pb: number
  plan: PlanSettings
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function load(): Saved {
  const fallback: Saved = {
    pb: 50 * 60,
    plan: { goal: '10K', weeks: 12, days: 4, startKm: null, startDate: iso(nextMonday(new Date())) },
  }
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Saved
    return { pb: saved.pb ?? fallback.pb, plan: { ...fallback.plan, ...saved.plan } }
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
  const [pb, setPb] = useState(initial.pb)
  const [plan, setPlan] = useState<PlanSettings>(initial.plan)
  const lastValid = useRef(initial.pb >= MIN_PB && initial.pb <= MAX_PB ? initial.pb : 50 * 60)

  const valid = pb >= MIN_PB && pb <= MAX_PB
  if (valid) lastValid.current = pb
  const vdot = vdotFrom(10000, lastValid.current)
  const zones = useMemo(() => zonesFor(vdot), [vdot])

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ pb: lastValid.current, plan }))
    } catch {
      /* storage unavailable — settings just won't persist */
    }
  }, [pb, plan])

  const nudge = (d: number) => setPb((p) => Math.min(MAX_PB, Math.max(MIN_PB, p + d)))

  return (
    <>
      <header className="topbar">
        <a href="#top" className="brand" aria-label="Pacer">
          <svg viewBox="0 0 40 22" aria-hidden>
            <rect x="1.5" y="1.5" width="37" height="19" rx="9.5" />
            <circle r="3">
              <animateMotion dur="6s" repeatCount="indefinite" path="M 12 20.5 H 28 A 9.5 9.5 0 0 0 28 1.5 H 12 A 9.5 9.5 0 0 0 12 20.5 Z" />
            </circle>
          </svg>
          pacer
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
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-input">
            <motion.p
              className="eyebrow"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
            >
              เวลา 10K ที่ดีที่สุดของคุณ
            </motion.p>
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
                <button type="button" onClick={() => nudge(-5)} aria-label="ลด 5 วินาที">
                  −5″
                </button>
                <button type="button" onClick={() => nudge(5)} aria-label="เพิ่ม 5 วินาที">
                  +5″
                </button>
              </div>
              <span className="avg">
                เฉลี่ย <b>{fmtPace(lastValid.current / 10)}</b> /กม.
              </span>
            </motion.div>

            {!valid && (
              <p className="warn" role="alert">
                สูตรนี้แม่นยำในช่วง {fmtTime(MIN_PB)} – {fmtTime(MAX_PB)} — ตอนนี้ใช้ค่าล่าสุด {fmtTime(lastValid.current)}
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
              {PRESETS.map((t) => (
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
          <Predictions vdot={vdot} />
        </Section>

        <Section id="plan" n="03" title="ตารางซ้อมของคุณ" sub="ฐาน → เพิ่มความหนัก → พีค → ลดโหลด มีสัปดาห์พักฟื้นทุก 4 สัปดาห์ แตะสัปดาห์เพื่อดูรายละเอียด">
          <PlanBuilder vdot={vdot} settings={plan} onChange={setPlan} />
        </Section>
      </main>

      <footer className="footer">
        <p>
          คำนวณจากโมเดล VDOT ของ Jack Daniels &amp; Jimmy Gilbert — เป็นแนวทาง ไม่ใช่กฎตายตัว อากาศร้อนชื้นแบบบ้านเรา
          เพซช้าลง 10–20 วิ/กม. ถือว่าปกติ
        </p>
        <span className="mono-label">pacer · ซ้อมให้ถูกเพซ</span>
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
