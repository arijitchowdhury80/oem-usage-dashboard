"use client";

interface KPIProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export default function KPI({ label, value, sub, color = "#111827" }: KPIProps) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
