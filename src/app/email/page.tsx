"use client";
import { useState, useEffect } from "react";
import { loadDashboardData } from "@/lib/data";
import { fmt } from "@/lib/formatters";
import { CURRENT_CONTRACT } from "@/lib/contracts";
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

  const reportDate = new Date(latest.date);
  const dateStr = reportDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const totalEngagement = latest.activeBoth + latest.recordsNoSearch + latest.searchNoRecords + latest.zombie;

  return (
    <div style={{
      fontFamily: "'Sora', -apple-system, sans-serif",
      background: "#ffffff",
      color: "#111827",
      maxWidth: 420,
      margin: "0 auto",
      padding: "20px 16px",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9698C3", textTransform: "uppercase", letterSpacing: 1.5 }}>Adobe × Algolia Usage Report</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#000033", marginTop: 4 }}>Data as of {dateStr}</div>
        <div style={{ fontSize: 12, color: "#7778AF", marginTop: 2 }}>{C.soNumber} · Billing period Feb 2024 – Jan 2027</div>
      </div>

      {/* Alert */}
      {(apps / C.appsQuota * 100) >= 85 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>
            {apps.toLocaleString()} of {C.appsQuota.toLocaleString()} apps used
          </div>
          <div style={{ fontSize: 13, color: "#484C7A", marginTop: 2 }}>App quota at {(apps / C.appsQuota * 100).toFixed(1)}% — approaching ceiling</div>
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

      {/* Key Metrics */}
      <div style={{ background: "#f8f9fb", borderRadius: 8, padding: "14px", marginBottom: 20 }}>
        <StatBlock label="Top App Share" value={latest.records > 0 ? ((data.topByRecords[0]?.records ?? 0) / latest.records * 100).toFixed(1) + "%" : "—"} color="#d97706" />
        <StatBlock label="Empty Index Apps" value={latest.searchNoRecords.toLocaleString()} color="#dc2626" />
        <StatBlock label="Zombie Apps" value={latest.zombie.toLocaleString()} color="#dc2626" />
        <StatBlock label="Concentration" value={latest.c10r + "%"} sub="top 10 share" />
      </div>

      {/* Dashboard Link */}
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <a href="https://oem-usage-dashboard.vercel.app"
          style={{ display: "inline-block", background: "#003DFF", color: "#fff", padding: "12px 28px", borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Open Live Dashboard →
        </a>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 11, color: "#9698C3", paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
        Adobe OEM Analytics · Algolia Strategic Partnerships
      </div>
    </div>
  );
}
