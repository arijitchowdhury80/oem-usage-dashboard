export function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

export function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

export function fmtMoney(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

export function statusColor(pct: number): string {
  if (pct >= 85) return "#dc2626";
  if (pct >= 70) return "#d97706";
  return "#16a34a";
}

export function statusLabel(pct: number): string {
  if (pct >= 85) return "CRITICAL";
  if (pct >= 70) return "WARNING";
  return "HEALTHY";
}

export function statusBg(pct: number): string {
  if (pct >= 85) return "#dc262614";
  if (pct >= 70) return "#d9770614";
  return "#16a34a14";
}
