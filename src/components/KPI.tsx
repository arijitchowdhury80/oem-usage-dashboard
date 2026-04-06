"use client";

interface KPIProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  sparkline?: number[];
  sparkColor?: string;
}

function Sparkline({ data, color = "#003DFF", width = 80, height = 24 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  // Fill area
  const firstX = pad;
  const lastX = pad + ((data.length - 1) / (data.length - 1)) * (width - pad * 2);
  const fillPoints = `${firstX},${height} ${points} ${lastX},${height}`;

  return (
    <svg width={width} height={height} style={{ display: "block", marginTop: 6 }}>
      <polygon points={fillPoints} fill={color} opacity={0.08} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot on last point */}
      <circle cx={parseFloat(points.split(" ").pop()!.split(",")[0])} cy={parseFloat(points.split(" ").pop()!.split(",")[1])} r={2.5} fill={color} />
    </svg>
  );
}

export default function KPI({ label, value, sub, color = "#000033", sparkline, sparkColor }: KPIProps) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div className="kpi-value" style={{ color, fontSize: 32, fontWeight: 600, letterSpacing: -1.5 }}>{value}</div>
        {sparkline && <Sparkline data={sparkline} color={sparkColor ?? color} />}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
