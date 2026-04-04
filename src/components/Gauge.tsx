"use client";
import { fmt } from "@/lib/formatters";
import { statusColor, statusLabel } from "@/lib/formatters";

interface GaugeProps {
  label: string;
  current: number;
  quota: number;
  hitDate: string;
}

export default function Gauge({ label, current, quota, hitDate }: GaugeProps) {
  const pct = Math.min((current / quota) * 100, 100);
  const color = statusColor(pct);
  const badge = statusLabel(pct);

  const r = 58, cx = 70, cy = 68;
  const ang = Math.min(pct / 100, 1) * 180;
  const rad = (a: number) => ((a - 180) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(0));
  const y1 = cy + r * Math.sin(rad(0));
  const x2 = cx + r * Math.cos(rad(ang));
  const y2 = cy + r * Math.sin(rad(ang));

  return (
    <div className="gauge-wrap">
      <div className="gauge-header">
        <span className="gauge-label">{label}</span>
        <span
          className="badge"
          style={{ color, background: color + "14" }}
        >
          {badge}
        </span>
      </div>
      <svg viewBox="0 0 140 80" style={{ width: "100%", maxHeight: 110 }}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round"
        />
        {ang > 0 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${ang > 180 ? 1 : 0} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#000033" fontSize="20" fontWeight="700">
          {pct.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="#7778AF" fontSize="9">
          {fmt(current)} / {fmt(quota)}
        </text>
      </svg>
      {hitDate && (
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <span style={{ color: pct >= 70 ? color : "#7778AF", fontSize: 13, fontWeight: 500 }}>
            Ceiling: <strong>{hitDate}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
