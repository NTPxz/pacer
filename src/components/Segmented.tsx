import { motion } from 'framer-motion'

interface Props<T extends string | number> {
  id: string
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export function Segmented<T extends string | number>({ id, label, value, options, onChange }: Props<T>) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? 'is-active' : ''}
              onClick={() => onChange(o.value)}
            >
              {active && (
                <motion.span
                  layoutId={`seg-${id}`}
                  className="segmented-thumb"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="segmented-text">{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
