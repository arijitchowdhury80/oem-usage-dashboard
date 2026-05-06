"use client";
import { useState, useEffect } from "react";
import { loadDashboardData } from "@/lib/data";
import { fmt } from "@/lib/formatters";
import { CURRENT_CONTRACT } from "@/lib/contracts";
import { computeObservations, type Observation } from "@/lib/observations";
import type { DashboardData } from "@/lib/types";

const C = CURRENT_CONTRACT;

function ProgressBar({ label, current, quota, color }: { label: string; current: number; quota: number; color: string }) {
  const pct = Math.min((current / quota) * 100, 100);
  const status = pct >= 85 ? "CRITICAL" : pct >= 70 ? "WARNING" : "HEALTHY";
  const statusColor = pct >= 85 ? "#dc2626" : pct >= 70 ? "#d97706" : "#16a34a";

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#484C7A", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>{status}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "#000033", letterSpacing: -0.5 }}>{pct.toFixed(1)}%</span>
        <span style={{ fontSize: 12, color: "#7778AF" }}>{fmt(current)} of {fmt(quota)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 5, background: color }} />
      </div>
    </div>
  );
}

function StatBlock({ label, value, sub, color = "#000033" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: 13, color: "#484C7A" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
        {sub && <span style={{ fontSize: 13, color: "#7778AF", marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  );
}

function ObsRow({ o }: { o: Observation }) {
  const fg = o.kind === "decline" ? "#dc2626" : o.kind === "growth" ? "#16a34a" : o.kind === "glimmer" ? "#7c3aed" : "#6b7280";
  const bg = o.kind === "decline" ? "#fef2f2" : o.kind === "growth" ? "#f0fdf4" : o.kind === "glimmer" ? "#faf5ff" : "#f9fafb";
  const border = o.kind === "decline" ? "#fecaca" : o.kind === "growth" ? "#bbf7d0" : o.kind === "glimmer" ? "#e9d5ff" : "#e5e7eb";
  const arrow = o.deltaAbs > 0 ? "↑" : o.deltaAbs < 0 ? "↓" : "—";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: bg, border: `1px solid ${border}`, borderRadius: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: fg, width: 14, textAlign: "center" }}>{arrow}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{o.headline}</div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{o.detail}</div>
      </div>
    </div>
  );
}

function EngagementRow({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 15, color: "#36395A", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#000033" }}>{count.toLocaleString()}</span>
      <span style={{ fontSize: 13, color: "#7778AF", width: 40, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

export default function EmailPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadDashboardData().then(setData).catch(() => {});
  }, []);

  if (!data) return <div style={{ padding: 40, color: "#9ca3af" }}>Loading...</div>;

  const { latest, billing } = data;
  const prod = billing?.prod;
  const stage = billing?.staging;

  const apps = prod ? prod.period_end_live_apps : latest.apps;
  const records = prod ? prod.billable_records : latest.records;
  const searches = prod ? prod.billable_search_requests : latest.searches;

  const [y, m, d] = latest.date.split("-").map(Number);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${monthNames[m - 1]} ${d}, ${y}`;

  const totalEngagement = latest.activeBoth + latest.recordsNoSearch + latest.searchNoRecords + latest.zombie;
  const observations = computeObservations(data);

  return (
    <div style={{
      fontFamily: "'Sora', -apple-system, sans-serif",
      background: "#ffffff",
      color: "#111827",
      maxWidth: 420,
      margin: "0 auto",
      padding: "20px 16px",
    }}>
      {/* Intro */}
      <div style={{ fontSize: 14, color: "#23263B", lineHeight: 1.6, marginBottom: 18 }}>
        Hello everyone,<br /><br />
        Below is the Adobe&lt;&gt;Algolia usage summary as of {dateStr}.
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9698C3", textTransform: "uppercase", letterSpacing: 1.5 }}>Adobe × Algolia Usage Report</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#000033", marginTop: 4 }}>Data as of {dateStr}</div>
        <div style={{ fontSize: 12, color: "#7778AF", marginTop: 2 }}>{C.soNumber} · Billing period Feb 2024 – Jan 2027</div>
      </div>

      {/* Observations — MoM */}
      {observations.framing && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#484C7A", textTransform: "uppercase", letterSpacing: 1.2 }}>Observations · MoM</span>
            <span style={{ fontSize: 10, color: observations.framing.inProgress ? "#d97706" : "#7778AF", fontWeight: observations.framing.inProgress ? 600 : 400 }}>
              {observations.framing.label}
            </span>
          </div>
          {observations.headlines.map((o) => <ObsRow key={o.metric} o={o} />)}
          {observations.concerns.map((o, i) => <ObsRow key={`c-${i}`} o={o} />)}
          {observations.glimmers.length > 0 && (
            <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 6, padding: "10px 12px", marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>✦ Glimmers</div>
              {observations.glimmers.map((g, i) => (
                <div key={i} style={{ marginBottom: i === observations.glimmers.length - 1 ? 0 : 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>• {g.headline}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginLeft: 10, marginTop: 1 }}>{g.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quota Progress Bars */}
      <div style={{ background: "#f8f9fb", borderRadius: 8, padding: "16px 14px", marginBottom: 20 }}>
        <ProgressBar label="Applications" current={apps} quota={C.appsQuota} color="#dc2626" />
        <ProgressBar label="Records" current={records} quota={C.recordsQuota} color="#d97706" />
        <ProgressBar label="Searches" current={searches} quota={C.searchesQuota} color="#16a34a" />
      </div>

      {/* Production */}
      {prod && (
        <div style={{ background: "#003DFF08", borderRadius: 8, padding: "14px", marginBottom: 12, borderLeft: "3px solid #003DFF" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003DFF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Production
            <span style={{ fontWeight: 400, color: "#7778AF", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>{prod.parent_id}</span>
          </div>
          <StatBlock label="Live Apps" value={prod.period_end_live_apps.toLocaleString()} />
          <StatBlock label="Records" value={fmt(prod.billable_records)} />
          <StatBlock label="Searches" value={fmt(prod.billable_search_requests)} />
          <StatBlock label="Retention" value={prod.provisioned_apps > 0 ? (100 - prod.deleted_in_period_apps / prod.provisioned_apps * 100).toFixed(0) + "%" : "—"} color="#16a34a" />
        </div>
      )}

      {/* Staging */}
      {stage && (
        <div style={{ background: "#d9770608", borderRadius: 8, padding: "14px", marginBottom: 20, borderLeft: "3px solid #d97706" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Staging
            <span style={{ fontWeight: 400, color: "#7778AF", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>{stage.parent_id}</span>
          </div>
          <StatBlock label="Live Apps" value={stage.period_end_live_apps.toLocaleString()} />
          <StatBlock label="Records" value={fmt(stage.billable_records)} />
          <StatBlock label="Searches" value={fmt(stage.billable_search_requests)} sub="⚠" color="#d97706" />
          <StatBlock label="Churn" value={stage.provisioned_apps > 0 ? (stage.deleted_in_period_apps / stage.provisioned_apps * 100).toFixed(0) + "%" : "—"} color="#dc2626" />
        </div>
      )}

      {/* Engagement */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#484C7A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>App Health</div>
        <EngagementRow color="#16a34a" label="Active" count={latest.activeBoth} total={totalEngagement} />
        <EngagementRow color="#d97706" label="Records only" count={latest.recordsNoSearch} total={totalEngagement} />
        <EngagementRow color="#8b5cf6" label="Search only" count={latest.searchNoRecords} total={totalEngagement} />
        <EngagementRow color="#dc2626" label="Zombie" count={latest.zombie} total={totalEngagement} />
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 11, color: "#9698C3", paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
        Adobe OEM Analytics · Algolia Strategic Partnerships
      </div>

      {/* Closing */}
      <div style={{ fontSize: 14, color: "#23263B", lineHeight: 1.6, marginTop: 18 }}>
        Detailed reports are attached.<br /><br />
        Arijit
      </div>
    </div>
  );
}
