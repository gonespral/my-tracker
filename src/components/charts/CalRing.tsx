import type { CSSProperties } from 'react'
import { round } from '../../lib/utils'

// SVG triangle marker just outside the ring, pointing inward.
// Requires overflow="visible" on the parent SVG.
// mealFrac:    expected-cals-by-now / target (from Today tab). Can exceed 1 (overflow).
// consumedFrac: consumed / target — used to detect when user is eating ahead of pace.
function RingTick({ cx, cy, r, sw, mealFrac, consumedFrac = 0 }: { cx: number; cy: number; r: number; sw: number; mealFrac: number; consumedFrac?: number }) {
  if (mealFrac <= 0) return null
  const overflow = mealFrac >= 1
  const ahead = !overflow && consumedFrac > mealFrac
  const frac = overflow ? 0 : mealFrac
  const angle = -Math.PI / 2 + frac * 2 * Math.PI
  const dx = Math.cos(angle), dy = Math.sin(angle)
  const px = -dy, py = dx
  const gap = 4, depth = 9, half = 5
  const tipR = r + sw / 2 + gap
  const baseR = tipR + depth
  const tipX = (cx + tipR * dx).toFixed(1), tipY = (cy + tipR * dy).toFixed(1)
  const b1X = (cx + baseR * dx + half * px).toFixed(1), b1Y = (cy + baseR * dy + half * py).toFixed(1)
  const b2X = (cx + baseR * dx - half * px).toFixed(1), b2Y = (cy + baseR * dy - half * py).toFixed(1)
  const fill = overflow ? '#ef4444' : ahead ? '#f97316' : 'var(--tx2)'
  const style: CSSProperties = overflow
    ? { transformOrigin: `${cx}px ${cy}px`, animation: 'anim-pop 0.4s ease both 0.25s' }
    : ({
      transformOrigin: `${cx}px ${cy}px`,
      '--ticker-deg': `${(frac * 360).toFixed(1)}deg`,
      animation: 'ticker-rotate 0.8s cubic-bezier(0.22,1,0.36,1) both 0.25s',
    } as CSSProperties)

  return (
    <g style={style}>
      <polygon
        points={`${tipX},${tipY} ${b1X},${b1Y} ${b2X},${b2Y}`}
        fill={fill} stroke="var(--bg)" strokeWidth={1.5} strokeLinejoin="round"
      />
    </g>
  )
}

export default function CalRing({ consumed, target, burned = 0, mealFrac = 0 }: { consumed: number; target: number; burned?: number; mealFrac?: number }) {
  const effectiveTarget = target // target is pre-adjusted (goal + eatback); burned is display-only
  const size = 160, sw = 12, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(consumed / effectiveTarget, 1)
  const off = circ * (1 - pct)
  const cx = size / 2, cy = size / 2
  const rem = effectiveTarget - consumed

  // Inner ring for burned calories
  const ri = r - sw - 3, swi = 5
  const circi = 2 * Math.PI * ri
  const burnPct = burned > 0 ? Math.min(burned / effectiveTarget, 1) : 0
  const burnOff = circi * (1 - burnPct)

  return (
    <div className="ring-wrap" style={{ width: size, height: size, marginTop: 16, marginBottom: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--track)" strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent)" strokeWidth={sw}
          strokeDasharray={circ.toFixed(2)} strokeDashoffset={off.toFixed(2)}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{ '--ring-circ': circ.toFixed(2), '--ring-off': off.toFixed(2), animation: 'ring-fill .7s cubic-bezier(.4,0,.2,1) both' } as CSSProperties}
        />
        <RingTick cx={cx} cy={cy} r={r} sw={sw} mealFrac={mealFrac} consumedFrac={consumed / effectiveTarget} />
        {burned > 0 && (
          <>
            <circle cx={cx} cy={cy} r={ri} fill="none" stroke="var(--track)" strokeWidth={swi} opacity={0.7} />
            <circle
              cx={cx} cy={cy} r={ri} fill="none" stroke="#f97316" strokeWidth={swi}
              strokeDasharray={circi.toFixed(2)} strokeDashoffset={burnOff.toFixed(2)}
              strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
              style={{ '--ring-circ': circi.toFixed(2), '--ring-off': burnOff.toFixed(2), animation: 'ring-fill .7s cubic-bezier(.4,0,.2,1) .1s both' } as CSSProperties}
            />
          </>
        )}
      </svg>
      <div className="ring-center">
        <div className="ring-big-num">{round(consumed).toLocaleString()}</div>
        <div className="ring-unit">kcal</div>
        <div className={`ring-remaining ${consumed > effectiveTarget ? 'over' : ''}`}>
          {rem >= 0 ? `${round(rem).toLocaleString()} left` : `${round(-rem).toLocaleString()} over`}
        </div>
        {burned > 0 && (
          <div className="ring-burned">
            <span className="material-symbols-outlined ring-burn-icon">local_fire_department</span> +{round(burned)}
          </div>
        )}
      </div>
    </div>
  )
}
