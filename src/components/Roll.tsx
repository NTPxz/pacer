import { AnimatePresence, motion } from 'framer-motion'

/** Odometer-style text: each changed character rolls in from below. */
export function Roll({ value, className = '' }: { value: string; className?: string }) {
  const chars = value.split('')
  return (
    <span className={`roll ${className}`} aria-label={value} role="text">
      {chars.map((ch, i) => (
        // key by distance from the right so digits stay in their column when length changes
        <span className="roll-slot" key={chars.length - i} aria-hidden>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={ch}
              initial={{ y: '90%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: '-90%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32, delay: i * 0.025 }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
