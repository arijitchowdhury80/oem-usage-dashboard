# SESSION — Adobe OEM Dashboard

## Status
Email template updated to **combined term-relative** basis. Jul 6 data consolidated. Changes committed locally — push pending user confirmation.

## Resume Action
1. Read this file
2. Check if new week's data has been added to the Google Drive reports folder
3. If new data: run `./scripts/update.sh` from project root
4. Create Gmail draft: `REPORTS_DIR="/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/Partners/Adobe/Data/Reports Sent to Adobe" node scripts/draft-email.js`
5. Always verify email numbers against the hex PDF + raw CSV from the same week's folder before sending

## Where We Stopped (Exact)
- Email template (`scripts/render-email.js`) uses combined term-relative basis
- Jul 6 numbers verified against CSV + hex PDF: Search 78.8%, Records 68.8%, Apps 91.5%
- "Full-term projection" line removed per user request (still removed)
- Vercel build errors fixed earlier (Dashboard.tsx: `sortFn` dep, apostrophe escape)
- CLAUDE.md and memory updated to reflect combined term-relative basis
- **Local commits exist but have NOT been pushed to main** — user confirmation needed

## Decisions Locked This Session
1. **Email basis = combined term-relative** — search = (prod+staging lifetime) minus Feb 2026 baseline / 75M; records = combined / 50M; apps = prod-only / 1,500. Hex "Parent Application" tab shows lifetime prod-only (63.64%) — that's a different view, NOT the one we report.
2. **"Full-term projection" line removed** — user explicitly requested removal (prior session, still in effect)
3. **Staging visibility** — email shows staging share of search burn (69% as of Jul 6) and footprint table breaks out prod vs staging

## Remaining Work
- Push to main (needs user's explicit yes)
- Gmail draft for Jul 6 report not yet created
- Email redesign spec items still outstanding (P1/P2): two-year arc microbars, recognition mechanic, capacity/renewal CTA, GenStudio detector — user has not prioritized these

## Files Written/Modified This Session
- `scripts/render-email.js` — rewritten computeModel to combined term-relative basis; updated email body sections
- `CLAUDE.md` — updated Critical Rule from "lifetime prod-only" to "combined term-relative"

## Reference Files
- `scripts/render-email.js` — email body renderer
- `scripts/draft-email.js` — Gmail draft creator (wires render-email into Gmail API)
- `scripts/consolidate.py` — CSV → consolidated JSON pipeline
- `scripts/update.sh` — full pipeline orchestrator
- `data/adobe_oem_consolidated.json` — consolidated data (88 snapshots through Jul 6)
- `src/lib/contracts.ts` — contract quotas + term baselines
- Hex PDF: in Google Drive `Reports Sent to Adobe/Adobe-oem-usage-DD-Month-YYYY/` folder
