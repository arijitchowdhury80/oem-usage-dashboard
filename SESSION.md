# SESSION — Adobe OEM Dashboard

## Status (2026-07-07)
Hex child-app detail is **DONE and LIVE**: two auto-updating tables (Production + Staging, each with `app_id` + downloadable CSV) on the Hex report's **Month-over-Month Usage** tab; the standalone App Detail tab is deleted; published and verified on the live app. Weekly email is on the combined term-relative basis. New repo scripts are on disk but **untracked (not committed)**.

## Resume action (do this next session, in order)
1. Confirm nothing regressed: open `https://app.hex.tech/ec8d7adc-d435-47ec-841b-ff2cff6432a3/app/Adobe-OEM-Usage-7DRNx1Y3TVEa4DKwNpXZaf/latest?tab=month-over-month-usage`, scroll to the bottom — two tables ("Production child apps", "Staging child apps") should render.
2. Ask Arijit whether to **commit** the untracked scripts (`git add scripts/hex-child-app-detail.sql scripts/draft-staging-note.js scripts/hex-staging-apps.sql scripts/update-adobe.sh docs/hex-app-review-for-michael.md`). Do not push to `main` without an explicit yes.
3. Staging over-consumption: the Gmail draft to Adobe exists but is **not sent** — help Arijit schedule the 30-min meeting; he sends when ready.

## Where we stopped (exact)
End of a long Hex-editing session. Final action was `/persist`. The Hex report was published (green, no errors) and the live `/app/.../latest` Month-over-Month tab was visually verified to show both tables (Production top `GTH4AUT0Y6` 6,447,429 / 1,727 rows; Staging top `HZ9GMWFEDD` 40,257,032 / 144 rows).

## Decisions locked
- Child-app detail = **two separate no-input tables** (not an interactive dropdown, not one combined table). Reason: a dropdown feeding a single cell via `{{ }}` does NOT bind on Hex's published app-run (proven 4 ways); no-input dataframe cells publish cleanly and auto-refresh weekly.
- Both tables read the report's materialised dataframe `stage_prod_adobe_child_apps` → they refresh on every weekly run like the other tables.
- Billing basis for email/report = **combined (prod+staging) term-relative** (search = combined lifetime − Feb-2026 baseline 68,412,433, ÷ 75M).
- Cell → app-tab assignment is the per-cell **"ADD TO TABS"** icon (cell top-right toolbar), NOT the "…" → "Add to section" (that's notebook grouping). Deleting a tab does not delete its cells.

## Remaining work
- Schedule the Adobe meeting on staging over-consumption (email drafted, not sent).
- Commit the untracked repo scripts (awaiting Arijit's yes).
- (Optional) Michael one-pager critique of the Hex app is written at `docs/hex-app-review-for-michael.md` — hand over if/when appropriate.

## Reference files
- `scripts/hex-child-app-detail.sql` — the two live SQL queries (Production `EX9JOVML7S` / Staging `J50O6J0MJP`), with the Hex lessons documented.
- `scripts/render-email.js` — weekly email renderer (combined term-relative).
- `scripts/draft-staging-note.js` — one-off Gmail draft to Adobe (not sent).
- `data/adobe_oem_consolidated.json` — consolidated weekly data.
- `src/components/Dashboard.tsx` — Vercel dashboard.
- Vault: `Projects/Adobe-OEM/index.md` + `log.md`; memory `hex-published-input-binding.md`.

## What has NOT been done (guard against false completion)
- The staging over-consumption email is **NOT sent** (only a Gmail draft exists).
- The new scripts are **NOT committed** and **NOT pushed** to `main`.
- No Adobe meeting is booked yet.
- No changes were made to the Vercel dashboard or the weekly email this session — only the Hex report.

## Files written this session
- Hex report (live): SQL 146 (Production table), SQL 148 (Staging table), 2 heading cells, all on the Month-over-Month Usage tab; App Detail tab deleted; published.
- `scripts/hex-child-app-detail.sql` (synced to live, two-table version).
- Vault: `Projects/Adobe-OEM/index.md`, `Projects/Adobe-OEM/log.md`, `Projects/AI-OS/My-Projects.md` (Adobe OEM entry), `wiki/hot.md`, `wiki/log.md`.
- Memory: `session_pointer.md`, `project-tracker-status.md`, `MEMORY.md`, `hex-published-input-binding.md`.
