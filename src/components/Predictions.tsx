import { motion } from 'framer-motion'
import { fmtPace, fmtTime, predictSeconds, RACE_LABEL, RACE_METERS, type RaceKey } from '../lib/vdot'
import { Roll } from './Roll'

const KEYS: RaceKey[] = ['5K', '10K', 'HM', 'M']
const BIG: Record<RaceKey, string> = { '5K': '5K', '10K': '10K', HM: '21K', M: '42K' }

export function Predictions({ vdot }: { vdot: number }) {
  return (
    <div className="races">
      {KEYS.map((k, i) => {
        const t = predictSeconds(vdot, RACE_METERS[k])
        return (
          <motion.div
            key={k}
            className={`race ${k === '10K' ? 'is-yours' : ''}`}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.08, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="race-big" aria-hidden>
              {BIG[k]}
            </span>
            <span className="race-label">
              {RACE_LABEL[k]}
              {k === '10K' && <b>PB ของคุณ</b>}
            </span>
            <Roll value={fmtTime(t)} className="race-time" />
            <span className="race-pace">
              <Roll value={fmtPace(t / (RACE_METERS[k] / 1000))} /> /กม.
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
