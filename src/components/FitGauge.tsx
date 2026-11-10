import type { CSSProperties } from 'react';

interface FitGaugeProps {
  value: number;
  initialValue?: number;
  size?: number;
}

function colorFor(value: number): string {
  if (value >= 75) return '#2563eb'; // Blue/indigo for initial good scores
  if (value >= 50) return '#eab308'; // Amber/gold
  return '#ef4444'; // Red
}

export default function FitGauge({ value, initialValue, size = 52 }: FitGaugeProps) {
  const clampedVal = Math.max(0, Math.min(100, Math.round(value)));
  const clampedInitial = initialValue !== undefined ? Math.max(0, Math.min(100, Math.round(initialValue))) : undefined;

  let gaugeBg = '';
  if (clampedInitial !== undefined && clampedInitial !== clampedVal) {
    if (clampedVal > clampedInitial) {
      // Gained score: initial score path in initial color, gained path in green (#10b981)
      const initialColor = colorFor(clampedInitial);
      gaugeBg = `conic-gradient(${initialColor} 0% ${clampedInitial}%, #10b981 ${clampedInitial}% ${clampedVal}%, var(--ink-700) ${clampedVal}% 100%)`;
    } else {
      // Lost score: new lower score path in colorFor(clampedVal), lost path in red (#ef4444)
      const newColor = colorFor(clampedVal);
      gaugeBg = `conic-gradient(${newColor} 0% ${clampedVal}%, #ef4444 ${clampedVal}% ${clampedInitial}%, var(--ink-700) ${clampedInitial}% 100%)`;
    }
  } else {
    // Normal single-value gauge
    const color = colorFor(clampedVal);
    gaugeBg = `conic-gradient(${color} 0% ${clampedVal}%, var(--ink-700) ${clampedVal}% 100%)`;
  }

  const hasInitial = clampedInitial !== undefined;
  const diff = hasInitial ? clampedVal - (clampedInitial as number) : 0;
  const isPositive = diff > 0;
  const isNegative = diff < 0;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <div
        className="fit-gauge"
        style={
          {
            width: size,
            height: size,
            '--pct': clampedVal,
            '--gauge-color': colorFor(clampedVal),
            '--gauge-bg': gaugeBg
          } as CSSProperties
        }
        role="img"
        aria-label={`Índice de ajuste: ${clampedVal} de 100`}
      >
        <span className="fit-gauge-value" style={{ fontSize: size * 0.28 }}>
          {clampedVal}%
        </span>
      </div>

      {hasInitial && Math.abs(diff) > 0 && Math.abs(diff) <= 20 && (
        <span
          style={{
            marginTop: 4,
            fontSize: Math.max(9.5, size * 0.18),
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: 6,
            backgroundColor: isPositive ? '#dcfce7' : isNegative ? '#fee2e2' : '#f1f5f9',
            color: isPositive ? '#15803d' : isNegative ? '#b91c1c' : '#475569',
            border: `1px solid ${isPositive ? '#86efac' : isNegative ? '#fca5a5' : '#cbd5e1'}`,
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
          title={`Evaluación Precalificación: ${clampedInitial}% ➔ Evaluado tras Doble Check: ${clampedVal}%`}
        >
          {isPositive ? `↑ +${diff}%` : `↓ ${diff}%`}
        </span>
      )}
    </div>
  );
}
