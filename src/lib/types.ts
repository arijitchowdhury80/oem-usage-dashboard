export interface WeeklySnapshot {
  report_date: string;
  report_month: string;
  csv_rows: number;
  totals: {
    apps: number;
    active_apps: number;
    deleted_apps: number;
    latest_records: number;
    total_searches: number;
  };
  segmentation: {
    prod: number;
    nonprod: number;
    genstudio: number;
    legacy: number;
  };
  engagement: {
    zombie: number;
    records_no_search: number;
    search_no_records: number;
    active_both: number;
  };
  concentration: {
    top10_records_pct: number;
    top10_searches_pct: number;
  };
  name_tags?: {
    base: number;
    nonprod_shared: number;
    cmprd_genstudio: number;
    cmstg_genstudio: number;
    genstudio: number;
    legacy: number;
  };
  environment: {
    prod_apps: number;
    prod_records: number;
    prod_searches: number;
    nonprod_apps: number;
    nonprod_records: number;
    nonprod_searches: number;
    legacy_apps: number;
    legacy_records: number;
    legacy_searches: number;
  };
  age_distribution: {
    "0_3mo": number;
    "3_6mo": number;
    "6_12mo": number;
    "12mo_plus": number;
    unknown: number;
  };
  top15_by_records: AppEntry[];
  top15_by_searches: AppEntry[];
  app_detail: AppDetail[];
}

export interface AppEntry {
  id: string;
  name: string;
  records: number;
  searches: number;
  created: string;
  env?: string;
}

export interface AppDetail {
  id: string;
  name: string;
  env: string;
  tag?: string;
  records: number;
  max_records: number;
  searches: number;
  max_rsum: number;
  created: string;
  status?: "active" | "records_only" | "search_only" | "zombie";
}

export interface MonthlySummary {
  month: string;
  report_date: string;
  weeks_in_month: number;
  apps: number;
  records: number;
  searches: number;
  total_apps_ever: number;
  prod: number;
  nonprod: number;
  genstudio: number;
  zombie: number;
  top10_rec_pct: number;
  top10_srch_pct: number;
  prod_records: number;
  prod_searches: number;
  nonprod_records: number;
  nonprod_searches: number;
}

export interface ConsolidatedData {
  _metadata: {
    generated_at: string;
    root_dir: string;
    files_found: number;
    files_processed: number;
    date_range_start: string;
    date_range_end: string;
  };
  weekly_snapshots: WeeklySnapshot[];
  monthly_summary: MonthlySummary[];
  app_master: AppEntry[];
  contract: {
    apps_quota: number;
    records_quota: number;
    searches_quota: number;
  };
}

// Cleaned weekly data point for charts
export interface WeekPoint {
  date: string;
  month: string;
  apps: number;
  records: number;
  searches: number;
  prod: number;
  nonprod: number;
  zombie: number;
  recordsNoSearch: number;
  searchNoRecords: number;
  activeBoth: number;
  c10r: number;
  c10s: number;
  // Environment usage
  prodRecords: number;
  prodSearches: number;
  nonprodRecords: number;
  nonprodSearches: number;
  // Naming tag counts
  tagBase: number;
  tagNonprodShared: number;
  tagCmprdGenstudio: number;
  tagCmstgGenstudio: number;
  tagLegacy: number;
}

// Monthly data point
export interface MonthPoint {
  month: string;
  date: string;
  apps: number;
  records: number;
  searches: number;
  prod: number;
  nonprod: number;
  zombie: number;
  recordsNoSearch: number;
  searchNoRecords: number;
  activeBoth: number;
  c10r: number;
  c10s: number;
  appDelta: number;
  recDelta: number;
  prodRecords: number;
  prodSearches: number;
  nonprodRecords: number;
  nonprodSearches: number;
  tagBase: number;
  tagNonprodShared: number;
  tagCmprdGenstudio: number;
  tagCmstgGenstudio: number;
  tagLegacy: number;
}

export interface AppDetailWithDelta extends AppDetail {
  prevRecords: number;
  prevSearches: number;
  recDelta: number;
  searchDelta: number;
  isNew: boolean;
}

export interface BillingParent {
  parent_id: string;
  billing_period_start: string;
  billing_period_end: string;
  billable_search_requests: number;
  billable_records: number;
  period_end_live_apps: number;
  deleted_in_period_apps: number;
  provisioned_apps: number;
}

export interface BillingData {
  source: string;
  prod: BillingParent | null;
  staging: BillingParent | null;
}

export interface DashboardData {
  weeks: WeekPoint[];
  months: MonthPoint[];
  latest: WeekPoint;
  appMaster: AppEntry[];
  topByRecords: AppEntry[];
  topBySearches: AppEntry[];
  appDetail: AppDetailWithDelta[];
  metadata: ConsolidatedData["_metadata"];
  rates: {
    appRate: number;
    recRate: number;
  };
  prevMonth?: string;
  billing: BillingData | null;
}
