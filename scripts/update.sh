#!/bin/bash
# ═══════════════════════════════════════════════════════
# Adobe OEM Dashboard — Weekly Update Pipeline
#
# Run this whenever new CSVs are added to the Reports folder.
#
# Usage:
#   ./scripts/update.sh
#
# What it does:
#   1. Consolidates all CSVs → data/adobe_oem_consolidated.json
#   2. Pushes to GitHub → triggers Vercel redeploy
#   3. Creates a Gmail draft with quota summary + CSV attachment
# ═══════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/Partners/Adobe/Data/Reports Sent to Adobe"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Adobe OEM Dashboard — Weekly Update Pipeline"
echo "  $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_DIR"

# ── Step 1: Consolidate CSVs ──
echo "[1/4] Consolidating CSVs..."
python3 scripts/consolidate.py "$REPORTS_DIR"

if [ -f "$PROJECT_DIR/adobe_oem_consolidated.json" ]; then
    mv "$PROJECT_DIR/adobe_oem_consolidated.json" "$PROJECT_DIR/data/adobe_oem_consolidated.json"
    echo ""
    echo "  ✓ Data file updated"
else
    echo "  ✗ ERROR: consolidation output not found"
    exit 1
fi

# ── Step 2: Push to GitHub ──
echo ""
read -p "[2/4] Push to GitHub (updates Vercel)? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add data/adobe_oem_consolidated.json
    git commit -m "data: update consolidated JSON — $(date +%Y-%m-%d)"
    git push
    echo "  ✓ Pushed. Vercel redeploys in ~30s."
else
    echo "  Skipped."
fi

# ── Step 3: Create Gmail draft ──
echo ""
read -p "[3/4] Create Gmail draft with report? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    REPORTS_DIR="$REPORTS_DIR" node scripts/draft-email.js
else
    echo "  Skipped. Run manually: REPORTS_DIR=\"$REPORTS_DIR\" node scripts/draft-email.js"
fi

# ── Done ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pipeline complete."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
