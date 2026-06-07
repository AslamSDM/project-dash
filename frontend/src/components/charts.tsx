import { useState } from 'react'

// PulseBoard — hand-built SVG charts in the paper look. No chart deps.

type Pt = { x: number; y: number }

function smoothPath(pts: Pt[]) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const cx = (p0.x + p1.x) / 2
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`
  }
  return d
}

// Revenue area chart -------------------------------------------------------
export function AreaChart({ data, color = 'var(--amber)' }: { data: { m: string; v: number }[]; color?: string }) {
  const W = 720
  const H = 240
  const padX = 16
  const padTop = 24
  const padBot = 40
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2)
    return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Not enough data yet.</div>
  const max = Math.max(...data.map((d) => d.v)) * 1.12 || 1
  const innerW = W - padX * 2
  const innerH = H - padTop - padBot
  const pts = data.map((d, i) => ({
    x: padX + (innerW * i) / (data.length - 1),
    y: padTop + innerH * (1 - d.v / max),
    ...d,
  }))
  const line = smoothPath(pts)
  const area = `${line} L ${pts[pts.length - 1].x} ${padTop + innerH} L ${pts[0].x} ${padTop + innerH} Z`
  const gridYs = [0, 0.5, 1].map((t) => padTop + innerH * t)

  return (
    <svg className="pb-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {gridYs.map((y, i) => (
        <line key={i} x1={padX} y1={y} x2={W - padX} y2={y} stroke="var(--hairline)" strokeWidth="1" strokeDasharray={i === 2 ? '0' : '3 5'} />
      ))}
      <path className="pb-area-fill" d={area} fill="url(#areaFill)" />
      <path className="pb-area-line" d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          {hover === i && <line x1={p.x} y1={padTop} x2={p.x} y2={padTop + innerH} stroke="var(--amber)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />}
          <circle cx={p.x} cy={p.y} r={hover === i ? 5.5 : 0} fill="var(--paper)" stroke={color} strokeWidth="2.5" />
          <rect x={p.x - innerW / (data.length - 1) / 2} y={padTop} width={innerW / (data.length - 1)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
          <text x={p.x} y={H - 14} textAnchor="middle" className="pb-chart-x">{p.m}</text>
        </g>
      ))}
      {hover != null && (
        <g transform={`translate(${Math.min(Math.max(pts[hover].x, 56), W - 56)}, ${Math.max(pts[hover].y - 16, 30)})`}>
          <rect x="-50" y="-34" width="100" height="30" rx="9" fill="var(--ink)" />
          <text x="0" y="-13" textAnchor="middle" className="pb-tip-text">${(pts[hover].v / 1000).toFixed(1)}k · {pts[hover].m}</text>
        </g>
      )}
    </svg>
  )
}

// Status donut -------------------------------------------------------------
export function Donut({
  segments,
  size = 184,
  stroke = 26,
}: {
  segments: { value: number; color: string }[]
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  // Precompute each arc's length and running offset (no mutation during render).
  const arcs = segments.reduce<{ seg: (typeof segments)[number]; len: number; offset: number }[]>((acc, seg) => {
    const len = (seg.value / total) * C
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0
    acc.push({ seg, len, offset })
    return acc
  }, [])
  return (
    <div className="pb-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pb-donut">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={stroke} />
        {arcs.map(({ seg, len, offset }, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(len - 4, 0)} ${C}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray .7s var(--ease)' }}
          />
        ))}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="pb-donut-num">{total}</text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="pb-donut-label">projects</text>
      </svg>
    </div>
  )
}

// Weekly hours bars --------------------------------------------------------
export function BarChart({
  data,
  color = 'var(--amber)',
  goal,
}: {
  data: { d: string; h: number }[]
  color?: string
  goal?: number
}) {
  const W = 560
  const H = 220
  const padBot = 34
  const padTop = 18
  const padX = 10
  const max = (Math.max(...data.map((d) => d.h), goal || 0) || 1) * 1.15
  const innerH = H - padBot - padTop
  const bw = (W - padX * 2) / (data.length || 1)
  const [hover, setHover] = useState<number | null>(null)
  return (
    <svg className="pb-chart" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)}>
      {goal != null && (
        <line x1={padX} x2={W - padX} y1={padTop + innerH * (1 - goal / max)} y2={padTop + innerH * (1 - goal / max)} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="4 5" />
      )}
      {data.map((d, i) => {
        const h = innerH * (d.h / max)
        const x = padX + bw * i + bw * 0.22
        const w = bw * 0.56
        const y = padTop + innerH - h
        const on = hover === i
        return (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={padX + bw * i} y={padTop} width={bw} height={innerH} fill="transparent" />
            <rect x={x} y={padTop} width={w} height={innerH} rx="7" fill="var(--paper-3)" opacity="0.55" />
            <rect className="pb-bar" x={x} y={y} width={w} height={Math.max(h, d.h > 0 ? 4 : 0)} rx="7" fill={on ? 'var(--amber-deep)' : color} />
            <text x={x + w / 2} y={H - 12} textAnchor="middle" className="pb-chart-x">{d.d}</text>
            {on && d.h > 0 && <text x={x + w / 2} y={y - 9} textAnchor="middle" className="pb-bar-val">{d.h}h</text>}
          </g>
        )
      })}
    </svg>
  )
}
