import type { DashboardData, MonthPoint } from "./types";
import { CURRENT_CONTRACT } from "./contracts";

export type ObservationKind = "decline" | "growth" | "neutral" | "glimmer";
export type ObservationSeverity = "high" | "medium" | "low";

export interface Observation {
  kind: ObservationKind;
  severity: ObservationSeverity;
  metric: string;
  headline: string;
  detail: string;
  current: number;
  prior: number;
  deltaAbs: number;
  deltaPct: number;
}

export interface PeriodFraming {
  currentMonth: string;
  priorMonth: string;
  currentDate: string;
  priorDate: string;
  inProgress: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  label: string;
}

export interface ObservationsResult {
  framing: PeriodFraming | null;
  headlines: Observation[];
  glimmers: Observation[];
  concerns: Observation[];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function buildFraming(cur: MonthPoint, prev: MonthPoint): PeriodFraming {
  const [year, monthNum] = cur.month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const dayOfMonth = parseInt(cur.date.split("-")[2], 10);
  // Treat as in-progress if the snapshot is more than 5 days from month-end
  const inProgress = dayOfMonth < daysInMonth - 5;

  const curLabel = formatMonthLabel(cur.month);
  const prevLabel = formatMonthLabel(prev.month);
  const label = inProgress
    ? `${prevLabel} → ${curLabel} (in progress, day ${dayOfMonth} of ${daysInMonth})`
    : `${prevLabel} → ${curLabel}`;

  return {
    currentMonth: cur.month,
    priorMonth: prev.month,
    currentDate: cur.date,
    priorDate: prev.date,
    inProgress,
    dayOfMonth,
    daysInMonth,
    label,
  };
}

function pct(curr: number, prior: number): number {
  if (prior === 0) return curr === 0 ? 0 : 100;
  return ((curr - prior) / prior) * 100;
}

function severityFor(absPct: number): ObservationSeverity {
  if (absPct >= 20) return "high";
  if (absPct >= 5) return "medium";
  return "low";
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString("en-US");
}

function buildMetricObservation(
  metric: string,
  curr: number,
  prior: number,
  formatter: (n: number) => string = fmtCompact,
): Observation {
  const deltaAbs = curr - prior;
  const deltaPct = pct(curr, prior);
  const absPct = Math.abs(deltaPct);
  let kind: ObservationKind = "neutral";
  let verb = "held flat";
  if (deltaAbs > 0) {
    kind = "growth";
    verb = absPct >= 25 ? "spiked" : "grew";
  } else if (deltaAbs < 0) {
    kind = "decline";
    verb = absPct >= 25 ? "dropped" : "fell";
  }

  const sign = deltaAbs > 0 ? "+" : "";
  const headline = deltaAbs === 0
    ? `${metric} held flat MoM`
    : `${metric} ${verb} by ${formatter(Math.abs(deltaAbs))} (${sign}${deltaPct.toFixed(1)}%)`;

  const detail = `${formatter(prior)} → ${formatter(curr)}`;

  return {
    kind,
    severity: severityFor(absPct),
    metric,
    headline,
    detail,
    current: curr,
    prior,
    deltaAbs,
    deltaPct,
  };
}

function buildGlimmers(
  cur: MonthPoint,
  prev: MonthPoint,
  data: DashboardData,
): Observation[] {
  const glimmers: Observation[] = [];

  // 1. Engagement up despite portfolio shrinking
  const portfolioContracted = cur.apps < prev.apps || cur.records < prev.records;
  if (cur.searches > prev.searches && portfolioContracted) {
    const searchPct = pct(cur.searches, prev.searches);
    glimmers.push({
      kind: "glimmer",
      severity: "high",
      metric: "Engagement",
      headline: `Searches up ${searchPct.toFixed(1)}% even as portfolio contracted`,
      detail: "Activity per remaining app is rising — engagement, not just count",
      current: cur.searches,
      prior: prev.searches,
      deltaAbs: cur.searches - prev.searches,
      deltaPct: searchPct,
    });
  }

  // 2. Zombie cleanup
  if (cur.zombie < prev.zombie) {
    const removed = prev.zombie - cur.zombie;
    glimmers.push({
      kind: "glimmer",
      severity: removed >= 10 ? "high" : "medium",
      metric: "Zombie cleanup",
      headline: `${removed} zombie apps removed since ${formatMonthLabel(prev.month)}`,
      detail: `${prev.zombie} → ${cur.zombie}`,
      current: cur.zombie,
      prior: prev.zombie,
      deltaAbs: -removed,
      deltaPct: pct(cur.zombie, prev.zombie),
    });
  }

  // 3. Top-app concentration eased
  if (cur.c10r > 0 && prev.c10r > 0 && cur.c10r < prev.c10r - 1) {
    glimmers.push({
      kind: "glimmer",
      severity: "medium",
      metric: "Concentration",
      headline: `Top-10 record concentration eased to ${cur.c10r}%`,
      detail: `${prev.c10r}% → ${cur.c10r}% — less single-app dependency`,
      current: cur.c10r,
      prior: prev.c10r,
      deltaAbs: cur.c10r - prev.c10r,
      deltaPct: pct(cur.c10r, prev.c10r),
    });
  }

  // 4. Single biggest record-grower from appDetail
  const eligible = data.appDetail.filter((a) => !a.isNew && a.recDelta > 0 && a.prevRecords > 1000);
  if (eligible.length > 0) {
    const top = [...eligible].sort((a, b) => (b.recDelta / Math.max(b.prevRecords, 1)) - (a.recDelta / Math.max(a.prevRecords, 1)))[0];
    const growthPct = pct(top.records, top.prevRecords);
    if (growthPct >= 50) {
      glimmers.push({
        kind: "glimmer",
        severity: "medium",
        metric: "Top grower",
        headline: `${top.name || top.id} records grew ${growthPct.toFixed(0)}%`,
        detail: `${fmtCompact(top.prevRecords)} → ${fmtCompact(top.records)} (+${fmtCompact(top.recDelta)})`,
        current: top.records,
        prior: top.prevRecords,
        deltaAbs: top.recDelta,
        deltaPct: growthPct,
      });
    }
  }

  return glimmers;
}

function buildConcerns(cur: MonthPoint, prev: MonthPoint): Observation[] {
  const concerns: Observation[] = [];

  // Empty-index apps growing
  if (cur.searchNoRecords > prev.searchNoRecords) {
    const delta = cur.searchNoRecords - prev.searchNoRecords;
    concerns.push({
      kind: "decline",
      severity: delta >= 10 ? "high" : "medium",
      metric: "Empty-index apps",
      headline: `${delta} more apps searching with no records`,
      detail: `${prev.searchNoRecords} → ${cur.searchNoRecords} — wasted search calls`,
      current: cur.searchNoRecords,
      prior: prev.searchNoRecords,
      deltaAbs: delta,
      deltaPct: pct(cur.searchNoRecords, prev.searchNoRecords),
    });
  }

  // Apps quota burn
  const curBurn = (cur.apps / CURRENT_CONTRACT.appsQuota) * 100;
  const prevBurn = (prev.apps / CURRENT_CONTRACT.appsQuota) * 100;
  if (curBurn >= 85 && curBurn > prevBurn) {
    concerns.push({
      kind: "decline",
      severity: "high",
      metric: "Apps quota",
      headline: `Apps quota at ${curBurn.toFixed(1)}% — approaching ceiling`,
      detail: `${cur.apps.toLocaleString()} of ${CURRENT_CONTRACT.appsQuota.toLocaleString()}`,
      current: cur.apps,
      prior: prev.apps,
      deltaAbs: cur.apps - prev.apps,
      deltaPct: pct(cur.apps, prev.apps),
    });
  }

  return concerns;
}

export function computeObservations(data: DashboardData): ObservationsResult {
  const { months } = data;
  if (months.length < 2) {
    return { framing: null, headlines: [], glimmers: [], concerns: [] };
  }

  const cur = months[months.length - 1];
  const prev = months[months.length - 2];

  const framing = buildFraming(cur, prev);

  const headlines: Observation[] = [
    buildMetricObservation("Apps", cur.apps, prev.apps, (n) => Math.round(n).toLocaleString("en-US")),
    buildMetricObservation("Records", cur.records, prev.records),
    buildMetricObservation("Searches", cur.searches, prev.searches),
  ];

  const glimmers = buildGlimmers(cur, prev, data);
  const concerns = buildConcerns(cur, prev);

  return { framing, headlines, glimmers, concerns };
}
