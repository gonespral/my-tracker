import type { CSSProperties } from 'react'
import { fmt } from '../../lib/utils'

export default function MacroRing({ label, value, target, unit, accentColor }: { label: string; value: number; target: number; unit: string; accentColor: string }) {
  const size = 72, sw = 7, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(value / target, 1)
  const off = circ * (1 - pct)
  const cx = size / 2, cy = size / 2
  const color = value > target ? 'var(--danger)' : accentColor

  return (
    <div className="macro-ring-card">
      <div className="macro-ring-label">{label}</div>
      <div className="ring-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--track)" strokeWidth={sw} />
          <circle
            cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={circ.toFixed(2)} strokeDashoffset={off.toFixed(2)}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
            style={{ '--ring-circ': circ.toFixed(2), '--ring-off': off.toFixed(2), animation: 'ring-fill .7s cubic-bezier(.4,0,.2,1) both' } as CSSProperties}
          />
        </svg>
        <div className="ring-center">
          <div className="ring-value">{fmt(value)}</div>
          <div className="ring-unit">{unit}</div>
        </div>
      </div>
      <div className="macro-ring-target">/ {target}{unit}</div>
    </div>
  )
}
