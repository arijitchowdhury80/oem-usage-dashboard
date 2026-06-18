# Data-Integrity Issues — fix BEFORE enriching the email

These were surfaced by an adversarial review of the consolidated JSON (2026-06-17). A
richer, more-trusted weekly email *amplifies* wrong numbers, so these are blocking for the
email redesign. Each item is a real defect or a known artifact that must be suppressed or
fixed in `scripts/consolidate.py` / `scripts/draft-email.js`.

> **Status (2026-06-17): #1 and #3 FIXED in `consolidate.py` (test-covered in
> `scripts/test_consolidate.py`); data regenerated. #2, #4, #6 are display/contract
> concerns handled during the email build. #5 unchanged.**

## 1. `concentration.top10_records_pct` = 101.1% — FIXED ✅ (was a real bug)
- A share can't exceed 100%. The stored value was **101.1%** (6 of the last 6 snapshots
  were >100%).
- **Root cause (reproduced exactly):** the numerator summed the top-10 over **all** apps
  incl. deleted (`sorted(apps.values())`), while the denominator was the billing-overridden
  `total_latest_records` (live prod only). A **deleted** app (`cm-p100417-e924025`, deleted
  2026-04-21) retaining a **14.5M-record** peak sat at #1 in the numerator but not the
  denominator → 31,477,027 ÷ 31,140,231 = 101.1%.
- **Fix:** compute both numerator and denominator over `active_list` (active apps, CSV
  per-app sum), for records **and** searches. Result: records **55.7%**, guaranteed 0–100%.
- **⚠ Searches concentration corrected 30% → 65.7%.** The old 30% divided per-app
  summed-daily searches (20.86M) by billing's *cumulative-since-2024* total (45.75M) —
  apples-to-oranges. The true share is **65.7%**, and a single app (`cm-p150705-e1552975`)
  is **34%** of all active search volume. **Search is concentrated, not "broadly spread"** —
  do NOT use the old "top 10 = 30%, broad adoption" narrative in the email.

## 2. May 2026 billing-methodology switch fabricates fake MoM swings
- Records appear to drop **40M → ~27M** Apr→May 2026, and zombies **256 → ~37**. Both are
  artifacts of a methodology/definition change, **not** real movement.
- **Action:** never headline any records or zombie MoM that spans the May-2026 boundary.
  Trend rows for records should start *after* the reset with a one-line footnote.

## 3. Duplicate 2026-05-19 snapshot with degenerate values — FIXED ✅
- Three folders contained a stray partial CSV next to the full export
  (2026-05-19: `child_app_daily_*` 676 rows; 2025-04-28: `* MOM.csv` 696 rows;
  2025-07-14: similar), and `find_csv_files` processed both → two snapshots per date, the
  partial one degenerate (zombie=0, active_both=all).
- **Fix:** new `dedupe_snapshots()` in `consolidate.py` keeps one snapshot per
  `report_date` — the one with the most `csv_rows` (the complete export). Filename-agnostic,
  so future stray files are handled too. Weekly snapshots went 89 → 86.

## 4. No defensible "apps will hit 1500 on date X" forecast
- The series oscillates hard near the ceiling (1450–1487 for ~8 weeks; week-to-week deltas
  like +103, −77, +71). Recomputes of net adds disagree (+6 vs +37 over 4wk depending on
  raw vs de-duped series).
- A fabricated "ceiling by ~June 20–27" forecast was caught and killed.
- **Action:** frame as **"held near the ceiling (~1,487/1,500) for roughly two months"** —
  honest and stronger than a fake countdown. No forecast date.

## 5. Verified-correct numbers to use
- Search growth since first snapshot (2024-07-22, `total_searches` = **491,842**) to
  2026-06-15 (**45,752,798**) = **~93×** (not 85×).
- YoY search growth ≈ **5.8×–7.8×** (not 9×). Round down, don't round up.
- 6 consecutive clean weeks of rising searches (40.5M → 45.8M), all post-May-reset — this
  streak is real and boundary-clean.
- `age_distribution.12mo_plus` = 774 of 1,487 active = **52%** (maturity milestone, fires once).

## 6. Prod-only vs combined ambiguity (contract question, not a bug)
- Quota math uses **production parent only** (45.75M searches = 61% of 75M). Staging shows a
  separate **73.7M** billable searches. Combined = 119.5M = 159% — **blocked** pending a
  contract answer: does staging count against the 75M annual quota, and are these counters
  cumulative-since-2024 or annual-term? Do not publish combined exposure until resolved.
