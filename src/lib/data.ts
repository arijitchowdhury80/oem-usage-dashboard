import type {
  ConsolidatedData,
  WeekPoint,
  MonthPoint,
  DashboardData,
} from "./types";

function cleanWeeks(raw: ConsolidatedData): WeekPoint[] {
  // Filter out zero-record snapshots (staging parent app duplicates)
  const nonZero = raw.weekly_snapshots.filter(
    (s) => s.totals.latest_records > 0
  );

  // Deduplicate by date: if same date appears twice, take higher active_apps
  const byDate = new Map<string, (typeof nonZero)[0]>();
  for (const s of nonZero) {
    const existing = byDate.get(s.report_date);
    if (!existing || s.totals.active_apps > existing.totals.active_apps) {
      byDate.set(s.report_date, s);
    }
  }

  return Array.from(byDate.values())
    .sort((a, b) => a.report_date.localeCompare(b.report_date))
    .map((s) => ({
      date: s.report_date,
      month: s.report_month,
      apps: s.totals.active_apps,
      records: s.totals.latest_records,
      searches: s.totals.total_searches,
      prod: s.segmentation.prod,
      nonprod: s.segmentation.nonprod,
      zombie: s.engagement.zombie,
      recordsNoSearch: s.engagement.records_no_search,
      searchNoRecords: s.engagement.search_no_records,
      activeBoth: s.engagement.active_both,
      c10r: s.concentration.top10_records_pct,
      c10s: s.concentration.top10_searches_pct,
      prodRecords: s.environment?.prod_records ?? 0,
      prodSearches: s.environment?.prod_searches ?? 0,
      nonprodRecords: s.environment?.nonprod_records ?? 0,
      nonprodSearches: s.environment?.nonprod_searches ?? 0,
      tagBase: s.name_tags?.base ?? 0,
      tagNonprodShared: s.name_tags?.nonprod_shared ?? 0,
      tagCmprdGenstudio: s.name_tags?.cmprd_genstudio ?? 0,
      tagCmstgGenstudio: s.name_tags?.cmstg_genstudio ?? 0,
      tagLegacy: s.name_tags?.legacy ?? 0,
    }));
}

function computeMonths(weeks: WeekPoint[]): MonthPoint[] {
  // Take last week per month
  const byMonth = new Map<string, WeekPoint>();
  for (const w of weeks) {
    const existing = byMonth.get(w.month);
    if (!existing || w.date > existing.date) {
      byMonth.set(w.month, w);
    }
  }

  const sorted = Array.from(byMonth.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return sorted.map((w, i) => ({
    month: w.month,
    date: w.date,
    apps: w.apps,
    records: w.records,
    searches: w.searches,
    prod: w.prod,
    nonprod: w.nonprod,
    zombie: w.zombie,
    recordsNoSearch: w.recordsNoSearch,
    searchNoRecords: w.searchNoRecords,
    activeBoth: w.activeBoth,
    c10r: w.c10r,
    c10s: w.c10s,
    appDelta: i > 0 ? w.apps - sorted[i - 1].apps : 0,
    recDelta: i > 0 ? w.records - sorted[i - 1].records : 0,
    prodRecords: w.prodRecords,
    prodSearches: w.prodSearches,
    nonprodRecords: w.nonprodRecords,
    nonprodSearches: w.nonprodSearches,
    tagBase: w.tagBase,
    tagNonprodShared: w.tagNonprodShared,
    tagCmprdGenstudio: w.tagCmprdGenstudio,
    tagCmstgGenstudio: w.tagCmstgGenstudio,
    tagLegacy: w.tagLegacy,
  }));
}

function computeRates(months: MonthPoint[]): { appRate: number; recRate: number } {
  const recent = months.slice(-6);
  if (recent.length < 2) return { appRate: 0, recRate: 0 };
  const n = recent.length - 1;
  return {
    appRate: Math.round((recent[n].apps - recent[0].apps) / n),
    recRate: Math.round((recent[n].records - recent[0].records) / n),
  };
}

export async function loadDashboardData(): Promise<DashboardData> {
  const res = await fetch("/api/data");
  if (!res.ok) throw new Error("Failed to load data");
  const raw: ConsolidatedData = await res.json();

  const weeks = cleanWeeks(raw);
  const months = computeMonths(weeks);
  const latest = weeks[weeks.length - 1];
  const rates = computeRates(months);

  // Get latest + previous snapshot for MoM deltas
  const validSnapshots = raw.weekly_snapshots
    .filter((s) => s.totals.latest_records > 0);

  // Group by month and take last per month
  const snapByMonth = new Map<string, typeof validSnapshots[0]>();
  for (const s of validSnapshots) {
    const existing = snapByMonth.get(s.report_month);
    if (!existing || s.report_date > existing.report_date) {
      snapByMonth.set(s.report_month, s);
    }
  }
  const monthKeys = Array.from(snapByMonth.keys()).sort();
  const latestSnapshot = snapByMonth.get(monthKeys[monthKeys.length - 1]);
  const prevSnapshot = monthKeys.length >= 2
    ? snapByMonth.get(monthKeys[monthKeys.length - 2])
    : undefined;

  // Build prev month app detail lookup for MoM delta
  const prevAppMap = new Map<string, { records: number; searches: number }>();
  if (prevSnapshot?.app_detail) {
    for (const a of prevSnapshot.app_detail) {
      prevAppMap.set(a.id, { records: a.records, searches: a.searches });
    }
  }

  // Enrich current app_detail with MoM deltas
  const appDetailWithDelta = (latestSnapshot?.app_detail ?? []).map((a) => {
    const prev = prevAppMap.get(a.id);
    return {
      ...a,
      prevRecords: prev?.records ?? 0,
      prevSearches: prev?.searches ?? 0,
      recDelta: prev ? a.records - prev.records : a.records,
      searchDelta: prev ? a.searches - prev.searches : a.searches,
      isNew: !prev,
    };
  });

  // Extract billing data from the latest snapshot (if billing file was present)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLatest = latestSnapshot as any;
  const billing = rawLatest?.billing ?? null;

  return {
    weeks,
    months,
    latest,
    appMaster: raw.app_master,
    topByRecords: latestSnapshot?.top15_by_records.slice(0, 10) ?? [],
    topBySearches: latestSnapshot?.top15_by_searches.slice(0, 10) ?? [],
    appDetail: appDetailWithDelta,
    metadata: raw._metadata,
    rates,
    prevMonth: prevSnapshot ? monthKeys[monthKeys.length - 2] : undefined,
    billing,
  };
}
