# Adobe OEM Analytics Dashboard — v1.0

Internal analytics dashboard for the Algolia × Adobe OEM partnership. Tracks application growth, record/search consumption, quota runway, and portfolio health across 1,400+ child applications under two parent billing accounts.

**Live:** [oem-usage-dashboard.vercel.app](https://oem-usage-dashboard.vercel.app)
**Contract:** SO Q-47553 · Feb 2026 – Jan 2027
**Data source:** Weekly CSV exports from Hex (Redshift) + billing summary from `stage_prod_parent_agg_stat`

---

## Dashboard Tabs

### Tab 1 — Executive Summary
- **Narrative banner** — auto-generated 4-sentence summary of what changed and what matters
- **Quota gauges** — Apps (1,500), Records (50M), Searches (75M) with ceiling dates
- **Production vs Staging** — side-by-side comparison using billing system data (parent IDs, apps, records, searches, provisioned/deleted, retention/churn)
- **Engagement Health** — interactive donut + trend chart. Click any status (Active, Records-only, Search-only, Zombie) to expand full app list with CSV download
- **App Types** — naming convention breakdown (Base, nonprod-shared, cmprd-genstudio, cmstg-genstudio, Legacy)
- **Partnership KPIs** — Top App Share, Empty Index Apps, Zombie Apps — each with 6-month sparkline

### Tab 2 — Trends & Growth
- Time range toggle (6m / 12m / All)
- Application growth + projection chart with quota reference line
- Records trajectory + projection with quota reference line
- Concentration trend (top-10 share declining over time)
- Sortable month-over-month table

### Tab 3 — Portfolio Health
- **Top 10 by Records** — with share bars, search ratio, CSV download
- **Top 10 by Search Volume** — with distribution bars, CSV download
- **Child App table** — all 1,425 apps with:
  - Production / Staging parent toggle
  - Tag filter pills (Base, NonProd, GenStudio, etc.)
  - Paginated (50 per page) with sortable columns
  - MoM deltas for records and searches
  - CSV download for filtered results
  - Staging parent billing summary view

### Tab 4 — R&D Brief
- Static page proposing parent-level aggregation API to Algolia R&D
- Problem statement, business case, 4 proposed endpoints with JSON schemas

---

## Data Pipeline

### Billing Methodology
The consolidation script uses Algolia's billing methodology:
- **Records:** `max_monthly_record_usage` (4th-highest-day, excludes top 3 spike days)
- **Apps:** `period_end_live_apps` from billing system (excludes parent app IDs)
- **Searches:** `billable_search_requests` cumulative from billing period start
- **Source of truth:** When `stage_prod_parent_agg_stat*.csv` exists in the same folder as the weekly CSV, its numbers override computed totals — exact match with Hex

### Parent Architecture
- **Production parent** (EX9JOVML7S): 1,425 child apps — all individual app data available
- **Staging parent** (J50O6J0MJP): 90 apps — billing aggregates only, individual app data not in weekly CSV

### App Naming Convention (within production parent)
| Tag | Pattern | Description |
|-----|---------|-------------|
| Base | `cm-p{project}-e{env}` | Production AEM content indices |
| nonprod-shared | `cm-p{project}-e{env}-nonprod-shared` | Non-production environments |
| cmprd-genstudio | `cm-p{project}-e{env}-cmprd-genstudio` | GenStudio for Performance Marketing |
| cmstg-genstudio | `cm-p{project}-e{env}-cmstg-genstudio` | GenStudio staging |
| Legacy | Various | Pre-Cloud Manager apps (AEM Assets POC, Adobe-GMO, etc.) |

---

## Local Setup

```bash
# 1. Clone and install
git clone https://github.com/arijitchowdhury80/oem-usage-dashboard.git
cd oem-usage-dashboard
npm install

# 2. Create .env.local
cp .env.example .env.local
# Edit REPORTS_DIR to point to your Google Drive reports folder

# 3. Run initial consolidation
npm run process

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Weekly Data Update

1. Download the weekly CSV from Hex into the Google Drive reports folder
2. Also download the `stage_prod_parent_agg_stat` CSV into the same dated subfolder
3. Run the update script:
```bash
./scripts/update.sh
```
This consolidates all CSVs, updates the JSON, and optionally pushes to GitHub (triggering Vercel redeploy).

Alternatively, open the dashboard locally and click **Update Data** in the header.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run process` | Run consolidation against `$REPORTS_DIR` |
| `./scripts/update.sh` | One-click: consolidate + move JSON + optionally git push |

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/data/route.ts        # Serves consolidated JSON
│   │   ├── api/update/route.ts      # Triggers consolidation (local only)
│   │   ├── globals.css              # Algolia-branded styles (Sora font)
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Dashboard entry point
│   ├── components/
│   │   ├── Dashboard.tsx            # Main dashboard (4 tabs, all sections)
│   │   ├── RDBrief.tsx              # R&D API Brief page
│   │   ├── Gauge.tsx                # Radial quota gauge
│   │   ├── KPI.tsx                  # KPI card with sparkline
│   │   ├── ChartTooltip.tsx         # Shared chart tooltip
│   │   └── MiniBar.tsx              # Inline share bar
│   └── lib/
│       ├── contracts.ts             # Contract constants + parent app IDs
│       ├── data.ts                  # Data loading + transformation
│       ├── formatters.ts            # Number formatting (K/M/B)
│       └── types.ts                 # TypeScript interfaces
├── scripts/
│   ├── consolidate.py               # CSV → JSON consolidation (billing-aligned)
│   ├── update.sh                    # One-click data refresh
│   └── watcher.js                   # File watcher (Phase 2, not active)
├── data/
│   └── adobe_oem_consolidated.json  # Generated data file
└── public/
    ├── algolia-logo.svg             # White Algolia wordmark
    ├── algolia-mark.svg             # Algolia mark (blue)
    └── favicon.svg                  # Browser tab icon
```

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS + custom CSS with Algolia brand tokens
- **Charts:** Recharts
- **Font:** Sora (Google Fonts)
- **Data processing:** Python 3 (consolidation script)
- **Deployment:** Vercel (auto-deploy from GitHub main branch)

## Design Principles

- **Sticky header + tabs** — always visible, content scrolls underneath
- **Billing source of truth** — headline numbers match Hex exactly via `stage_prod_parent_agg_stat`
- **Interactive engagement** — click donut/legend to drill into app lists, download CSV
- **Resizable columns** — drag column borders in any table
- **Sortable tables** — click any column header to sort asc/desc
- **Paginated tables** — 50 rows per page with navigation
- **No data repetition** — each metric appears once, in the most appropriate context

---

*Built by Arijit Chowdhury · Algolia Strategic Partnerships · April 2026*
