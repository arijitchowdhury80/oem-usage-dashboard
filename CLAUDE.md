# Adobe OEM Dashboard — Project Instructions

## What This Is
Weekly Adobe OEM usage reporting: data pipeline (CSV → JSON), Next.js dashboard (Vercel), and HTML email with Gmail draft automation.

## Critical Rule
Email numbers use **combined (prod+staging) term-relative** basis: search = (combined lifetime) minus Feb 2026 baseline (68,412,433), divided by 75M; records = combined / 50M; apps = prod-only / 1,500. Verify against hex PDF and raw CSV every week before sending.

## Resume
Read `SESSION.md` for current state and next actions.

## Key Paths
- Pipeline: `scripts/update.sh` (consolidate → push → draft)
- Email renderer: `scripts/render-email.js` (preview: `node scripts/render-email.js`)
- Data: `data/adobe_oem_consolidated.json`
- Source CSVs: `~/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/Partners/Adobe/Data/Reports Sent to Adobe/`
- Dashboard: `src/components/Dashboard.tsx`

## Contract (Q-47553)
- Term: Feb 2026 – Jan 2027
- Quotas: 75M search, 50M records, 1,500 apps
- Prod parent: EX9JOVML7S | Staging parent: J5OO6J0MJP

## Constraints
- Email HTML must be table-based + inline styles only (Gmail/Outlook safe)
- No "Full-term projection" line in email (explicitly removed by user)
- Numbers cross-checked against hex PDF before any send
