import { useState } from 'react';
import { useT } from '../i18n.js';

const COLORS = ['#b76e79', '#963f55', '#e3a3ac', '#75666b', '#d98a96', '#5e2b3a'];
export const chartColor = (i) => COLORS[i % COLORS.length];
const compact = (n) => (n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n >= 1000 ? (n / 1000).toFixed(0) + 'k' : String(n));

// Grouped / stacked bar chart. series: [{ key, label, color }]
export function BarChart({ data, series, xKey = 'label', height = 240, stacked = false, format = compact }) {
  const { t } = useT();
  const [hover, setHover] = useState(null);
  const w = 560, h = height, pad = { l: 44, r: 12, t: 12, b: 28 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const totals = data.map((d) => (stacked ? series.reduce((s, x) => s + (d[x.key] || 0), 0) : Math.max(...series.map((x) => d[x.key] || 0))));
  const max = Math.max(1, ...totals) * 1.12;
  const step = iw / data.length;
  const bw = Math.min(34, (step * 0.7) / (stacked ? 1 : series.length));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('Bar chart')}>
        {ticks.map((t) => {
          const y = pad.t + ih - ih * t;
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} className="grid-line" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="axis-text">{format(Math.round(max * t))}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = pad.l + step * i + step / 2;
          let acc = 0;
          return (
            <g key={d[xKey]} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + step * i} y={pad.t} width={step} height={ih} fill="transparent" />
              {series.map((s, si) => {
                const v = d[s.key] || 0;
                const bh = (v / max) * ih;
                const x = stacked ? cx - bw / 2 : cx - (bw * series.length) / 2 + si * bw;
                const y = stacked ? pad.t + ih - acc - bh : pad.t + ih - bh;
                acc += bh;
                return <rect key={s.key} x={x} y={y} width={bw - 2} height={Math.max(bh, 0)} rx="4" fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />;
              })}
              <text x={cx} y={h - 8} textAnchor="middle" className="axis-text">{t(String(d[xKey]))}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tip">
          <strong>{t(String(data[hover][xKey]))}</strong>
          {series.map((s) => (
            <span key={s.key}><i style={{ background: s.color }} />{t(s.label)}: {Number(data[hover][s.key] || 0).toLocaleString('en-IN')}</span>
          ))}
        </div>
      )}
      <div className="legend">
        {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{t(s.label)}</span>)}
      </div>
    </div>
  );
}

// Smooth area/line chart for revenue trends.
export function AreaChart({ data, valueKey, xKey = 'label', height = 240, color = '#b76e79', format = compact }) {
  const { t } = useT();
  const [hover, setHover] = useState(null);
  const w = 560, h = height, pad = { l: 44, r: 14, t: 14, b: 28 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d[valueKey])) * 1.15;
  const pts = data.map((d, i) => [pad.l + (iw * i) / Math.max(1, data.length - 1), pad.t + ih - (d[valueKey] / max) * ih]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `${line} L${pts[pts.length - 1][0]} ${pad.t + ih} L${pts[0][0]} ${pad.t + ih} Z`;
  const gid = 'grad-' + valueKey;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('Trend chart')}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.t + ih - ih * t;
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} className="grid-line" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="axis-text">{format(Math.round(max * t))}</text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={p[0]} cy={p[1]} r="14" fill="transparent" />
            <circle cx={p[0]} cy={p[1]} r={hover === i ? 6 : 4} fill="#ffffff" stroke={color} strokeWidth="2.5" />
            <text x={p[0]} y={h - 8} textAnchor="middle" className="axis-text">{t(String(data[i][xKey]))}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tip">
          <strong>{t(String(data[hover][xKey]))}</strong>
          <span>{Number(data[hover][valueKey]).toLocaleString('en-IN')}</span>
        </div>
      )}
    </div>
  );
}

// Donut chart. data: [{ label, value, color? }]
export function Donut({ data, size = 170, centerLabel, centerValue }) {
  const { t } = useT();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 62, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 170 170" role="img" aria-label={t('Distribution chart')}>
        <circle cx="85" cy="85" r={r} fill="none" stroke="#f5e2e6" strokeWidth="22" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = (
            <circle key={d.label} cx="85" cy="85" r={r} fill="none" stroke={d.color || chartColor(i)} strokeWidth="22"
              strokeDasharray={`${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`} strokeDashoffset={-offset}
              transform="rotate(-90 85 85)" />
          );
          offset += len;
          return el;
        })}
        <text x="85" y="82" textAnchor="middle" className="donut-value">{centerValue ?? total}</text>
        <text x="85" y="102" textAnchor="middle" className="axis-text">{t(centerLabel || 'Total')}</text>
      </svg>
      <ul className="donut-legend">
        {data.map((d, i) => (
          <li key={d.label}><i style={{ background: d.color || chartColor(i) }} />{t(d.label)}<strong>{d.value}</strong></li>
        ))}
      </ul>
    </div>
  );
}

// Horizontal bars for ranked lists.
export function HBars({ data, format = (n) => n.toLocaleString('en-IN') }) {
  const { t } = useT();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="hbars">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="hbar-top"><span>{t(d.label)}</span><strong>{format(d.value)}</strong></div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: chartColor(i) }} /></div>
        </li>
      ))}
    </ul>
  );
}
