-- ════════════════════════════════════════════════════════════════════════════
-- Adobe OEM — Child-app detail (TWO tables, Production + Staging)
-- LIVE in the Hex report ("Adobe OEM Usage") on the MONTH-OVER-MONTH USAGE tab.
--   SQL 146 = Production child apps  (billing parent EX9JOVML7S)
--   SQL 148 = Staging child apps     (billing parent J50O6J0MJP)
-- Each is its own table with app_id + a downloadable CSV; each refreshes on the
-- weekly run because it reads the report's already-materialised dataframe
-- `stage_prod_adobe_child_apps` (both parents, monthly grain, ~9,533 rows).
--
-- DATA SOURCE = "Dataframes" (DuckDB), NOT Databricks. Reading the cached
-- dataframe makes the cells instant and un-timeout-able on publish/weekly refresh.
--
-- BILLING BASIS (matches the weekly report / email):
--   search  = SUM(monthly_search_requests_excluding_query_suggestions)  [this term]
--   records = MAX(child_monthly_records)   (peak child records in a month)
-- Sanity: Production totals 19,870,222 search this term (1,727 apps; top app
-- GTH4AUT0Y6 = 6,447,429). Staging totals 41,645,180 (144 apps; top app
-- HZ9GMWFEDD / cm-p152603-e343265 = 40,257,032 — the staging over-consumer).
--
-- ── LESSONS (why this took several tries) ──────────────────────────────────
-- 1. An interactive dropdown feeding ONE cell via {{ }} does NOT bind on Hex's
--    published app-run (proven across 4 attempts incl. renaming the variable and
--    an `is defined` guard). It works on-demand in the editor but publishes with
--    errors. Use two no-input tables instead of a dropdown for weekly-published cells.
-- 2. To place a notebook cell on an APP TAB, use the per-cell **"ADD TO TABS"**
--    icon (the small panel icon in the cell's top-right toolbar), NOT the "..."
--    menu's "Add to section" (that is for notebook grouping, not app tabs).
--    Deleting a tab does not delete its cells; cells stay on any other tab.
-- ════════════════════════════════════════════════════════════════════════════

-- ── SQL 146 : Production ────────────────────────────────────────────────────
SELECT
    public_application_id                                              AS app_id
  , MAX(application_name)                                              AS app_name
  , MAX(app_owner_email_address)                                       AS owner_email
  , SUM(monthly_search_requests_excluding_query_suggestions)          AS search_this_term
  , MAX(child_monthly_records)                                         AS max_records
  , MAX(created_at)                                                    AS created
  , MAX(last_activity_at)                                              AS last_active
  , MAX(deleted_at)                                                    AS deleted
FROM stage_prod_adobe_child_apps
WHERE billing_public_application_id = 'EX9JOVML7S'
  AND usages_month >= '2026-02-01'
GROUP BY public_application_id
ORDER BY search_this_term DESC;

-- ── SQL 148 : Staging (identical, only the parent id differs) ───────────────
SELECT
    public_application_id                                              AS app_id
  , MAX(application_name)                                              AS app_name
  , MAX(app_owner_email_address)                                       AS owner_email
  , SUM(monthly_search_requests_excluding_query_suggestions)          AS search_this_term
  , MAX(child_monthly_records)                                         AS max_records
  , MAX(created_at)                                                    AS created
  , MAX(last_activity_at)                                              AS last_active
  , MAX(deleted_at)                                                    AS deleted
FROM stage_prod_adobe_child_apps
WHERE billing_public_application_id = 'J50O6J0MJP'
  AND usages_month >= '2026-02-01'
GROUP BY public_application_id
ORDER BY search_this_term DESC;
