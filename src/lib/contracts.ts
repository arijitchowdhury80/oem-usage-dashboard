export const PARENT_APPS = {
  production: { id: "EX9JOVML7S", label: "Production" },
  staging: { id: "J50O6J0MJP", label: "Staging / Non-Production" },
};

export const CURRENT_CONTRACT = {
  soNumber: "Q-47553",
  start: "2026-02-01",
  end: "2027-01-31",
  appsQuota: 1500,
  recordsQuota: 50_000_000,
  searchesQuota: 75_000_000,
  annualRate: 739_520,
  excess: {
    perApp: 600,
    perRecordUnit: 4.80,
    perSearchUnit: 0.70,
  },
  // Quota basis: search & records are COMBINED (prod + staging) per the SO; apps is the
  // production parent only. The 75M search allowance is metered FROM the term start
  // (2026-02-01), not the lifetime billing counter — so term-to-date search = current
  // combined billable_search_requests minus this baseline (the cumulative-since-2024
  // value as of the term start, from the 3-Feb-2026 parent-summary report).
  termStartSearchBaseline: 68_412_433,        // combined prod + staging, as of 2026-02-01
  termStartSearchBaselineProd: 29_229_775,
  termStartSearchBaselineStaging: 39_182_658,
};

export const PREVIOUS_CONTRACT = {
  soNumber: "Q-20684",
  start: "2024-02-01",
  end: "2026-01-31",
  appsQuota: 70,
  recordsQuota: 50_000_000,
  searchesQuota: 240_000_000,
  annualRate: 331_600,
};
