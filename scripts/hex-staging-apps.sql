-- ════════════════════════════════════════════════════════════════════════════
-- Adobe OEM — Staging child-app detail (Test/Staging parent J50O6J0MJP)
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: the weekly "all_children_daily_usage" CSV is filtered to the PROD
--          parent only (EX9JOVML7S). Adobe asked which STAGING apps drive the
--          staging search. This returns per-app detail for the staging parent so
--          they can identify the heavy apps.
--
-- Billing basis matches the weekly report:
--   search  = SUM(total_search_requests_excluding_query_suggestions)
--   records = MAX(max_monthly_record_usage)   (peak month, billing basis)
--
-- Staging parent: J50O6J0MJP  (confirm spelling in dim_application_all).
-- Run in Hex against the Databricks connection. One row per staging child app,
-- ranked by this-term search (Feb 2026 onward) so the culprits sort to the top.
-- ════════════════════════════════════════════════════════════════════════════

WITH child_monthly AS (
  SELECT
      dim.public_application_id                                              AS app_id
    , dim.application_name                                                   AS app_name
    , usr.email_address                                                      AS owner_email
    , CAST(dim.created_at       AS DATE)                                     AS created_at
    , CAST(dim.last_activity_at AS DATE)                                     AS last_activity_at
    , CAST(dim.deleted_at       AS DATE)                                     AS deleted_at
    , CAST(DATE_TRUNC('month', d.date) AS DATE)                             AS usages_month
    , SUM(COALESCE(d.total_search_requests_excluding_query_suggestions, 0))  AS monthly_search
    , MAX(COALESCE(d.records, 0))                                          AS monthly_max_records
  FROM data_engineering_staging.usages.daily_per_application AS d
  INNER JOIN analytics.dimensional.dim_application_all AS dim
    ON d.application_id = dim.public_application_id
  LEFT JOIN analytics.dimensional.dim_user_all AS usr
    ON dim.owner_user_id = usr.user_id
  WHERE dim.billing_public_application_id = 'J50O6J0MJP'
    AND d.date >= '2024-02-02'
  GROUP BY 1, 2, 3, 4, 5, 6, 7
)
SELECT
    app_id
  , app_name
  , owner_email
  , SUM(CASE WHEN usages_month >= '2026-02-01' THEN monthly_search ELSE 0 END) AS term_search_feb26_on
  , SUM(monthly_search)                                                        AS lifetime_search
  , MAX(monthly_max_records)                                                   AS peak_monthly_records
  , created_at
  , last_activity_at
  , deleted_at
FROM child_monthly
GROUP BY app_id, app_name, owner_email, created_at, last_activity_at, deleted_at
ORDER BY term_search_feb26_on DESC;

-- Sanity check: SUM(term_search_feb26_on) across all rows should ≈ 41.6M
-- (staging term-to-date search), matching the weekly report and the email.
