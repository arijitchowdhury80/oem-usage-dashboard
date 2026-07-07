-- ════════════════════════════════════════════════════════════════════════════
-- Adobe OEM — Search consumption trend: Production vs Staging vs Combined
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: monthly + cumulative billable search per parent app, from term
--          inception (2024-02), to show prod/staging split against allocation.
--
-- Billing basis matches the weekly report exactly:
--   billable search = SUM(total_search_requests_excluding_query_suggestions)
--   per parent per month  (Adobe OEM Usage YAML, line 1448 -> 637).
--   No top-3-day exclusion on search (that rule applies to RECORDS only).
--
-- Parent apps:  Production = EX9JOVML7S   |   Staging = J50O6J0MJP
--   NOTE: confirm the staging id spelling in dim_application_all — the Hex
--   output CSV uses 'J50O6J0MJP' (five-zero-Oh). Adjust if the warehouse differs.
--
-- Allocation context (for the chart's reference line):
--   Prior contract Q-20684: ~80M search / year (240M / 3y internal split)
--   Current term  Q-47553 : 75M search / year, combined prod+staging, from Feb 2026
--
-- Run in Hex against the same Databricks connection as the main app.
-- Sanity check: cumulative through 2026-07 should be ≈ 47.73M prod / ≈ 79.81M staging.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 1 — Monthly + cumulative search by parent (feeds the dashboard trend)
-- One row per (month, parent): monthly burn + running cumulative.
-- ─────────────────────────────────────────────────────────────────────────────
WITH monthly AS (
  SELECT
      CAST(DATE_TRUNC('month', d.date) AS DATE)                             AS usages_month
    , dim.billing_public_application_id                                      AS parent_app
    , SUM(COALESCE(d.total_search_requests_excluding_query_suggestions, 0))  AS monthly_billable_search
  FROM data_engineering_staging.usages.daily_per_application AS d
  INNER JOIN analytics.dimensional.dim_application_all AS dim
    ON d.application_id = dim.public_application_id
  WHERE dim.billing_public_application_id IN ('EX9JOVML7S', 'J50O6J0MJP')
    AND d.date >= '2024-02-02'
  GROUP BY 1, 2
)
SELECT
    usages_month
  , CASE parent_app
      WHEN 'EX9JOVML7S' THEN 'Production'
      WHEN 'J50O6J0MJP' THEN 'Staging'
      ELSE parent_app
    END                                                                     AS environment
  , parent_app
  , monthly_billable_search
  , SUM(monthly_billable_search) OVER (
      PARTITION BY parent_app
      ORDER BY usages_month
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                                                       AS cumulative_billable_search
FROM monthly
ORDER BY parent_app, usages_month;


-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 2 — Year 1 / Year 2 / Term-to-date summary (hand straight to Piyush)
-- Prod, Staging, and Combined search per contract year.
-- ─────────────────────────────────────────────────────────────────────────────
WITH monthly AS (
  SELECT
      CAST(DATE_TRUNC('month', d.date) AS DATE)                             AS usages_month
    , dim.billing_public_application_id                                      AS parent_app
    , SUM(COALESCE(d.total_search_requests_excluding_query_suggestions, 0))  AS monthly_billable_search
  FROM data_engineering_staging.usages.daily_per_application AS d
  INNER JOIN analytics.dimensional.dim_application_all AS dim
    ON d.application_id = dim.public_application_id
  WHERE dim.billing_public_application_id IN ('EX9JOVML7S', 'J50O6J0MJP')
    AND d.date >= '2024-02-02'
  GROUP BY 1, 2
)
SELECT
    CASE
      WHEN usages_month >= '2024-02-01' AND usages_month < '2025-02-01' THEN 'Year 1  (Feb 24 – Jan 25)'
      WHEN usages_month >= '2025-02-01' AND usages_month < '2026-02-01' THEN 'Year 2  (Feb 25 – Jan 26)'
      WHEN usages_month >= '2026-02-01'                                  THEN 'Term-to-date  (Feb 26 – now)'
    END                                                                     AS period
  , SUM(CASE WHEN parent_app = 'EX9JOVML7S' THEN monthly_billable_search ELSE 0 END) AS prod_search
  , SUM(CASE WHEN parent_app = 'J50O6J0MJP' THEN monthly_billable_search ELSE 0 END) AS staging_search
  , SUM(monthly_billable_search)                                            AS combined_search
FROM monthly
GROUP BY 1
ORDER BY 1;
