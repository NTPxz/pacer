import { motion } from 'framer-motion'
import { fmtPace, kmh, zoneMid, type Zone } from '../lib/vdot'
import { Roll } from './Roll'

export function ZoneTable({ zones }: { zones: Zone[] }) {
  return (
    <div className="zones" role="table" aria-label="โซนเพซ">
      <div className="zones-head" role="row">
        <span role="columnheader">เลน</span>
        <span role="columnheader">โซน</span>
        <span role="columnheader">เพซ / กม.</span>
        <span role="columnheader">ต่อ 400 ม.</span>
        <span role="columnheader">กม./ชม.</span>
      </div>
      {zones.map((z, i) => (
        <motion.div
          key={z.key}
          role="row"
          className="zone-row"
          data-zone={z.key}
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: i * 0.07, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span className="zone-lane" role="cell">
            {z.key}
          </span>
          <span className="zone-name" role="cell">
            <strong>{z.thai}</strong>
            <em>{z.name}</em>
            <small>{z.purpose}</small>
          </span>
          <span className="zone-pace" role="cell">
            <Roll value={fmtPace(z.fast)} />
            <span className="dash">–</span>
            <Roll value={fmtPace(z.slow)} />
          </span>
          <span className="zone-stat" role="cell">
            <span className="mono-label">400 ม.</span>
            <Roll value={`${Math.round(zoneMid(z) * 0.4)}″`} />
          </span>
          <span className="zone-stat" role="cell">
            <span className="mono-label">กม./ชม.</span>
            <Roll value={kmh(zoneMid(z)).toFixed(1)} />
          </span>
        </motion.div>
      ))}
    </div>
  )
}
