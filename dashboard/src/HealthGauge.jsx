import { useMemo } from 'react';

const SIZE = 200;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = Math.PI * R;

function getColor(value) {
  if (value > 70) return '#4ade80';
  if (value > 40) return '#f59e0b';
  return '#ef4444';
}

export default function HealthGauge({ value = 100 }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = getColor(clamped);
  const fillLength = useMemo(() => (clamped / 100) * CIRCUMFERENCE, [clamped]);
  const gapLength = CIRCUMFERENCE - fillLength;

  return (
    <div className="gauge-wrap">
      <svg
        className="gauge-svg"
        width={SIZE} height={SIZE / 2 + STROKE}
        viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE}`}
        aria-label={`Health index: ${clamped}`}
      >
        {/* Track */}
        <path
          d={`M ${STROKE/2} ${SIZE/2} A ${R} ${R} 0 0 1 ${SIZE-STROKE/2} ${SIZE/2}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${STROKE/2} ${SIZE/2} A ${R} ${R} 0 0 1 ${SIZE-STROKE/2} ${SIZE/2}`}
          fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={`${fillLength} ${gapLength}`}
          style={{
            filter: `drop-shadow(0 0 10px ${color}99)`,
            transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease',
          }}
        />
        {/* Glow */}
        <path
          d={`M ${STROKE/2} ${SIZE/2} A ${R} ${R} 0 0 1 ${SIZE-STROKE/2} ${SIZE/2}`}
          fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={`${fillLength} ${gapLength}`} opacity={0.25}
          style={{ transition: 'stroke-dasharray 0.8s' }}
        />
      </svg>

      <div className="gauge-center">
        <div className="gauge-value" style={{ color }}>{clamped.toFixed(0)}</div>
        <div className="gauge-label">HEALTH INDEX</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: SIZE, fontSize: 10, color: 'var(--text-3)' }}>
        <span>0</span><span>50</span><span>100</span>
      </div>
    </div>
  );
}
