#!/usr/bin/env node
/**
 * Adobe OEM Weekly Report — Gmail Draft Creator
 *
 * Reads consolidated JSON, generates an email matching the format Arijit
 * currently sends manually, attaches CSV + PDF, saves as Gmail draft.
 *
 * Usage: REPORTS_DIR="..." node scripts/draft-email.js
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { getAuthClient } = require('./gmail-auth');
// No screenshot needed — email body is pure HTML

const PROJECT_DIR = path.resolve(__dirname, '..');
const DATA_PATH = path.join(PROJECT_DIR, 'data', 'adobe_oem_consolidated.json');
const REPORTS_DIR = process.env.REPORTS_DIR || '';
const DASHBOARD_URL = 'https://oem-usage-dashboard.vercel.app';

// ── Recipients ──
const TO = [
  'Riya Midha <rmidha@adobe.com>',
  'Dom LaCava <dlacava@adobe.com>',
  'Siddharth Sahni <ssahni@adobe.com>',
  'Marie Knight <marie@adobe.com>',
  'Satinder Chhatwal <chhatwal@adobe.com>',
  'Kaushal Mall <kmall@adobe.com>',
  'Piyush Singhal <psinghal@adobe.com>',
  'amiarora@adobe.com',
  'mohitar@adobe.com',
  'somyaj@adobe.com',
  'apogupta@adobe.com',
  'Aman Kumar Gupta <amkumarg@adobe.com>',
].join(', ');

const CC = [
  'Mike Davis <mike.davis@algolia.com>',
  'michael.davis@algolia.com',
  'Jake Edmonds <jake.edmonds@algolia.com>',
  'Piyush Patel <piyush.patel@algolia.com>',
  'Debanshi Bheda <debanshi.bheda@algolia.com>',
].join(', ');

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function findLatestFolder() {
  if (!REPORTS_DIR || !fs.existsSync(REPORTS_DIR)) return null;

  const dirs = fs.readdirSync(REPORTS_DIR)
    .filter(d => fs.statSync(path.join(REPORTS_DIR, d)).isDirectory())
    .map(d => ({ name: d, mtime: fs.statSync(path.join(REPORTS_DIR, d)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  return dirs.length > 0 ? path.join(REPORTS_DIR, dirs[0].name) : null;
}

function findFileInFolder(folder, extension, excludePrefix) {
  if (!folder) return null;
  const files = fs.readdirSync(folder).filter(f => {
    if (!f.toLowerCase().endsWith(extension)) return false;
    if (excludePrefix && excludePrefix.some(p => f.startsWith(p))) return false;
    return true;
  });
  return files.length > 0 ? { path: path.join(folder, files[0]), name: files[0] } : null;
}

function buildEmailBody(latest, billing) {
  const prod = billing?.prod;
  const stage = billing?.staging;
  const apps = prod ? prod.period_end_live_apps : latest.totals.active_apps;
  const records = prod ? prod.billable_records : latest.totals.latest_records;
  const searches = prod ? prod.billable_search_requests : latest.totals.total_searches;

  const appsPct = (apps / 1500 * 100).toFixed(1);
  const recsPct = (records / 50000000 * 100).toFixed(1);
  const srchPct = (searches / 75000000 * 100).toFixed(1);

  const reportDate = new Date(latest.report_date);
  const dateStr = reportDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const barColor = (pct) => parseFloat(pct) >= 85 ? '#dc2626' : parseFloat(pct) >= 70 ? '#d97706' : '#16a34a';
  const statusText = (pct) => parseFloat(pct) >= 85 ? 'CRITICAL' : parseFloat(pct) >= 70 ? 'WARNING' : 'HEALTHY';
  const appsPctNum = apps / 1500 * 100;

  // Engagement
  const eng = [
    { label: 'Active', count: latest.engagement.active_both, color: '#16a34a' },
    { label: 'Records only', count: latest.engagement.records_no_search, color: '#d97706' },
    { label: 'Search only', count: latest.engagement.search_no_records, color: '#8b5cf6' },
    { label: 'Zombie', count: latest.engagement.zombie, color: '#dc2626' },
  ];
  const engTotal = eng.reduce((s, e) => s + e.count, 0);

  // Staging info line
  const stageApps = stage ? stage.period_end_live_apps : 0;
  const stageRec = stage ? fmt(stage.billable_records) : '—';
  const stageSrch = stage ? fmt(stage.billable_search_requests) : '—';

  function quotaRow(label, pct, current, quota, color, prodVal, stageVal) {
    const w = Math.min(parseFloat(pct), 100);
    return `
    <tr><td style="padding:14px 0;border-bottom:1px solid #f3f4f6">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;font-weight:600;color:#36395A">${label}</td>
        <td style="text-align:right"><span style="font-size:18px;font-weight:700;color:${color}">${pct}%</span> <span style="font-size:12px;color:#7778AF">${fmt(current)} / ${fmt(quota)}</span></td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px"><tr>
        <td style="background:#e5e7eb;border-radius:4px;height:6px;padding:0">
          <table width="${w}%" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${color};border-radius:4px;height:6px"></td>
          </tr></table>
        </td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px"><tr>
        <td style="font-size:11px;color:#7778AF">Prod: ${prodVal}</td>
        <td style="font-size:11px;color:#7778AF;text-align:right">Stage: ${stageVal}</td>
      </tr></table>
    </td></tr>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff">

<!-- HEADER -->
<tr><td style="padding:16px 20px;text-align:center;border-bottom:1px solid #e5e7eb">
  <div style="font-size:10px;font-weight:600;color:#9698C3;text-transform:uppercase;letter-spacing:1.5px">Adobe × Algolia Usage Report</div>
  <div style="font-size:14px;font-weight:600;color:#000033;margin-top:4px">Data as of ${dateStr}</div>
</td></tr>

<!-- ALERT -->
${appsPctNum >= 85 ? `
<tr><td style="padding:12px 20px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px"><tr>
    <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#dc2626">${apps.toLocaleString()} of 1,500 apps — ${appsPct}% of quota</td>
  </tr></table>
</td></tr>
` : ''}

<!-- QUOTA BARS WITH PROD/STAGE SPLIT -->
<tr><td style="padding:12px 20px">
  <table width="100%" cellpadding="0" cellspacing="0">
    ${quotaRow('Applications', appsPct, apps, 1500, barColor(appsPct), prod ? prod.period_end_live_apps.toLocaleString() : fmt(apps), stageApps.toString())}
    ${quotaRow('Records', recsPct, records, 50000000, barColor(recsPct), prod ? fmt(prod.billable_records) : fmt(records), stageRec)}
    ${quotaRow('Searches', srchPct, searches, 75000000, barColor(srchPct), prod ? fmt(prod.billable_search_requests) : fmt(searches), stageSrch + ' ⚠')}
  </table>
</td></tr>

<!-- APP HEALTH -->
<tr><td style="padding:8px 20px 14px">
  <div style="font-size:10px;font-weight:600;color:#9698C3;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">App Health</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${eng.map(e => {
      const pct = engTotal > 0 ? ((e.count / engTotal) * 100).toFixed(0) : '0';
      return `<tr>
        <td style="padding:5px 0;font-size:12px;color:#36395A"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${e.color};margin-right:6px;vertical-align:middle"></span>${e.label}</td>
        <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:600;color:#000033">${e.count.toLocaleString()}</td>
        <td style="padding:5px 0;text-align:right;font-size:11px;color:#7778AF;width:35px">${pct}%</td>
      </tr>`;
    }).join('')}
  </table>
</td></tr>

<!-- BILLING BREAKDOWN -->
${prod && stage ? `
<tr><td style="padding:8px 20px 14px">
  <div style="font-size:10px;font-weight:600;color:#9698C3;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Billing by Parent</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px">
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 0;font-weight:600;color:#484C7A"></td>
      <td style="padding:6px 0;font-weight:600;color:#484C7A;text-align:right">Apps</td>
      <td style="padding:6px 0;font-weight:600;color:#484C7A;text-align:right">Records</td>
      <td style="padding:6px 0;font-weight:600;color:#484C7A;text-align:right">Searches</td>
    </tr>
    <tr>
      <td style="padding:5px 0;color:#003DFF;font-weight:600">Production</td>
      <td style="padding:5px 0;text-align:right;color:#000033">${prod.period_end_live_apps.toLocaleString()}</td>
      <td style="padding:5px 0;text-align:right;color:#000033">${fmt(prod.billable_records)}</td>
      <td style="padding:5px 0;text-align:right;color:#000033">${fmt(prod.billable_search_requests)}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;color:#d97706;font-weight:600">Staging</td>
      <td style="padding:5px 0;text-align:right;color:#000033">${stage.period_end_live_apps}</td>
      <td style="padding:5px 0;text-align:right;color:#000033">${fmt(stage.billable_records)}</td>
      <td style="padding:5px 0;text-align:right;color:#d97706">${fmt(stage.billable_search_requests)} ⚠</td>
    </tr>
    <tr style="border-top:1px solid #e5e7eb">
      <td style="padding:5px 0;font-weight:700;color:#000033">Total</td>
      <td style="padding:5px 0;text-align:right;font-weight:700;color:#000033">${(prod.period_end_live_apps + stage.period_end_live_apps).toLocaleString()}</td>
      <td style="padding:5px 0;text-align:right;font-weight:700;color:#000033">${fmt(prod.billable_records + stage.billable_records)}</td>
      <td style="padding:5px 0;text-align:right;font-weight:700;color:#000033">${fmt(prod.billable_search_requests + stage.billable_search_requests)}</td>
    </tr>
  </table>
</td></tr>
` : ''}

<!-- KEY METRICS -->
<tr><td style="padding:8px 20px 14px">
  <div style="font-size:10px;font-weight:600;color:#9698C3;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Key Metrics</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#36395A">Top App Record Share</td>
      <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:600;color:#d97706">${latest.totals.latest_records > 0 ? ((latest.top15_by_records[0]?.records || 0) / latest.totals.latest_records * 100).toFixed(1) : 0}%</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#36395A;border-top:1px solid #f3f4f6">Top 10 Concentration</td>
      <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:600;color:#484C7A;border-top:1px solid #f3f4f6">${latest.concentration.top10_records_pct}%</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#36395A;border-top:1px solid #f3f4f6">Empty Index Apps</td>
      <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:600;color:#dc2626;border-top:1px solid #f3f4f6">${latest.engagement.search_no_records.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#36395A;border-top:1px solid #f3f4f6">Zombie Apps</td>
      <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:600;color:#dc2626;border-top:1px solid #f3f4f6">${latest.engagement.zombie.toLocaleString()}</td>
    </tr>
  </table>
</td></tr>

<!-- DASHBOARD CTA -->
<tr><td style="padding:16px 20px;text-align:center;border-top:1px solid #f3f4f6">
  <div style="font-size:10px;font-weight:600;color:#9698C3;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">More in the Dashboard</div>
  <div style="font-size:12px;color:#484C7A;margin-bottom:14px;line-height:1.5">
    Interactive trend charts · Engagement drill-down with CSV export · 1,425 child app details · App naming tag breakdown · Production vs staging deep dive
  </div>
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://oem-usage-dashboard.vercel.app" style="height:40px;v-text-anchor:middle;width:220px;" arcsize="15%" strokecolor="#003DFF" fillcolor="#003DFF">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Open Dashboard →</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-->
  <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;background:#003DFF;color:#ffffff;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;mso-hide:all">Open Dashboard →</a>
  <!--<![endif]-->
</td></tr>

<!-- ATTACHMENTS -->
<tr><td style="padding:8px 20px;text-align:center;font-size:11px;color:#7778AF">
  CSV and PDF reports attached.
</td></tr>

<!-- SIGN OFF -->
<tr><td style="padding:14px 20px;font-size:13px;color:#36395A">
  Happy to jump on a call if anything needs discussion.<br><br>Arijit
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:10px 20px;text-align:center;font-size:9px;color:#9698C3;border-top:1px solid #f3f4f6">
  Adobe OEM Analytics · Algolia Strategic Partnerships
</td></tr>

</table>
</body></html>`;
}


function createMimeMessage({ to, cc, subject, htmlBody, inlineImages, attachments }) {
  const bMixed = 'boundary_mixed_' + Date.now();
  const bRelated = 'boundary_related_' + Date.now();
  const lines = [];

  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  lines.push(`Subject: ${subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/mixed; boundary="${bMixed}"`);
  lines.push('');

  // Part 1: multipart/related (HTML body + inline images)
  lines.push(`--${bMixed}`);
  lines.push(`Content-Type: multipart/related; boundary="${bRelated}"`);
  lines.push('');

  // HTML body
  lines.push(`--${bRelated}`);
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: 7bit');
  lines.push('');
  lines.push(htmlBody);
  lines.push('');

  // Inline images
  for (const img of (inlineImages || [])) {
    const b64 = fs.readFileSync(img.path).toString('base64');
    lines.push(`--${bRelated}`);
    lines.push(`Content-Type: ${img.mimeType}`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push(`Content-ID: <${img.cid}>`);
    lines.push(`Content-Disposition: inline; filename="${img.filename}"`);
    lines.push('');
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.slice(i, i + 76));
    }
    lines.push('');
  }

  lines.push(`--${bRelated}--`);
  lines.push('');

  // File attachments
  for (const att of (attachments || [])) {
    const b64 = fs.readFileSync(att.path).toString('base64');
    lines.push(`--${bMixed}`);
    lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
    lines.push('');
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.slice(i, i + 76));
    }
    lines.push('');
  }

  lines.push(`--${bMixed}--`);
  return lines.join('\r\n');
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Adobe OEM Weekly Report — Gmail Draft Creator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Load data
  if (!fs.existsSync(DATA_PATH)) {
    console.error('ERROR: No consolidated data found. Run consolidation first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const latest = data.weekly_snapshots
    .filter(s => s.totals.latest_records > 0)
    .sort((a, b) => b.report_date.localeCompare(a.report_date))[0];

  if (!latest) {
    console.error('ERROR: No valid snapshots in data.');
    process.exit(1);
  }

  const billing = latest.billing || null;
  const prod = billing?.prod;
  const apps = prod ? prod.period_end_live_apps : latest.totals.active_apps;

  const reportDate = new Date(latest.report_date);
  const dateStr = reportDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  console.log(`Data through: ${dateStr}`);
  console.log(`Apps: ${apps} | Records: ${fmt(prod?.billable_records || latest.totals.latest_records)} | Searches: ${fmt(prod?.billable_search_requests || latest.totals.total_searches)}`);
  console.log(`Billing source: ${billing ? 'stage_prod_parent_agg_stat' : 'estimated'}`);
  console.log('');

  // Find attachments in latest folder
  const latestFolder = findLatestFolder();
  const attachments = [];

  if (latestFolder) {
    console.log(`Report folder: ${path.basename(latestFolder)}`);

    const csv = findFileInFolder(latestFolder, '.csv', ['stage_prod_parent_agg', 'last_three_months']);
    if (csv) {
      attachments.push({ path: csv.path, filename: csv.name, mimeType: 'text/csv' });
      console.log(`  CSV: ${csv.name}`);
    }

    const pdf = findFileInFolder(latestFolder, '.pdf', []);
    if (pdf) {
      attachments.push({ path: pdf.path, filename: pdf.name, mimeType: 'application/pdf' });
      console.log(`  PDF: ${pdf.name}`);
    }
  } else {
    console.log('⚠ No report folder found — email will have no attachments.');
  }

  // Build email — pure HTML, no screenshots
  const appsPctNum = apps / 1500 * 100;
  const subject = appsPctNum >= 90
    ? `Adobe<>Algolia usage report - ${dateStr} - (${apps.toLocaleString()}/1500 Apps used)`
    : `Adobe<>Algolia usage report - ${dateStr}`;
  const htmlBody = buildEmailBody(latest, billing);

  console.log(`\nSubject: ${subject}`);
  console.log(`To: ${TO.split(',').length} Adobe recipients`);
  console.log(`Cc: ${CC.split(',').length} Algolia team`);
  console.log(`Attachments: ${attachments.length} files`);
  console.log('');

  // Authenticate
  console.log('Authenticating with Gmail...');
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  // Create MIME message — no inline images, just HTML + file attachments
  const mime = createMimeMessage({ to: TO, cc: CC, subject, htmlBody, inlineImages: [], attachments });
  const raw = Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Create draft
  console.log('Creating Gmail draft...');
  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw },
    },
  });

  const draftId = draft.data.id;

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Draft saved (ID: ${draftId})`);
  console.log(`  Review at: https://mail.google.com/mail/u/0/#drafts`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
