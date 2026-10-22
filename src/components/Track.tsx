import { useEffect, useLayoutEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { zoneMid, type Zone } from '../lib/vdot'
import { Roll } from './Roll'

// inner lane → outer lane
const ORDER = ['R', 'I', 'T', 'M', 'E'] as const
const CX = 280
const CY = 165
const STRAIGHT = 230
const INNER = 62
const LANE = 18
const SPEEDUP = 10

const laneR = (k: number) => INNER + LANE / 2 + k * LANE

// starts at the bottom-left of the home straight and runs counter-clockwise like a real track
function stadium(r: number) {
  const x1 = CX - STRAIGHT / 2
  const x2 = CX + STRAIGHT / 2
  return `M ${x1} ${CY + r} H ${x2} A ${r} ${r} 0 0 0 ${x2} ${CY - r} H ${x1} A ${r} ${r} 0 0 0 ${x1} ${CY + r} Z`
}

const TAIL = 46

export function Track({ zones, vdot, level }: { zones: Zone[]; vdot: number; level: string }) {
  const lanes = useRef<(SVGPathElement | null)[]>([])
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const tails = useRef<(SVGPathElement | null)[]>([])
  const lengths = useRef<number[]>([])
  const laps = useRef<number[]>([])

  // seconds per (scaled) 400 m lap for each lane
  laps.current = ORDER.map((key) => {
    const z = zones.find((x) => x.key === key)!
    return (zoneMid(z) * 0.4) / SPEEDUP
  })

  useLayoutEffect(() => {
    lengths.current = lanes.current.map((p) => p?.getTotalLength() ?? 1)
  }, [])

  useEffect(() => {
    const progress = ORDER.map(() => 0)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const paint = () => {
      ORDER.forEach((_, k) => {
        const path = lanes.current[k]
        const dot = dots.current[k]
        const tail = tails.current[k]
        if (!path || !dot || !tail) return
        const len = lengths.current[k]
        const pos = progress[k] * len
        const pt = path.getPointAtLength(pos)
        dot.setAttribute('cx', String(pt.x))
        dot.setAttribute('cy', String(pt.y))
        tail.style.strokeDasharray = `${TAIL} ${len}`
        tail.style.strokeDashoffset = String(TAIL - pos)
      })
    }

    if (reduce) {
      ORDER.forEach((_, k) => (progress[k] = 0.08 + k * 0.05))
      paint()
      return
    }

    let raf = 0
    let last = performance.now()
    // let the lane lines draw in before the runners go
    const startAt = last + 900
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (now > startAt) {
        ORDER.forEach((_, k) => {
          progress[k] = (progress[k] + dt / laps.current[k]) % 1
        })
      }
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const outer = INNER + LANE * ORDER.length
  const x1 = CX - STRAIGHT / 2

  return (
    <figure className="track">
      <div className="track-stage">
      <svg viewBox="0 0 560 330" role="img" aria-label="ลู่วิ่งจำลองความเร็วของแต่ละโซนเพซ">
        <motion.path
          d={stadium(outer)}
          className="track-surface"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
        <path d={stadium(INNER)} className="track-infield" />
        {Array.from({ length: ORDER.length + 1 }, (_, k) => (
          <motion.path
            key={k}
            d={stadium(INNER + k * LANE)}
            className="track-line"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, delay: 0.15 + k * 0.07, ease: [0.6, 0, 0.2, 1] }}
          />
        ))}
        <line x1={x1} x2={x1} y1={CY + INNER} y2={CY + outer} className="track-start" />
        {ORDER.map((key, k) => (
          <text key={key} x={x1 + 10} y={CY + laneR(k) + 4} className="track-lane-letter">
            {key}
          </text>
        ))}
        {ORDER.map((key, k) => (
          <path key={key} ref={(el) => (lanes.current[k] = el)} d={stadium(laneR(k))} fill="none" stroke="none" />
        ))}
        {ORDER.map((key, k) => (
          <path key={key} ref={(el) => (tails.current[k] = el)} d={stadium(laneR(k))} className="track-tail" />
        ))}
        {ORDER.map((key, k) => (
          <circle key={key} ref={(el) => (dots.current[k] = el)} r={5.5} className="track-runner" cx={x1} cy={CY + laneR(k)} />
        ))}
      </svg>
      <div className="track-center">
        <span className="mono-label">VDOT</span>
        <Roll value={vdot.toFixed(1)} className="track-vdot" />
        <span className="track-level">{level}</span>
      </div>
      </div>
      <figcaption>
        จำลองความเร็วจริง ×{SPEEDUP} — แต่ละเลนคือหนึ่งโซนเพซ จาก E (อีซี่) ด้านนอก ถึง R (สปีด) ด้านใน
      </figcaption>
    </figure>
  )
}
