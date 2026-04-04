"use client";

interface MiniBarProps {
  value: number;
  max: number;
  color?: string;
}

export default function MiniBar({ value, max, color = "#3b82f6" }: MiniBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="minibar">
      <div className="minibar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
