export const PARENT_APPS = {
  production: { id: "EKVXKN7L76", label: "Production" },
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
