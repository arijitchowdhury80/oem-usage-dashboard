#!/bin/bash
# ═══════════════════════════════════════════════════════
# Adobe OEM Dashboard — Data Update Script
#
# Run this whenever new CSVs are added to the Reports folder.
# Can also be attached as a macOS Folder Action on the folder.
#
# Usage:
#   ./scripts/update.sh
#
# What it does:
#   1. Runs consolidate.py against the Reports folder
#   2. Moves output to data/
#   3. Optionally commits + pushes to GitHub (triggers Vercel redeploy)
# ═══════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="/Users/arijitchowdhury/Library/CloudStorage/GoogleDrive-arijit.chowdhury@algolia.com/My Drive/Partners/Adobe/Data/Reports Sent to Adobe"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Adobe OEM Dashboard — Data Update"
echo "  $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_DIR"

# 1. Run consolidation
echo "[1/3] Consolidating CSVs..."
python3 scripts/consolidate.py "$REPORTS_DIR"

# 2. Move output to data/
if [ -f "$PROJECT_DIR/adobe_oem_consolidated.json" ]; then
    mv "$PROJECT_DIR/adobe_oem_consolidated.json" "$PROJECT_DIR/data/adobe_oem_consolidated.json"
    echo ""
    echo "[2/3] Data file updated: data/adobe_oem_consolidated.json"
else
    echo "[2/3] ERROR: consolidation output not found"
    exit 1
fi

# 3. Ask about git push
echo ""
read -p "[3/3] Push to GitHub (updates Vercel)? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add data/adobe_oem_consolidated.json
    git commit -m "data: update consolidated JSON — $(date +%Y-%m-%d)"
    git push
    echo ""
    echo "✓ Pushed to GitHub. Vercel will redeploy in ~30 seconds."
else
    echo "Skipped git push. Run manually: git add data/ && git commit -m 'update' && git push"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
