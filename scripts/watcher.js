const chokidar = require('chokidar');
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const REPORTS_DIR = process.env.REPORTS_DIR;
const CONSOLIDATE = path.resolve(__dirname, 'consolidate.py');
const DATA_OUT = path.resolve(__dirname, '..', 'data', 'adobe_oem_consolidated.json');

if (!REPORTS_DIR) {
  console.error('REPORTS_DIR not set in .env.local');
  process.exit(1);
}

console.log(`[watcher] Watching: ${REPORTS_DIR}`);
console.log(`[watcher] Output:   ${DATA_OUT}`);

function runConsolidation() {
  try {
    console.log(`[${new Date().toISOString()}] Running consolidation...`);
    execSync(`python3 "${CONSOLIDATE}" "${REPORTS_DIR}"`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log(`[${new Date().toISOString()}] Consolidation complete.`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Consolidation failed:`, e.message);
  }
}

// Run once on startup
runConsolidation();

// Watch for new CSVs
const watcher = chokidar.watch(`${REPORTS_DIR}/**/*.csv`, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 10000,
    pollInterval: 1000,
  },
  ignoreInitial: true,
});

watcher.on('add', (filePath) => {
  const filename = path.basename(filePath);

  if (filename.startsWith('stage_prod_parent_agg')) return;

  console.log(`[${new Date().toISOString()}] New CSV detected: ${filename}`);
  runConsolidation();
});

watcher.on('error', (error) => {
  console.error('[watcher] Error:', error.message);
});

console.log('[watcher] Ready. Waiting for new CSV files...');
