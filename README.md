# Adobe OEM Analytics Dashboard

Internal dashboard for monitoring Algolia usage under the Adobe OEM partnership (SO-006716). Tracks application growth, record/search consumption, quota runway, and portfolio health across weekly Hex report exports.

## Local Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd adobe-oem-dashboard
npm install

# 2. Create .env.local with the path to your CSV reports folder
cp .env.example .env.local
# Edit .env.local and set REPORTS_DIR to the Google Drive folder containing Hex CSVs

# 3. Run the consolidation script once to generate the data file
npm run process

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Weekly Workflow

1. Download the latest weekly CSV from Hex into the Google Drive reports folder (the path configured in `REPORTS_DIR`).
2. Open the dashboard in your browser.
3. Click the **Update Data** button in the top-right header. This re-runs the consolidation script against the reports folder and reloads the dashboard with fresh data.

That's it. No file watchers, no auto-refresh. The dashboard loads data once on page load, and you manually trigger updates when new CSVs are available.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run process` | Run `scripts/consolidate.py` against `$REPORTS_DIR` to regenerate `data/adobe_oem_consolidated.json` |

## Project Structure

- `src/components/` -- Dashboard UI components (React + Recharts)
- `src/lib/` -- Data loading, type definitions, formatting utilities
- `src/app/api/data/` -- API route serving the consolidated JSON
- `src/app/api/update/` -- API route that triggers consolidation (local dev only, requires `REPORTS_DIR`)
- `scripts/consolidate.py` -- Python script that processes raw Hex CSVs into a single consolidated JSON
- `data/` -- Output directory for the consolidated JSON file

## Deployment

Deployed on Vercel. The `Update Data` button is hidden in production (Vercel) since `REPORTS_DIR` is not set. To update production data, run `npm run process` locally and commit the updated `data/adobe_oem_consolidated.json`.
