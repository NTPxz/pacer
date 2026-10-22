import { FEELING_LABEL, type Feeling } from '../lib/training-log'

const LEVELS: Feeling[] = [1, 2, 3, 4, 5]

/** "how's your battery today" picker — five cells, no emoji */
export function Battery({ value, onChange }: { value?: Feeling; onChange: (f: Feeling) => void }) {
  return (
    <div className="battery" role="radiogroup" aria-label="ความพร้อมวันนี้">
      {LEVELS.map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={value === f}
          className={value === f ? 'is-active' : ''}
          data-level={f}
          onClick={() => onChange(f)}
        >
          <span className="battery-icon" aria-hidden>
            {LEVELS.map((c) => (
              <i key={c} className={c <= f ? 'on' : ''} />
            ))}
          </span>
          <span className="battery-label">{FEELING_LABEL[f]}</span>
        </button>
      ))}
    </div>
  )
}
