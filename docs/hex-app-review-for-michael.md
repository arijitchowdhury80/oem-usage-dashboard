# Adobe OEM Usage — Hex App Review

**To:** Michael Pankonien · **From:** Arijit Chowdhury · **Re:** `Adobe OEM Usage` Hex project (Q-47553 / FY25 OEM)
**Reviewed version:** export `019f3b10…` · Databricks-backed · 40 cells

---

## Context

I generate the weekly Adobe exec email + dashboard off the CSV/PDF this app produces, so I read the project YAML end-to-end to make sure my numbers and yours tell the same story. The app is genuinely good — the layered `adobe_child_apps` build, the prod+staging combined roll-up, the exclude-top-3-days billing rule, and the region methodology are all thoughtful. This note is the short list of things that would make it more correct, more efficient, and more useful downstream. Ordered by priority.

---

## P0 — Correctness

**1. The default date range makes %-to-quota read against lifetime, not the current term.**
The `Quota and Usage Analysis` cell computes search %-to-quota as `SUM(billable_search_requests)` over the selected `usages_date_range`, and that range propagates down through `adobe_child_apps` (`date >= usages_date_range_start`). The range **defaults to `2024-02-02 → 2027-01-31`** — i.e. all usage since the MSA. So the published PDF reports **lifetime** search against the **current-term** 75M quota, which overstates the denominator's coverage and diverges from how the term is actually billed. Set the default range to the term start (`2026-02-01`) and search %-to-quota becomes term-relative automatically (≈79% today), matching the billing basis. Records (most-recent-month max) and apps (period-end) are point-in-time and already correct regardless of window — this only affects the search flow metric. Cleanest fix: a **"Current term" date preset** so the published app always scopes to the active term, while ad-hoc lifetime analysis stays one click away.

**2. Records quota is not pinned to the contract.**
Quotas come from `daily_consumptions` (old term carried 240M search / 1,000 apps), overridden by the input cells. The overrides now default correctly for search (75M) and apps (1,500) — good. But `records_quota_override` still defaults to `0`, so records falls back to the billing table. It's coincidentally 50M today, but nothing pins it. **Fix:** set `records_quota_override` default to `50000000`, or drive all three off a small `contract_terms` seed (term, quotas, basis) so the app can't silently report against a stale quota when the term rolls.

**3. Custom-Growth projection has a variable swap** (`Projected stats ii`, ~L8625):
```python
'period_end_live_apps_delta':     billable_records_growth_rate / 100   # apps ← records rate
'billable_search_requests_delta': live_apps_growth_rate / 100          # search ← apps rate
'billable_records_delta':         billable_requests_growth_rate / 100  # records ← search rate
```
Each metric is fed the wrong growth-rate input. Dormant because the default method is "Median," but it will produce wrong projections the moment anyone selects Custom Growth Rates.

**4. Stale assumption in billing categorization.** The region CASE hardcodes a cluster→"France" mapping with an inline note *"Confirm this cluster's name?? June 25 2024."* A two-year-old unverified TODO sitting in production billing region logic — worth confirming or removing.

---

## P1 — Projection method under-warns

The Median method takes the median of **all** historical monthly deltas and adds it forward linearly. This account is accelerating (staging ramp), so the median flattens recent growth and **under-projects burn** — the forecast reads "comfortable" while the last-3-month trend points to search-quota exhaustion around August. For a tool whose main job is to flag overage/renewal risk, that's the wrong direction. Suggest adding a recent-weighted (trailing-3-month) or simple linear-regression projection next to the median so the risk case is visible.

---

## P2 — Efficiency & maintainability

- **The pipeline is written twice** — every CTE is duplicated for the prod parent (`analytics.dimensional.*`) and the staging parent (`data_engineering_staging.*`). Any logic change has to be made in both or the two parents drift. Parameterizing the schema/parent once would halve the surface area and remove the drift risk.
- **~225 lines of commented-out code** (Redshift table twins from the Databricks migration) — safe to delete; right now it obscures the live logic and invites editing the wrong line.
- **One ~700-line SQL cell** builds base-apps + history + records + cluster + region + owner together. Splitting into smaller named cells would make it testable and debuggable.

---

## Opportunity — data you already join but don't surface

These are pulled into the query and dropped. Surfacing them would make both the app and my downstream dashboard materially more useful, at low cost:

| Already in the query | Unlocks |
|---|---|
| `app_owner_email_address` | Owner accountability — who drives burn, whose apps are zombies |
| `dim_account` | Account/BU rollup above the app level |
| `app_cluster_history` + `location` | Geographic burn view on the exec summary |
| `rolling_30_day_search_ops` | Spike/anomaly detection (flag the week staging jumped) |
| daily grain (`daily_per_application`) | Daily burn-rate → sharper exhaustion prediction than month-end snapshots |

---

## The one change that helps us both most

Ship a **"Current term" view** — the term-relative scoping already works (P0 #1); it just isn't the default, so the published PDF reads lifetime while my exec email reports this-term, and the two show different percentages for the same account. Two levels:

- **Quick (minutes):** add a "Current term" date preset (start `2026-02-01`) and make it the default on the quota tabs. That alone makes your published numbers and my email agree.
- **Durable:** emit a small **term-relative fact table** — one row per parent per month with usage, contract quota, %-of-term, pace vs. plan, projected exhaustion date, staging share, and top owners. Then the dashboard and email both just *read* it: one source of truth, no re-derivation, no drift. It's also the prerequisite for automating the weekly export → dashboard → draft pipeline.

---

Happy to pair on any of this — especially the `contract_terms` seed and the term-relative fact table. I can draft the SQL if useful.

— Arijit
