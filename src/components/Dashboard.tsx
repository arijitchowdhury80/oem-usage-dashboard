"use client";
import { useState, useMemo, useEffect } from "react";
import {
  Area, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, ReferenceLine,
} from "recharts";
import { CURRENT_CONTRACT, PARENT_APPS } from "@/lib/contracts";
import { loadDashboardData } from "@/lib/data";
import { fmt } from "@/lib/formatters";
import type { DashboardData, WeekPoint, MonthPoint, AppDetailWithDelta } from "@/lib/types";
import Gauge from "./Gauge";
import KPI from "./KPI";
import ChartTooltip from "./ChartTooltip";
import MiniBar from "./MiniBar";

const CONTRACT = CURRENT_CONTRACT;

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

// ═══════ CHILD APP MoM TABLE — Grouped by Environment ═══════
function ChildAppMoMTable({ appDetail, prevMonth }: { appDetail: AppDetailWithDelta[]; prevMonth?: string }) {
  const [sortCol, setSortCol] = useState<string>("records");
  const [sortAsc, setSortAsc] = useState(false);

  const prodApps = appDetail.filter((a) => a.env === "prod");
  const nonprodApps = appDetail.filter((a) => a.env === "nonprod");
  const legacyApps = appDetail.filter((a) => a.env === "legacy" || a.env === "genstudio");

  const handleSort = (col: string) => {
    if (sortCol === col) { setSortAsc(!sortAsc); }
    else { setSortCol(col); setSortAsc(false); }
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

  const renderGroup = (title: string, parentId: string, apps: AppDetailWithDelta[], color: string) => {
    if (apps.length === 0) return null;
    const sorted = [...apps].sort(sortFn);
    return (
      <>
        <tr>
          <td colSpan={7} style={{ background: color + "0A", padding: "10px 12px", borderBottom: `2px solid ${color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#23263B", textTransform: "uppercase" as const, letterSpacing: 1 }}>{title}</span>
              <span style={{ fontSize: 13, color: "#7778AF" }}>Parent: {parentId}</span>
              <span style={{ fontSize: 13, color: "#7778AF", marginLeft: "auto" }}>{apps.length} apps</span>
            </div>
          </td>
        </tr>
        {sorted.map((a, i) => (
          <tr key={a.id + i}>
            <td className="mono">{a.id}</td>
            <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</td>
            <td style={{ textAlign: "right" }}>{fmt(a.records)}</td>
            <td style={{ textAlign: "right", color: a.recDelta > 0 ? "#16a34a" : a.recDelta < 0 ? "#dc2626" : "#7778AF", fontWeight: 500 }}>
              {a.isNew ? <span style={{ fontSize: 14, fontWeight: 600, padding: "1px 8px", borderRadius: 3, background: "#003DFF14", color: "#003DFF" }}>NEW</span>
                : a.recDelta !== 0 ? `${a.recDelta > 0 ? "+" : ""}${fmt(a.recDelta)}` : "—"}
            </td>
            <td style={{ textAlign: "right" }}>{fmt(a.searches)}</td>
            <td style={{ textAlign: "right", color: a.searchDelta > 0 ? "#16a34a" : a.searchDelta < 0 ? "#dc2626" : "#7778AF", fontWeight: 500 }}>
              {a.isNew ? "—" : a.searchDelta !== 0 ? `${a.searchDelta > 0 ? "+" : ""}${fmt(a.searchDelta)}` : "—"}
            </td>
            <td style={{ fontSize: 13, color: "#7778AF" }}>{a.created}</td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="sec">
      <div className="sec-t">
        Child App Monthly Record &amp; Search Usage
        {prevMonth && <span style={{ textTransform: "none" as const, letterSpacing: 0, fontWeight: 400, color: "#7778AF", marginLeft: 8 }}>MoM delta vs {prevMonth}</span>}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th style={{ cursor: "pointer" }} onClick={() => handleSort("id")}>App ID{arrow("id")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => handleSort("name")}>Name{arrow("name")}</th>
              <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("records")}>Records{arrow("records")}</th>
              <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("recDelta")}>Rec Δ{arrow("recDelta")}</th>
              <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("searches")}>Searches{arrow("searches")}</th>
              <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("searchDelta")}>Srch Δ{arrow("searchDelta")}</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {renderGroup("Production", PARENT_APPS.production.id, prodApps, "#003DFF")}
            {renderGroup("Non-Production", PARENT_APPS.staging.id, nonprodApps, "#d97706")}
            {legacyApps.length > 0 && renderGroup("Legacy / Other", "—", legacyApps, "#7778AF")}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData().then(setData).catch((e) => setError(e.message));
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      loadDashboardData().then(setData).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <div style={{ padding: 40, color: "#dc2626" }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 40, color: "#9ca3af" }}>Loading dashboard...</div>;

  return <DashboardInner data={data} tab={tab} setTab={setTab} />;
}

function DashboardInner({
  data, tab, setTab,
}: {
  data: DashboardData;
  tab: number;
  setTab: (t: number) => void;
}) {
  const { weeks, months, latest, topByRecords, topBySearches, appDetail, metadata, rates } = data;
  const tabs = ["Executive Summary", "Trends & Growth", "Portfolio Health"];

  // What-if slider state
  const [appRate, setAppRate] = useState(rates.appRate);
  const [recRate, setRecRate] = useState(rates.recRate);

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

  const isModified = appRate !== rates.appRate || recRate !== rates.recRate;

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

  // Search calculation: only count from Feb 2026 contract start
  const jan2026 = weeks.find((w) => w.month === "2026-01");
  const searchesCurrent = jan2026 ? latest.searches - jan2026.searches : latest.searches;

  const dataThrough = new Date(latest.date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const weekCount = weeks.length;

  // ═══════ TAB 1: EXECUTIVE SUMMARY ═══════
  const Tab1 = () => (
    <>
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

      <div className="sec">
        <div className="sec-t">Aggregate Usage vs Quota — SO {CONTRACT.soNumber}</div>
        <div className="flex">
          <Gauge label="Customer Apps" current={latest.apps} quota={CONTRACT.appsQuota} hitDate={proj.appHit} />
          <Gauge label="Records (max)" current={latest.records} quota={CONTRACT.recordsQuota} hitDate={proj.recHit} />
          <Gauge label="Search Requests" current={searchesCurrent} quota={CONTRACT.searchesQuota} hitDate="Not projected" />
        </div>
      </div>

      {/* ENVIRONMENT BREAKDOWN */}
      <div className="sec">
        <div className="sec-t">Usage by Environment</div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Production */}
            <div style={{ borderRight: "1px solid #e5e7eb", paddingRight: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#003DFF" }} />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#23263B", textTransform: "uppercase" as const, letterSpacing: 1 }}>Production</span>
                  <span style={{ fontSize: 13, color: "#7778AF", display: "block", marginTop: 1 }}>Parent: {PARENT_APPS.production.id}</span>
                </div>
                <span style={{ fontSize: 13, color: "#7778AF", marginLeft: "auto" }}>{latest.prod.toLocaleString()} apps</span>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Records</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: "#23263B" }}>{fmt(latest.prodRecords)}</div>
                  <div style={{ fontSize: 13, color: "#7778AF" }}>{((latest.prodRecords / CONTRACT.recordsQuota) * 100).toFixed(1)}% of quota</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Searches</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: "#23263B" }}>{fmt(latest.prodSearches)}</div>
                  <div style={{ fontSize: 13, color: "#7778AF" }}>{((latest.prodSearches / latest.searches) * 100).toFixed(0)}% of total</div>
                </div>
              </div>
            </div>
            {/* Non-Production */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#d97706" }} />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#23263B", textTransform: "uppercase" as const, letterSpacing: 1 }}>Non-Production</span>
                  <span style={{ fontSize: 13, color: "#7778AF", display: "block", marginTop: 1 }}>Parent: {PARENT_APPS.staging.id}</span>
                </div>
                <span style={{ fontSize: 13, color: "#7778AF", marginLeft: "auto" }}>{latest.nonprod.toLocaleString()} apps</span>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Records</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: "#23263B" }}>{fmt(latest.nonprodRecords)}</div>
                  <div style={{ fontSize: 13, color: "#7778AF" }}>{((latest.nonprodRecords / CONTRACT.recordsQuota) * 100).toFixed(1)}% of quota</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>Searches</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: "#23263B" }}>{fmt(latest.nonprodSearches)}</div>
                  <div style={{ fontSize: 13, color: "#7778AF" }}>{((latest.nonprodSearches / latest.searches) * 100).toFixed(0)}% of total</div>
                </div>
              </div>
            </div>
          </div>
          {/* Usage bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "#9698C3", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Record Distribution</div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#f3f4f6" }}>
              <div style={{ width: `${(latest.prodRecords / latest.records * 100)}%`, background: "#003DFF" }} />
              <div style={{ width: `${(latest.nonprodRecords / latest.records * 100)}%`, background: "#d97706" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7778AF", marginTop: 4 }}>
              <span>Prod: {((latest.prodRecords / latest.records) * 100).toFixed(1)}%</span>
              <span>NonProd: {((latest.nonprodRecords / latest.records) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* WHAT-IF SCENARIO MODELER */}
      <div className="sec">
        <div className="sec-t">
          What-If Scenario Modeler
          {isModified && (
            <span style={{ marginLeft: 8, color: "#003DFF", fontSize: 14, fontWeight: 500, textTransform: "none" as const, letterSpacing: 0 }}>
              Modified from actual
            </span>
          )}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="slider-section">
            <div className="slider-group">
              <div className="slider-head">
                <span className="slider-label">App Growth Rate</span>
                <span className="slider-val" style={{ color: appRate !== rates.appRate ? "#003DFF" : "#111827" }}>
                  {appRate} <span className="slider-unit">apps/mo</span>
                </span>
              </div>
              <input
                type="range" min={10} max={120} value={appRate}
                onChange={(e) => setAppRate(Number(e.target.value))}
                style={{
                  width: "100%", height: 6, appearance: "none" as const,
                  background: `linear-gradient(to right, #003DFF ${((appRate - 10) / 110) * 100}%, #e5e7eb ${((appRate - 10) / 110) * 100}%)`,
                  borderRadius: 3, outline: "none", cursor: "pointer",
                }}
              />
              <div className="slider-range">
                <span>10/mo</span>
                <span style={{ color: "#6b7280", fontWeight: 600 }}>Actual: {rates.appRate}/mo</span>
                <span>120/mo</span>
              </div>
              <div
                className="slider-result"
                style={{ background: proj.appRunway < 3 ? "#fef2f2" : proj.appRunway < 6 ? "#fffbeb" : "#f0fdf4" }}
              >
                <span style={{ color: proj.appRunway < 3 ? "#dc2626" : proj.appRunway < 6 ? "#d97706" : "#16a34a", fontWeight: 600 }}>
                  Ceiling in {proj.appRunway > 20 ? ">12" : proj.appRunway.toFixed(1)} months → {proj.appHit}
                </span>
              </div>
            </div>
            <div className="slider-group">
              <div className="slider-head">
                <span className="slider-label">Record Growth Rate</span>
                <span className="slider-val" style={{ color: recRate !== rates.recRate ? "#003DFF" : "#111827" }}>
                  {fmt(recRate)} <span className="slider-unit">records/mo</span>
                </span>
              </div>
              <input
                type="range" min={500000} max={3000000} step={100000} value={recRate}
                onChange={(e) => setRecRate(Number(e.target.value))}
                style={{
                  width: "100%", height: 6, appearance: "none" as const,
                  background: `linear-gradient(to right, #8b5cf6 ${((recRate - 500000) / 2500000) * 100}%, #e5e7eb ${((recRate - 500000) / 2500000) * 100}%)`,
                  borderRadius: 3, outline: "none", cursor: "pointer",
                }}
              />
              <div className="slider-range">
                <span>500K/mo</span>
                <span style={{ color: "#6b7280", fontWeight: 600 }}>Actual: {fmt(rates.recRate)}/mo</span>
                <span>3M/mo</span>
              </div>
              <div
                className="slider-result"
                style={{ background: proj.recRunway < 3 ? "#fef2f2" : proj.recRunway < 6 ? "#fffbeb" : "#f0fdf4" }}
              >
                <span style={{ color: proj.recRunway < 3 ? "#dc2626" : proj.recRunway < 6 ? "#d97706" : "#16a34a", fontWeight: 600 }}>
                  Ceiling in {proj.recRunway > 20 ? ">12" : proj.recRunway.toFixed(1)} months → {proj.recHit}
                </span>
              </div>
            </div>
          </div>
          {isModified && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button
                className="reset-btn"
                onClick={() => { setAppRate(rates.appRate); setRecRate(rates.recRate); }}
              >
                Reset to actual rates
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sec-t">Partnership at a Glance</div>
        <div className="flex">
          <KPI label="Active Child Apps" value={latest.apps.toLocaleString()} sub={`${latest.prod} prod · ${latest.nonprod} nonprod`} />
          <KPI label="Current Records" value={fmt(latest.records)} sub={`${(latest.records / CONTRACT.recordsQuota * 100).toFixed(0)}% of 50M quota`} />
          <KPI label="Zombie Apps" value={latest.zombie.toString()} sub="Provisioned, never used" color="#dc2626" />
          <KPI label="Concentration" value={latest.c10r + "%"} sub="Top 10 hold this % of records" color={latest.c10r > 80 ? "#d97706" : "#16a34a"} />
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

  // ═══════ TAB 3: PORTFOLIO HEALTH ═══════
  const Tab3 = () => {
    const total = latest.prod + latest.nonprod;
    const prodPct = total > 0 ? ((latest.prod / total) * 100).toFixed(0) : "0";
    const npPct = total > 0 ? ((latest.nonprod / total) * 100).toFixed(0) : "0";

    const engColors = { ab: "#16a34a", rns: "#d97706", snr: "#8b5cf6", z: "#dc2626" };
    const engData = [
      { name: "Active", value: latest.activeBoth, color: engColors.ab },
      { name: "Records only", value: latest.recordsNoSearch, color: engColors.rns },
      { name: "Search only", value: latest.searchNoRecords, color: engColors.snr },
      { name: "Zombie", value: latest.zombie, color: engColors.z },
    ];
    const engLegend = [
      { c: engColors.ab, l: "Active", n: latest.activeBoth, d: "Records and searches. Working as intended." },
      { c: engColors.rns, l: "Records only", n: latest.recordsNoSearch, d: "Content loaded, no one is searching." },
      { c: engColors.snr, l: "Search only", n: latest.searchNoRecords, d: "Searches firing, no content indexed." },
      { c: engColors.z, l: "Zombie", n: latest.zombie, d: "Created but never used. Zero activity." },
    ];

    const topApp = topByRecords[0];
    const topAppShare = topApp ? ((topApp.records / latest.records) * 100).toFixed(0) : "0";
    const top5Records = topByRecords.slice(0, 5).reduce((a, b) => a + b.records, 0);
    const top5Pct = latest.records > 0 ? ((top5Records / latest.records) * 100).toFixed(0) : "0";

    return (
      <>
        <div className="sec">
          <div className="sec-t">Key Insights</div>
          <div className="flex">
            <KPI label="App #1 Record Share" value={topAppShare + "%"} sub={`${topApp?.id} holds ${fmt(topApp?.records ?? 0)} of ${fmt(latest.records)}`} color="#dc2626" />
            <KPI label="Top 5 Concentration" value={top5Pct + "%"} sub={`5 apps hold ${top5Pct}% of all records`} color="#d97706" />
            <KPI label="Non-Production Apps" value={latest.nonprod.toString()} sub={`${npPct}% of all apps — consuming quota`} color="#d97706" />
            <KPI label="Zombie Apps" value={latest.zombie.toString()} sub={`${((latest.zombie / CONTRACT.appsQuota) * 100).toFixed(0)}% of quota wasted`} color="#dc2626" />
          </div>
        </div>

        <div className="sec">
          <div className="sec-t">Environment Split</div>
          <div className="card" style={{ padding: "14px 20px" }}>
            <div className="env-bar">
              <div style={{ width: `${prodPct}%`, background: "#003DFF" }}>{prodPct}%</div>
              <div style={{ width: `${npPct}%`, background: "#d97706" }}>{npPct}%</div>
            </div>
            <div className="env-labels">
              <span style={{ color: "#003DFF", fontWeight: 600 }}>Production — {latest.prod.toLocaleString()}</span>
              <span style={{ color: "#d97706", fontWeight: 600 }}>Non-Production — {latest.nonprod}</span>
            </div>
          </div>
        </div>

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
                    <Line dataKey="activeBoth" stroke={engColors.ab} strokeWidth={2} dot={false} name="Active" />
                    <Line dataKey="recordsNoSearch" stroke={engColors.rns} strokeWidth={2} dot={false} name="Records only" />
                    <Line dataKey="searchNoRecords" stroke={engColors.snr} strokeWidth={2} dot={false} name="Search only" />
                    <Line dataKey="zombie" stroke={engColors.z} strokeWidth={2} dot={false} name="Zombie" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="engage-right">
                <div className="chart-title" style={{ textAlign: "center" }}>Current Snapshot</div>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={engData} cx="50%" cy="50%" innerRadius={36} outerRadius={55} dataKey="value" strokeWidth={0}>
                      {engData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 10 }}>
                  {engLegend.map((l, i) => (
                    <div key={i} className="engage-legend">
                      <div className="engage-dot" style={{ background: l.c }} />
                      <div>
                        <div className="engage-leg-title">{l.l} ({l.n})</div>
                        <div className="engage-leg-desc">{l.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sec">
          <div className="sec-t">Top 10 — By Records</div>
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
          <div className="sec-t">Top 10 — By Search Volume</div>
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
        <ChildAppMoMTable appDetail={appDetail} prevMonth={data.prevMonth} />
      </>
    );
  };

  return (
    <div className="dashboard">
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
        <div style={{ textAlign: "right" }}>
          <div className="header-date-label">Data Through</div>
          <div className="header-date-val">{dataThrough}</div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t, i) => (
          <div key={i} className={`tab ${i === tab ? "active" : ""}`} onClick={() => setTab(i)}>
            {t}
          </div>
        ))}
      </div>

      <div className="body">
        {tab === 0 && <Tab1 />}
        {tab === 1 && <Tab2 />}
        {tab === 2 && <Tab3 />}
      </div>

      <div className="footer">
        Adobe OEM Usage Dashboard · Source: Hex (Redshift) · {metadata.files_processed} CSVs · Algolia Strategic Partnerships
      </div>
    </div>
  );
}
