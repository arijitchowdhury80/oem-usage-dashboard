"use client";
import { useState, useMemo, useEffect } from "react";
import {
  Area, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, ReferenceLine,
} from "recharts";
import { CURRENT_CONTRACT } from "@/lib/contracts";
import { loadDashboardData } from "@/lib/data";
import { fmt } from "@/lib/formatters";
import type { DashboardData, WeekPoint, MonthPoint, AppDetailWithDelta } from "@/lib/types";
import Gauge from "./Gauge";
import KPI from "./KPI";
import ChartTooltip from "./ChartTooltip";
import MiniBar from "./MiniBar";
import RDBrief from "./RDBrief";

const CONTRACT = CURRENT_CONTRACT;

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadButton({ onClick, label = "CSV" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, color: "#003DFF", background: "none", border: "1px solid #003DFF",
      borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontWeight: 500,
      fontFamily: "'Sora', sans-serif",
    }}>{label}</button>
  );
}

function hitDate(runway: number, baseDate: string = "2026-03-24"): string {
  if (runway > 20) return "Not projected";
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + Math.ceil(runway));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ═══════ ENGAGEMENT PANEL — Interactive donut with app list overlay ═══════
function EngagementPanel({ appDetail, chartData, latest }: {
  appDetail: AppDetailWithDelta[];
  chartData: Array<{ m: string } & WeekPoint>;
  latest: WeekPoint;
}) {
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const categories = [
    { key: "active", color: "#16a34a", label: "Active", count: latest.activeBoth, desc: "Records and searches. Working as intended.", dataKey: "activeBoth" },
    { key: "records_only", color: "#d97706", label: "Records only", count: latest.recordsNoSearch, desc: "Content loaded, no one is searching.", dataKey: "recordsNoSearch" },
    { key: "search_only", color: "#8b5cf6", label: "Search only", count: latest.searchNoRecords, desc: "Searches firing, no content indexed.", dataKey: "searchNoRecords" },
    { key: "zombie", color: "#dc2626", label: "Zombie", count: latest.zombie, desc: "Created but never used. Zero activity.", dataKey: "zombie" },
  ];

  const downloadCSV = (statusKey: string, label: string) => {
    const apps = appDetail.filter(a => a.status === statusKey);
    const header = "app_id,name,tag,records,searches,created\n";
    const rows = apps.map(a => `${a.id},${a.name},${a.tag ?? a.env},${a.records},${a.searches},${a.created}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label.toLowerCase().replace(/\s/g, "_")}_apps.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sec">
      <div className="sec-t">Engagement Health</div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="engage-panel">
          <div className="engage-left">
            <div className="chart-title">Trend Over Time</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="m" tick={{ fill: "#9ca3af", fontSize: 11 }} interval={2} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                {categories.map(cat => (
                  <Line key={cat.key} dataKey={cat.dataKey} stroke={cat.color}
                    strokeWidth={hoveredStatus === cat.key ? 3 : 2}
                    strokeOpacity={hoveredStatus && hoveredStatus !== cat.key ? 0.2 : 1}
                    dot={false} name={cat.label} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="engage-right">
            <div className="chart-title" style={{ textAlign: "center" }}>Current Snapshot</div>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={categories.map(c => ({ name: c.label, value: c.count, fill: c.color }))}
                  cx="50%" cy="50%" innerRadius={36} outerRadius={55} dataKey="value" strokeWidth={0}
                  onClick={(_, index) => {
                    const key = categories[index].key;
                    setExpandedStatus(expandedStatus === key ? null : key);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {categories.map((c, i) => (
                    <Cell key={i} fill={c.color}
                      opacity={hoveredStatus && hoveredStatus !== c.key ? 0.3 : 1}
                      stroke={expandedStatus === c.key ? c.color : "none"}
                      strokeWidth={expandedStatus === c.key ? 3 : 0}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 10 }}>
              {categories.map((cat) => (
                <div key={cat.key}
                  style={{ cursor: "pointer", borderRadius: 4, padding: "2px 0", transition: "background 0.15s",
                    background: expandedStatus === cat.key ? cat.color + "0A" : "transparent" }}
                  onMouseEnter={() => setHoveredStatus(cat.key)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onClick={() => setExpandedStatus(expandedStatus === cat.key ? null : cat.key)}
                >
                  <div className="engage-legend" style={{ marginBottom: 4 }}>
                    <div className="engage-dot" style={{ background: cat.color }} />
                    <div style={{ flex: 1 }}>
                      <div className="engage-leg-title" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{cat.label} ({cat.count})</span>
                        <span style={{ fontSize: 11, color: "#9698C3" }}>{expandedStatus === cat.key ? "▼" : "▶"}</span>
                      </div>
                      <div className="engage-leg-desc">{cat.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expanded app list overlay */}
        {expandedStatus && (() => {
          const cat = categories.find(c => c.key === expandedStatus)!;
          const apps = appDetail.filter(a => a.status === expandedStatus).sort((a, b) => b.records - a.records);
          return (
            <div style={{ borderTop: `2px solid ${cat.color}`, padding: "16px 20px", background: cat.color + "05", maxHeight: 400, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#23263B" }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: cat.color, marginRight: 8 }} />
                  {cat.label} — {apps.length} apps
                </div>
                <button onClick={() => downloadCSV(expandedStatus, cat.label)}
                  style={{ fontSize: 12, color: "#003DFF", background: "none", border: "1px solid #003DFF", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontWeight: 500 }}>
                  Download CSV
                </button>
              </div>
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>App ID</th><th>Name</th><th>Tag</th><th style={{ textAlign: "right" }}>Records</th><th style={{ textAlign: "right" }}>Searches</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.slice(0, 50).map((a, i) => (
                    <tr key={i}>
                      <td className="mono">{a.id}</td>
                      <td style={{ minWidth: 160 }}>{a.name}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                        background: a.tag === "base" ? "#003DFF14" : a.tag === "nonprod-shared" ? "#d9770614" : a.tag === "cmprd-genstudio" ? "#7c3aed14" : "#7778AF14",
                        color: a.tag === "base" ? "#003DFF" : a.tag === "nonprod-shared" ? "#d97706" : a.tag === "cmprd-genstudio" ? "#7c3aed" : "#7778AF",
                      }}>{a.tag ?? a.env}</span></td>
                      <td style={{ textAlign: "right" }}>{fmt(a.records)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(a.searches)}</td>
                      <td style={{ color: "#7778AF" }}>{a.created}</td>
                    </tr>
                  ))}
                  {apps.length > 50 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", color: "#7778AF", padding: 10 }}>
                      Showing 50 of {apps.length} — download CSV for full list
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ═══════ MoM TABLE — Sortable, latest month first ═══════
function MoMTable({ momData }: { momData: MonthPoint[] }) {
  const [sortCol, setSortCol] = useState<string>("month");
  const [sortAsc, setSortAsc] = useState(false); // descending by default = latest on top

  const handleSort = (col: string) => {
    if (sortCol === col) { setSortAsc(!sortAsc); }
    else { setSortCol(col); setSortAsc(col === "month" ? false : false); }
  };

  const sorted = useMemo(() => {
    const data = [...momData];
    data.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortCol === "month") { va = a.month; vb = b.month; }
      else if (sortCol === "apps") { va = a.apps; vb = b.apps; }
      else if (sortCol === "netNew") { va = a.appDelta; vb = b.appDelta; }
      else if (sortCol === "records") { va = a.records; vb = b.records; }
      else if (sortCol === "recDelta") { va = a.recDelta; vb = b.recDelta; }
      else if (sortCol === "prod") { va = a.prod; vb = b.prod; }
      else if (sortCol === "nonprod") { va = a.nonprod; vb = b.nonprod; }
      else if (sortCol === "zombie") { va = a.zombie; vb = b.zombie; }
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return data;
  }, [momData, sortCol, sortAsc]);

  const arrow = (col: string) => sortCol === col ? (sortAsc ? " ↑" : " ↓") : "";
  const thStyle = { cursor: "pointer" as const };

  return (
    <div className="sec">
      <div className="sec-t">Month-over-Month</div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => handleSort("month")}>Month{arrow("month")}</th>
              <th style={thStyle} onClick={() => handleSort("apps")}>Apps{arrow("apps")}</th>
              <th style={thStyle} onClick={() => handleSort("netNew")}>Net New{arrow("netNew")}</th>
              <th style={thStyle} onClick={() => handleSort("records")}>Records{arrow("records")}</th>
              <th style={thStyle} onClick={() => handleSort("recDelta")}>Rec Δ{arrow("recDelta")}</th>
              <th style={thStyle} onClick={() => handleSort("prod")}>Prod{arrow("prod")}</th>
              <th style={thStyle} onClick={() => handleSort("nonprod")}>NonProd{arrow("nonprod")}</th>
              <th style={thStyle} onClick={() => handleSort("zombie")}>Zombie{arrow("zombie")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, color: "#000033" }}>{d.month}</td>
                <td>{d.apps.toLocaleString()}</td>
                <td className="green" style={{ fontWeight: 600 }}>+{d.appDelta}</td>
                <td>{fmt(d.records)}</td>
                <td className={d.recDelta >= 0 ? "green" : "red"}>
                  {d.recDelta >= 0 ? "+" : ""}{fmt(d.recDelta)}
                </td>
                <td>{d.prod}</td>
                <td className="amber">{d.nonprod}</td>
                <td className="red">{d.zombie}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════ CHILD APP MoM TABLE — Tag filter pills + sticky headers + staging summary ═══════
function ChildAppMoMTable({ appDetail, prevMonth, billing }: { appDetail: AppDetailWithDelta[]; prevMonth?: string; billing: DashboardData["billing"] }) {
  const PAGE_SIZE = 50;
  const [sortCol, setSortCol] = useState<string>("records");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [parentView, setParentView] = useState<"prod" | "staging">("prod");

  const prodBilling = billing?.prod;
  const stageBilling = billing?.staging;

  const handleSort = (col: string) => {
    if (sortCol === col) { setSortAsc(!sortAsc); }
    else { setSortCol(col); setSortAsc(false); }
    setPage(0);
  };

  const sortFn = (a: AppDetailWithDelta, b: AppDetailWithDelta) => {
    let va: number | string = 0, vb: number | string = 0;
    if (sortCol === "records") { va = a.records; vb = b.records; }
    else if (sortCol === "searches") { va = a.searches; vb = b.searches; }
    else if (sortCol === "recDelta") { va = a.recDelta; vb = b.recDelta; }
    else if (sortCol === "searchDelta") { va = a.searchDelta; vb = b.searchDelta; }
    else if (sortCol === "name") { va = a.name; vb = b.name; }
    else if (sortCol === "id") { va = a.id; vb = b.id; }
    if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  };

  const arrow = (col: string) => sortCol === col ? (sortAsc ? " ↑" : " ↓") : "";

  // Tag definitions
  const tags = [
    { key: "base", label: "Base", color: "#003DFF" },
    { key: "nonprod-shared", label: "NonProd", color: "#d97706" },
    { key: "cmprd-genstudio", label: "GenStudio", color: "#7c3aed" },
    { key: "cmstg-genstudio", label: "GS Staging", color: "#a78bfa" },
    { key: "legacy", label: "Legacy", color: "#7778AF" },
  ];

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of appDetail) counts[a.tag ?? a.env] = (counts[a.tag ?? a.env] || 0) + 1;
    return counts;
  }, [appDetail]);

  // Filter and sort
  const filtered = useMemo(() => {
    const base = tagFilter === "all" ? appDetail : appDetail.filter(a => (a.tag ?? a.env) === tagFilter);
    return [...base].sort(sortFn);
  }, [appDetail, tagFilter, sortCol, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageApps = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDownload = () => {
    downloadCSV("child_app_usage.csv",
      ["app_id", "name", "env", "tag", "records", "rec_delta", "searches", "search_delta", "created", "status"],
      filtered.map(a => [a.id, `"${a.name}"`, a.env, a.tag ?? "", String(a.records), String(a.recDelta), String(a.searches), String(a.searchDelta), a.created, a.status ?? ""])
    );
  };

  const tagColor = (tag: string) => tags.find(t => t.key === tag)?.color ?? "#7778AF";

  return (
    <div className="sec">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="sec-t" style={{ marginBottom: 0 }}>
          Child App Monthly Record &amp; Search Usage
          {prevMonth && <span style={{ textTransform: "none" as const, letterSpacing: 0, fontWeight: 400, color: "#7778AF", marginLeft: 8 }}>MoM delta vs {prevMonth}</span>}
        </div>
        <DownloadButton onClick={handleDownload} label="Download CSV" />
      </div>

      {/* Parent toggle: Production / Staging */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setParentView("prod"); setPage(0); }}
          style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 5, cursor: "pointer",
            border: parentView === "prod" ? "2px solid #003DFF" : "1px solid #e5e7eb",
            background: parentView === "prod" ? "#003DFF0A" : "#fff", color: parentView === "prod" ? "#003DFF" : "#484C7A" }}>
          ● Production — {prodBilling ? prodBilling.period_end_live_apps.toLocaleString() : "—"} apps
        </button>
        <button onClick={() => { setParentView("staging"); setPage(0); }}
          style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 5, cursor: "pointer",
            border: parentView === "staging" ? "2px solid #d97706" : "1px solid #e5e7eb",
            background: parentView === "staging" ? "#d9770608" : "#fff", color: parentView === "staging" ? "#d97706" : "#484C7A" }}>
          ● Staging — {stageBilling ? stageBilling.period_end_live_apps : "—"} apps
        </button>
      </div>

      {parentView === "staging" ? (
        /* Staging view — billing aggregate only */
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#d97706" }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: "#23263B" }}>Staging Parent</span>
            <span style={{ fontSize: 13, color: "#7778AF" }}>{stageBilling?.parent_id ?? "J5OO6J0MJP"}</span>
          </div>
          {stageBilling ? (
            <div className="grid-4col">
              <div>
                <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Live Apps</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#000033" }}>{stageBilling.period_end_live_apps}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Records</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#000033" }}>{fmt(stageBilling.billable_records)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Searches</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#d97706" }}>{fmt(stageBilling.billable_search_requests)} ⚠</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Churn</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#dc2626" }}>{stageBilling.provisioned_apps > 0 ? ((stageBilling.deleted_in_period_apps / stageBilling.provisioned_apps * 100)).toFixed(0) : 0}%</div>
                <div style={{ fontSize: 12, color: "#7778AF" }}>{stageBilling.deleted_in_period_apps.toLocaleString()} deleted of {stageBilling.provisioned_apps.toLocaleString()} provisioned</div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#7778AF", fontSize: 14 }}>No staging billing data available.</div>
          )}
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#f8f9fb", borderRadius: 4, fontSize: 13, color: "#7778AF" }}>
            Individual staging app data is not included in the weekly CSV export. Only billing aggregates are available from the <code style={{ fontSize: 12, background: "#e5e7eb", padding: "1px 4px", borderRadius: 2 }}>stage_prod_parent_agg_stat</code> file.
          </div>
        </div>
      ) : (
        /* Production view — full app detail table */
        <>
          {/* Tag filter pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => { setTagFilter("all"); setPage(0); }}
              style={{ padding: "4px 14px", fontSize: 12, fontWeight: tagFilter === "all" ? 700 : 500, borderRadius: 20,
                border: tagFilter === "all" ? "1px solid #23263B" : "1px solid #e5e7eb",
                background: tagFilter === "all" ? "#23263B" : "#fff", color: tagFilter === "all" ? "#fff" : "#484C7A", cursor: "pointer" }}>
              All ({prodBilling ? prodBilling.period_end_live_apps.toLocaleString() : appDetail.length})
            </button>
            {tags.filter(t => (tagCounts[t.key] ?? 0) > 0).map(t => (
              <button key={t.key} onClick={() => { setTagFilter(t.key); setPage(0); }}
                style={{ padding: "4px 14px", fontSize: 12, fontWeight: tagFilter === t.key ? 700 : 500, borderRadius: 20,
                  border: tagFilter === t.key ? `1px solid ${t.color}` : "1px solid #e5e7eb",
                  background: tagFilter === t.key ? t.color + "14" : "#fff", color: tagFilter === t.key ? t.color : "#484C7A", cursor: "pointer" }}>
                {t.label} ({tagCounts[t.key] ?? 0})
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Production parent header */}
            <div style={{ background: "#23263B", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", textTransform: "uppercase" as const, letterSpacing: 1 }}>Production Parent</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>EX9JOVML7S</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>
                {tagFilter === "all" ? (prodBilling ? prodBilling.period_end_live_apps.toLocaleString() : filtered.length.toLocaleString()) : filtered.length.toLocaleString()} apps{tagFilter !== "all" ? ` (${tags.find(t => t.key === tagFilter)?.label})` : ""}
              </span>
            </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff" }}>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => handleSort("id")}>App ID{arrow("id")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => handleSort("name")}>Name{arrow("name")}</th>
                <th>Tag</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("records")}>Records{arrow("records")}</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("recDelta")}>Rec Δ{arrow("recDelta")}</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("searches")}>Searches{arrow("searches")}</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("searchDelta")}>Srch Δ{arrow("searchDelta")}</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {pageApps.map((a, i) => (
                <tr key={a.id + i}>
                  <td className="mono">{a.id}</td>
                  <td style={{ minWidth: 160 }}>{a.name}</td>
                  <td><span style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                    background: tagColor(a.tag ?? a.env) + "14", color: tagColor(a.tag ?? a.env) }}>{(tags.find(t => t.key === (a.tag ?? a.env))?.label ?? a.env).toUpperCase()}</span></td>
                  <td style={{ textAlign: "right" }}>{fmt(a.records)}</td>
                  <td style={{ textAlign: "right", color: a.recDelta > 0 ? "#16a34a" : a.recDelta < 0 ? "#dc2626" : "#7778AF", fontWeight: 500 }}>
                    {a.isNew ? <span style={{ fontSize: 12, fontWeight: 600, padding: "1px 8px", borderRadius: 3, background: "#003DFF14", color: "#003DFF" }}>NEW</span>
                      : a.recDelta !== 0 ? `${a.recDelta > 0 ? "+" : ""}${fmt(a.recDelta)}` : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(a.searches)}</td>
                  <td style={{ textAlign: "right", color: a.searchDelta > 0 ? "#16a34a" : a.searchDelta < 0 ? "#dc2626" : "#7778AF", fontWeight: 500 }}>
                    {a.isNew ? "—" : a.searchDelta !== 0 ? `${a.searchDelta > 0 ? "+" : ""}${fmt(a.searchDelta)}` : "—"}
                  </td>
                  <td style={{ fontSize: 13, color: "#7778AF" }}>{a.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#f8f9fb" }}>
            <span style={{ fontSize: 13, color: "#7778AF" }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page === 0} onClick={() => setPage(page - 1)}
                style={{ padding: "5px 14px", fontSize: 13, fontWeight: 500, borderRadius: 4, border: "1px solid #e5e7eb",
                  background: page === 0 ? "#f3f4f6" : "#fff", color: page === 0 ? "#9698C3" : "#36395A", cursor: page === 0 ? "default" : "pointer" }}>
                ← Prev
              </button>
              <span style={{ padding: "5px 10px", fontSize: 13, color: "#484C7A", fontWeight: 600 }}>
                {page + 1} / {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
                style={{ padding: "5px 14px", fontSize: 13, fontWeight: 500, borderRadius: 4, border: "1px solid #e5e7eb",
                  background: page >= totalPages - 1 ? "#f3f4f6" : "#fff", color: page >= totalPages - 1 ? "#9698C3" : "#36395A", cursor: page >= totalPages - 1 ? "default" : "pointer" }}>
                Next →
              </button>
            </div>
          </div>
        )}
          </div>
        </>
      )}
    </div>
  );
}

const TAB_HASHES = ["#summary", "#trends", "#portfolio", "#rnd-brief"];

function getTabFromHash(): number {
  if (typeof window === "undefined") return 0;
  const idx = TAB_HASHES.indexOf(window.location.hash);
  return idx >= 0 ? idx : 0;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState(getTabFromHash);
  const [error, setError] = useState<string | null>(null);

  const handleSetTab = (i: number) => {
    setTab(i);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", TAB_HASHES[i]);
    }
  };

  // Listen for browser back/forward
  useEffect(() => {
    const onHashChange = () => setTab(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const reload = () => loadDashboardData().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div style={{ padding: 40, color: "#dc2626" }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 40, color: "#9ca3af" }}>Loading dashboard...</div>;

  return <DashboardInner data={data} tab={tab} setTab={handleSetTab} onReload={reload} />;
}

function DashboardInner({
  data, tab, setTab, onReload,
}: {
  data: DashboardData;
  tab: number;
  setTab: (t: number) => void;
  onReload: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(true);

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await fetch("/api/update", { method: "POST" });
      const body = await res.json();
      if (res.status === 403) {
        setUpdateAvailable(false);
        return;
      }
      if (!res.ok || !body.success) {
        setUpdateMsg(body.error || "Update failed");
        return;
      }
      onReload();
      setUpdateMsg("Updated");
      setTimeout(() => setUpdateMsg(null), 3000);
    } catch {
      setUpdateMsg("Network error");
    } finally {
      setUpdating(false);
    }
  };

  const { weeks, months, latest, topByRecords, topBySearches, appDetail, metadata, rates, billing } = data;
  const tabs = ["Executive Summary", "Trends & Growth", "Portfolio Health", "R&D Brief"];

  // Growth rate for projections (no longer editable — What-If removed)
  const appRate = rates.appRate;
  const recRate = rates.recRate;

  // Time range for trends tab
  const [timeRange, setTimeRange] = useState<"6m" | "12m" | "all">("all");

  // Reactive projections
  const proj = useMemo(() => {
    const aw = appRate > 0 ? (CONTRACT.appsQuota - latest.apps) / appRate : 99;
    const rw = recRate > 0 ? (CONTRACT.recordsQuota - latest.records) / recRate : 99;
    const projected = [];
    const baseDate = new Date(latest.date);
    for (let i = 0; i < 10; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i + 1);
      projected.push({
        m: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        appsProj: Math.round(latest.apps + appRate * (i + 1)),
        recordsProj: Math.round(latest.records + recRate * (i + 1)),
      });
    }
    return { appRunway: aw, recRunway: rw, appHit: hitDate(aw, latest.date), recHit: hitDate(rw, latest.date), projected };
  }, [appRate, recRate, latest]);

  // isModified removed — What-If sliders removed

  // Month-end data for charts
  const monthEnds = useMemo(() => {
    const map = new Map<string, WeekPoint>();
    weeks.forEach((w) => {
      const existing = map.get(w.month);
      if (!existing || w.date > existing.date) map.set(w.month, w);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [weeks]);

  // Filtered month ends for time range
  const filteredMonthEnds = useMemo(() => {
    if (timeRange === "all") return monthEnds;
    const n = timeRange === "6m" ? 6 : 12;
    return monthEnds.slice(-n);
  }, [monthEnds, timeRange]);

  const chartData = monthEnds.map((w) => ({ m: formatMonth(w.date), ...w }));
  const filteredChartData = filteredMonthEnds.map((w) => ({ m: formatMonth(w.date), ...w }));

  const filteredProjChart = useMemo(
    () => [
      ...filteredChartData.map((d) => ({ m: d.m, apps: d.apps, records: d.records })),
      ...proj.projected.map((d) => ({ m: d.m, appsProj: d.appsProj, recordsProj: d.recordsProj })),
    ],
    [filteredChartData, proj]
  );

  const momData = months.slice(-7).map((d, i) =>
    i === 0 ? null : d
  ).filter(Boolean) as MonthPoint[];

  const appsPct = (latest.apps / CONTRACT.appsQuota) * 100;

  // Search total comes directly from billing system (production parent only)
  // No need to subtract — billing file provides the correct cumulative number
  const searchesCurrent = latest.searches;

  const dataThrough = new Date(latest.date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const weekCount = weeks.length;

  // ═══════ TAB 1: EXECUTIVE SUMMARY ═══════
  const prodBilling = billing?.prod;
  const stageBilling = billing?.staging;
  const topApp = topByRecords[0];
  const topAppShare = topApp ? ((topApp.records / latest.records) * 100).toFixed(1) : "0";
  const emptyIndexApps = latest.searchNoRecords;
  const emptyIndexPct = latest.apps > 0 ? ((emptyIndexApps / latest.apps) * 100).toFixed(0) : "0";
  const zombiePct = ((latest.zombie / CONTRACT.appsQuota) * 100).toFixed(0);

  const Tab1 = () => (
    <>
      {/* NARRATIVE BANNER */}
      <div style={{ background: "#003DFF08", borderLeft: "3px solid #003DFF", padding: "18px 22px", borderRadius: 6, marginBottom: 18 }}>
        <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginBottom: 6 }}>
          Apps grew <strong>+{months.length > 1 ? months[months.length - 1].appDelta : 0}</strong> to <strong>{latest.apps.toLocaleString()}</strong> ({(appsPct).toFixed(1)}% of quota) — ceiling in <strong>{proj.appRunway > 20 ? ">12" : proj.appRunway.toFixed(1)} months</strong>.
        </p>
        <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginBottom: 6 }}>
          <strong>1 app holds {topAppShare}%</strong> of all records. Top search app ≠ top records app — only {topByRecords.filter(r => topBySearches.some(s => s.id === r.id)).length} overlap in both top-10 lists.
        </p>
        {stageBilling && (
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginBottom: 6 }}>
            Staging generates <strong>{latest.searches > 0 ? ((stageBilling.billable_search_requests / (stageBilling.billable_search_requests + (prodBilling?.billable_search_requests ?? 0))) * 100).toFixed(0) : 0}%</strong> of searches but only <strong>{latest.records > 0 ? ((stageBilling.billable_records / (stageBilling.billable_records + (prodBilling?.billable_records ?? 0))) * 100).toFixed(1) : 0}%</strong> of records.
          </p>
        )}
        <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
          <strong>{emptyIndexApps + latest.zombie} apps</strong> ({latest.apps > 0 ? (((emptyIndexApps + latest.zombie) / latest.apps) * 100).toFixed(0) : 0}% of portfolio) are either empty or zombie — cleanup opportunity.
        </p>
      </div>

      {appsPct >= 85 && (
        <div className="alert">
          <span className="alert-icon">&#9888;</span>
          <div>
            <div className="alert-title">
              Apps quota: {proj.appRunway.toFixed(1)} months until ceiling
            </div>
            <div className="alert-desc">
              At ~{appRate} apps/month, the {CONTRACT.appsQuota.toLocaleString()} limit hits{" "}
              <strong className="red">{proj.appHit}</strong>.
            </div>
          </div>
        </div>
      )}

      {/* QUOTA GAUGES WITH ENVIRONMENT BREAKDOWN */}
      <div className="sec">
        <div className="sec-t">Quota Consumption — SO {CONTRACT.soNumber}</div>
        <div className="flex">
          <Gauge label="Customer Apps" current={latest.apps} quota={CONTRACT.appsQuota} hitDate={proj.appHit} />
          <Gauge label="Records (max)" current={latest.records} quota={CONTRACT.recordsQuota} hitDate={proj.recHit} />
          <Gauge label="Search Requests" current={searchesCurrent} quota={CONTRACT.searchesQuota} hitDate="Not projected" />
        </div>
        {/* Tag breakdown removed — Prod vs Staging panel below covers this */}
      </div>

      {/* PRODUCTION VS STAGING */}
      {prodBilling && stageBilling && (
        <div className="sec">
          <div className="sec-t">Production vs Staging</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="grid-2col">
              {/* Production */}
              <div style={{ padding: 20, borderRight: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: "#003DFF" }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#23263B", textTransform: "uppercase" as const, letterSpacing: 1 }}>Production</div>
                    <div style={{ fontSize: 13, color: "#7778AF" }}>Parent: {prodBilling.parent_id}</div>
                  </div>
                  <span style={{ fontSize: 13, color: "#7778AF", marginLeft: "auto" }}>{prodBilling.period_end_live_apps.toLocaleString()} live apps</span>
                </div>
                <div className="grid-3col">
                  <div>
                    <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Apps</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#000033" }}>{prodBilling.period_end_live_apps.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: "#7778AF" }}>{((prodBilling.period_end_live_apps / (prodBilling.period_end_live_apps + stageBilling.period_end_live_apps)) * 100).toFixed(0)}% of total</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Records</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#000033" }}>{fmt(prodBilling.billable_records)}</div>
                    <div style={{ fontSize: 12, color: "#7778AF" }}>{((prodBilling.billable_records / (prodBilling.billable_records + stageBilling.billable_records)) * 100).toFixed(1)}% of total</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Searches</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#000033" }}>{fmt(prodBilling.billable_search_requests)}</div>
                    <div style={{ fontSize: 12, color: "#7778AF" }}>{((prodBilling.billable_search_requests / (prodBilling.billable_search_requests + stageBilling.billable_search_requests)) * 100).toFixed(1)}% of total</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#7778AF", marginTop: 12, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                  Provisioned: {prodBilling.provisioned_apps.toLocaleString()} · Deleted: {prodBilling.deleted_in_period_apps.toLocaleString()} · Retention: {prodBilling.provisioned_apps > 0 ? (100 - (prodBilling.deleted_in_period_apps / prodBilling.provisioned_apps * 100)).toFixed(0) : 100}%
                </div>
              </div>
              {/* Staging */}
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: "#d97706" }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#23263B", textTransform: "uppercase" as const, letterSpacing: 1 }}>Staging</div>
                    <div style={{ fontSize: 13, color: "#7778AF" }}>Parent: {stageBilling.parent_id}</div>
                  </div>
                  <span style={{ fontSize: 13, color: "#7778AF", marginLeft: "auto" }}>{stageBilling.period_end_live_apps} live apps</span>
                </div>
                <div className="grid-3col">
                  <div>
                    <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Apps</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#000033" }}>{stageBilling.period_end_live_apps}</div>
                    <div style={{ fontSize: 12, color: "#7778AF" }}>{((stageBilling.period_end_live_apps / (prodBilling.period_end_live_apps + stageBilling.period_end_live_apps)) * 100).toFixed(0)}% of total</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Records</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#000033" }}>{fmt(stageBilling.billable_records)}</div>
                    <div style={{ fontSize: 12, color: "#7778AF" }}>{((stageBilling.billable_records / (prodBilling.billable_records + stageBilling.billable_records)) * 100).toFixed(1)}% of total</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Searches</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#d97706" }}>{fmt(stageBilling.billable_search_requests)} ⚠</div>
                    <div style={{ fontSize: 12, color: "#7778AF" }}>{((stageBilling.billable_search_requests / (prodBilling.billable_search_requests + stageBilling.billable_search_requests)) * 100).toFixed(1)}% of total</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#7778AF", marginTop: 12, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                  Provisioned: {stageBilling.provisioned_apps.toLocaleString()} · Deleted: {stageBilling.deleted_in_period_apps.toLocaleString()} · Churn: {stageBilling.provisioned_apps > 0 ? ((stageBilling.deleted_in_period_apps / stageBilling.provisioned_apps * 100)).toFixed(0) : 0}%
                </div>
              </div>
            </div>
            {/* Summary footer */}
            <div style={{ padding: "12px 20px", background: "#f8f9fb", borderTop: "1px solid #e5e7eb", fontSize: 13, color: "#484C7A", lineHeight: 1.6 }}>
              Staging generates <strong>{((stageBilling.billable_search_requests / (prodBilling.billable_search_requests + stageBilling.billable_search_requests)) * 100).toFixed(0)}%</strong> of all search traffic on <strong>{((stageBilling.period_end_live_apps / (prodBilling.period_end_live_apps + stageBilling.period_end_live_apps)) * 100).toFixed(0)}%</strong> of apps.
              {" "}This is QA/test automation — not real user traffic.
              {" "}<strong>{((stageBilling.deleted_in_period_apps / stageBilling.provisioned_apps) * 100).toFixed(0)}%</strong> of staging apps are created and deleted within weeks.
            </div>
          </div>
        </div>
      )}

      {/* ENGAGEMENT HEALTH — Interactive: click donut/legend to see app lists */}
      <EngagementPanel appDetail={appDetail} chartData={chartData} latest={latest} />

      {/* APP TYPES — naming convention breakdown within production parent */}
      <div className="sec">
        <div className="sec-t">App Types (by naming convention)</div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Tag</th><th style={{ textAlign: "right" }}>Apps</th><th>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { dot: "#003DFF", tag: "Base", apps: latest.tagBase, desc: "Production AEM content indices" },
                { dot: "#d97706", tag: "nonprod-shared", apps: latest.tagNonprodShared, desc: "Non-production environments" },
                { dot: "#7c3aed", tag: "cmprd-genstudio", apps: latest.tagCmprdGenstudio, desc: "GenStudio for Performance Marketing" },
                ...(latest.tagCmstgGenstudio > 0 ? [{ dot: "#a78bfa", tag: "cmstg-genstudio", apps: latest.tagCmstgGenstudio, desc: "GenStudio staging" }] : []),
                ...(latest.tagLegacy > 0 ? [{ dot: "#7778AF", tag: "Legacy", apps: latest.tagLegacy, desc: "Pre-Cloud Manager apps" }] : []),
              ].map((row, i) => (
                <tr key={i}>
                  <td><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: row.dot, marginRight: 8, verticalAlign: "middle" }} />{row.tag}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{row.apps.toLocaleString()}</td>
                  <td style={{ color: "#7778AF" }}>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sec">
        <div className="sec-t">Partnership at a Glance</div>
        <div className="flex">
          <KPI label="Top App Share" value={topAppShare + "%"} sub={`1 app holds ${fmt(topApp?.records ?? 0)} of ${fmt(latest.records)}`} color="#d97706"
            sparkline={months.slice(-6).map(m => m.c10r)} sparkColor="#d97706" />
          <KPI label="Empty Index Apps" value={emptyIndexApps.toString()} sub={`${emptyIndexPct}% of apps — searches w/o data`} color="#dc2626"
            sparkline={months.slice(-6).map(m => m.searchNoRecords)} sparkColor="#dc2626" />
          <KPI label="Zombie Apps" value={latest.zombie.toString()} sub={`${zombiePct}% of quota, zero activity`} color="#dc2626"
            sparkline={months.slice(-6).map(m => m.zombie)} sparkColor="#dc2626" />
        </div>
      </div>
    </>
  );

  // ═══════ TAB 2: TRENDS & GROWTH ═══════
  const Tab2 = () => (
    <>
      {/* Time range toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([["6m", "Last 6 months"], ["12m", "Last 12 months"], ["all", "All time"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTimeRange(key)}
            style={{
              padding: "6px 16px", fontSize: 13, fontWeight: timeRange === key ? 700 : 500,
              color: timeRange === key ? "#111827" : "#6b7280",
              background: timeRange === key ? "#fff" : "transparent",
              border: timeRange === key ? "1px solid #e5e7eb" : "1px solid transparent",
              borderRadius: 6, cursor: "pointer",
              boxShadow: timeRange === key ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="sec">
        <div className="sec-t">Application Growth + Projection</div>
        <div className="card">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={filteredProjChart} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#003DFF" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#003DFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="m" tick={{ fill: "#9ca3af", fontSize: 11 }} interval={3} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={1500} stroke="#dc2626" strokeDasharray="6 3" label={{ value: "1,500 Quota", position: "right", fill: "#dc2626", fontSize: 11 }} />
              <Area dataKey="apps" fill="url(#ag)" stroke="#003DFF" strokeWidth={2} dot={false} name="Actual" />
              <Line dataKey="appsProj" stroke="#003DFF" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Projected" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="sec">
        <div className="sec-t">Records Trajectory</div>
        <div className="card">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={filteredProjChart} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="m" tick={{ fill: "#9ca3af", fontSize: 11 }} interval={3} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={50000000} stroke="#dc2626" strokeDasharray="6 3" label={{ value: "50M Quota", position: "right", fill: "#dc2626", fontSize: 11 }} />
              <Area dataKey="records" fill="url(#rg)" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Actual" />
              <Line dataKey="recordsProj" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Projected" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="sec">
        <div className="sec-t">Concentration Trend</div>
        <div className="card">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="m" tick={{ fill: "#9ca3af", fontSize: 11 }} interval={2} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} domain={[60, 100]} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <Line dataKey="c10r" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Records %" />
              <Line dataKey="c10s" stroke="#003DFF" strokeWidth={2} dot={false} name="Searches %" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", color: "#16a34a", fontSize: 13, marginTop: 4 }}>
            Records: {monthEnds[0]?.c10r}% → {latest.c10r}% · Searches: {monthEnds[0]?.c10s}% → {latest.c10s}% — healthier distribution
          </div>
        </div>
      </div>

      <MoMTable momData={momData} />

      {/* Child App table moved to Tab 3 — grouped by environment */}
    </>
  );

  // ═══════ TAB 3: PORTFOLIO DETAIL ═══════
  const Tab3 = () => {
    return (
      <>
        <div className="sec">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="sec-t" style={{ marginBottom: 0 }}>Top 10 — By Records</div>
            <DownloadButton onClick={() => downloadCSV("top10_by_records.csv",
              ["rank", "app_id", "name", "records", "share_pct", "searches", "ratio"],
              topByRecords.map((d, i) => [String(i + 1), d.id, `"${d.name}"`, String(d.records), ((d.records / latest.records) * 100).toFixed(1), String(d.searches), d.records > 0 ? (d.searches / d.records).toFixed(4) : "0"])
            )} />
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>App ID</th><th>Name</th><th>Records</th>
                  <th>Share</th><th>Searches</th><th>Ratio</th>
                </tr>
              </thead>
              <tbody>
                {topByRecords.map((d, i) => {
                  const ratio = d.records > 0 ? d.searches / d.records : 0;
                  const pct = ((d.records / latest.records) * 100).toFixed(1);
                  return (
                    <tr key={i}>
                      <td style={{ color: "#9ca3af" }}>{i + 1}</td>
                      <td className="mono">{d.id}</td>
                      <td style={{ fontSize: 13, color: "#6b7280" }}>{d.name}</td>
                      <td>{fmt(d.records)}</td>
                      <td>
                        <MiniBar value={d.records} max={topByRecords[0]?.records ?? 1} color="#8b5cf6" />{" "}
                        {pct}%
                      </td>
                      <td>{fmt(d.searches)}</td>
                      <td style={{ color: ratio < 0.01 ? "#dc2626" : ratio < 0.1 ? "#d97706" : "#16a34a", fontWeight: 500 }}>
                        {ratio < 0.001 ? "~0" : ratio.toFixed(3)} {ratio < 0.01 ? "⚠" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sec">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="sec-t" style={{ marginBottom: 0 }}>Top 10 — By Search Volume</div>
            <DownloadButton onClick={() => downloadCSV("top10_by_searches.csv",
              ["rank", "app_id", "name", "searches", "records"],
              topBySearches.map((d, i) => [String(i + 1), d.id, `"${d.name}"`, String(d.searches), String(d.records)])
            )} />
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>App ID</th><th>Name</th><th>Searches</th>
                  <th>Distribution</th><th>Records</th>
                </tr>
              </thead>
              <tbody>
                {topBySearches.map((d, i) => (
                  <tr key={i}>
                    <td style={{ color: "#9ca3af" }}>{i + 1}</td>
                    <td className="mono">{d.id}</td>
                    <td style={{ fontSize: 13, color: "#6b7280" }}>{d.name}</td>
                    <td>{fmt(d.searches)}</td>
                    <td>
                      <MiniBar value={d.searches} max={topBySearches[0]?.searches ?? 1} color="#003DFF" />
                    </td>
                    <td>{fmt(d.records)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CHILD APP MONTHLY RECORD & SEARCH USAGE — GROUPED BY ENVIRONMENT */}
        <ChildAppMoMTable appDetail={appDetail} prevMonth={data.prevMonth} billing={billing} />
      </>
    );
  };

  return (
    <div className="dashboard">
      <div className="sticky-top">
      <div className="header">
        <div>
          <div className="header-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/algolia-logo.svg" alt="Algolia" className="header-logo" />
            <span className="header-divider">|</span> Adobe OEM Analytics
          </div>
          <div className="header-meta">
            {CONTRACT.soNumber} · Feb 2026 – Jan 2027 · {weekCount} weeks of data
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {updateAvailable && (
            <button
              onClick={handleUpdate}
              disabled={updating}
              style={{
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: updating ? "#9ca3af" : "#003DFF",
                background: "transparent",
                border: "1px solid " + (updating ? "#e5e7eb" : "#003DFF"),
                borderRadius: 6,
                cursor: updating ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap" as const,
              }}
            >
              {updating ? (
                <>
                  <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #9ca3af", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Updating...
                </>
              ) : "Update Data"}
            </button>
          )}
          {updateMsg && (
            <span style={{ fontSize: 13, color: updateMsg === "Updated" ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
              {updateMsg}
            </span>
          )}
          <div style={{ textAlign: "right" }}>
            <div className="header-date-label">Data as of</div>
            <div className="header-date-val">
              {metadata.generated_at
                ? new Date(metadata.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
                  " \u00B7 " +
                  new Date(metadata.generated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                : dataThrough}
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t, i) => (
          <div key={i} className={`tab ${i === tab ? "active" : ""}`} onClick={() => setTab(i)}>
            {t}
          </div>
        ))}
      </div>
      </div>{/* end sticky-top */}

      <div className="body">
        {tab === 0 && <Tab1 />}
        {tab === 1 && <Tab2 />}
        {tab === 2 && <Tab3 />}
        {tab === 3 && <RDBrief />}
      </div>

      <div className="footer">
        Adobe OEM Usage Dashboard · Source: Hex (Redshift) · {metadata.files_processed} CSVs · Algolia Strategic Partnerships
      </div>
    </div>
  );
}
