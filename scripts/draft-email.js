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

// ── Observations engine — JS port of src/lib/observations.ts ──
const APPS_QUOTA = 1500;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString('en-US');
}

function formatMonthLabel(ym) {
  const [year, month] = ym.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function pctChange(curr, prior) {
  if (prior === 0) return curr === 0 ? 0 : 100;
  return ((curr - prior) / prior) * 100;
}

function severityFor(absPct) {
  if (absPct >= 20) return 'high';
  if (absPct >= 5) return 'medium';
  return 'low';
}

// Build month points from raw weekly_snapshots (mirrors cleanWeeks + computeMonths)
function buildMonthPoints(raw) {
  const nonZero = raw.weekly_snapshots.filter((s) => s.totals.latest_records > 0);
  const byDate = new Map();
  for (const s of nonZero) {
    const existing = byDate.get(s.report_date);
    if (!existing || s.totals.active_apps > existing.totals.active_apps) byDate.set(s.report_date, s);
  }
  const weeks = Array.from(byDate.values())
    .sort((a, b) => a.report_date.localeCompare(b.report_date));

  // Last snapshot per month
  const byMonth = new Map();
  for (const w of weeks) {
    const existing = byMonth.get(w.report_month);
    if (!existing || w.report_date > existing.report_date) byMonth.set(w.report_month, w);
  }
  return Array.from(byMonth.values())
    .sort((a, b) => a.report_date.localeCompare(b.report_date))
    .map((s) => ({
      month: s.report_month,
      date: s.report_date,
      apps: s.totals.active_apps,
      records: s.totals.latest_records,
      searches: s.totals.total_searches,
      zombie: s.engagement.zombie,
      searchNoRecords: s.engagement.search_no_records,
      c10r: s.concentration.top10_records_pct,
    }));
}

// Build appDetailWithDelta (mirrors loadDashboardData)
function buildAppDetail(raw) {
  const nonZero = raw.weekly_snapshots.filter((s) => s.totals.latest_records > 0);
  const byMonth = new Map();
  for (const s of nonZero) {
    const existing = byMonth.get(s.report_month);
    if (!existing || s.report_date > existing.report_date) byMonth.set(s.report_month, s);
  }
  const monthKeys = Array.from(byMonth.keys()).sort();
  if (monthKeys.length < 1) return [];
  const latest = byMonth.get(monthKeys[monthKeys.length - 1]);
  const prev = monthKeys.length >= 2 ? byMonth.get(monthKeys[monthKeys.length - 2]) : null;

  const prevMap = new Map();
  if (prev?.app_detail) {
    for (const a of prev.app_detail) prevMap.set(a.id, { records: a.records, searches: a.searches });
  }
  return (latest?.app_detail ?? []).map((a) => {
    const p = prevMap.get(a.id);
    return {
      ...a,
      prevRecords: p?.records ?? 0,
      prevSearches: p?.searches ?? 0,
      recDelta: p ? a.records - p.records : a.records,
      searchDelta: p ? a.searches - p.searches : a.searches,
      isNew: !p,
    };
  });
}

function buildFraming(cur, prev) {
  const [year, monthNum] = cur.month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const dayOfMonth = parseInt(cur.date.split('-')[2], 10);
  const inProgress = dayOfMonth < daysInMonth - 5;
  const curLabel = formatMonthLabel(cur.month);
  const prevLabel = formatMonthLabel(prev.month);
  const label = inProgress
    ? `${prevLabel} → ${curLabel} (in progress, day ${dayOfMonth} of ${daysInMonth})`
    : `${prevLabel} → ${curLabel}`;
  return { currentMonth: cur.month, priorMonth: prev.month, currentDate: cur.date, priorDate: prev.date, inProgress, dayOfMonth, daysInMonth, label };
}

function buildMetricObservation(metric, curr, prior, formatter) {
  const fmt2 = formatter || fmtCompact;
  const deltaAbs = curr - prior;
  const deltaPct = pctChange(curr, prior);
  const absPct = Math.abs(deltaPct);
  let kind = 'neutral';
  let verb = 'held flat';
  if (deltaAbs > 0) { kind = 'growth'; verb = absPct >= 25 ? 'spiked' : 'grew'; }
  else if (deltaAbs < 0) { kind = 'decline'; verb = absPct >= 25 ? 'dropped' : 'fell'; }
  const sign = deltaAbs > 0 ? '+' : '';
  const headline = deltaAbs === 0
    ? `${metric} held flat MoM`
    : `${metric} ${verb} by ${fmt2(Math.abs(deltaAbs))} (${sign}${deltaPct.toFixed(1)}%)`;
  return { kind, severity: severityFor(absPct), metric, headline, detail: `${fmt2(prior)} → ${fmt2(curr)}`, current: curr, prior, deltaAbs, deltaPct };
}

function buildGlimmers(cur, prev, appDetail) {
  const out = [];
  const portfolioContracted = cur.apps < prev.apps || cur.records < prev.records;
  if (cur.searches > prev.searches && portfolioContracted) {
    const sp = pctChange(cur.searches, prev.searches);
    out.push({ kind: 'glimmer', severity: 'high', metric: 'Engagement', headline: `Searches up ${sp.toFixed(1)}% even as portfolio contracted`, detail: 'Activity per remaining app is rising — engagement, not just count' });
  }
  if (cur.zombie < prev.zombie) {
    const removed = prev.zombie - cur.zombie;
    out.push({ kind: 'glimmer', severity: removed >= 10 ? 'high' : 'medium', metric: 'Zombie cleanup', headline: `${removed} zombie apps removed since ${formatMonthLabel(prev.month)}`, detail: `${prev.zombie} → ${cur.zombie}` });
  }
  if (cur.c10r > 0 && prev.c10r > 0 && cur.c10r < prev.c10r - 1) {
    out.push({ kind: 'glimmer', severity: 'medium', metric: 'Concentration', headline: `Top-10 record concentration eased to ${cur.c10r}%`, detail: `${prev.c10r}% → ${cur.c10r}% — less single-app dependency` });
  }
  const eligible = (appDetail || []).filter((a) => !a.isNew && a.recDelta > 0 && a.prevRecords > 1000);
  if (eligible.length > 0) {
    const top = [...eligible].sort((a, b) => (b.recDelta / Math.max(b.prevRecords, 1)) - (a.recDelta / Math.max(a.prevRecords, 1)))[0];
    const gp = pctChange(top.records, top.prevRecords);
    if (gp >= 50) {
      out.push({ kind: 'glimmer', severity: 'medium', metric: 'Top grower', headline: `${top.name || top.id} records grew ${gp.toFixed(0)}%`, detail: `${fmtCompact(top.prevRecords)} → ${fmtCompact(top.records)} (+${fmtCompact(top.recDelta)})` });
    }
  }
  return out;
}

function buildConcerns(cur, prev) {
  const out = [];
  if (cur.searchNoRecords > prev.searchNoRecords) {
    const d = cur.searchNoRecords - prev.searchNoRecords;
    out.push({ kind: 'decline', severity: d >= 10 ? 'high' : 'medium', metric: 'Empty-index apps', headline: `${d} more apps searching with no records`, detail: `${prev.searchNoRecords} → ${cur.searchNoRecords} — wasted search calls` });
  }
  const curBurn = (cur.apps / APPS_QUOTA) * 100;
  const prevBurn = (prev.apps / APPS_QUOTA) * 100;
  if (curBurn >= 85 && curBurn > prevBurn) {
    out.push({ kind: 'decline', severity: 'high', metric: 'Apps quota', headline: `Apps quota at ${curBurn.toFixed(1)}% — approaching ceiling`, detail: `${cur.apps.toLocaleString()} of ${APPS_QUOTA.toLocaleString()}` });
  }
  return out;
}

function computeObservations(raw) {
  const months = buildMonthPoints(raw);
  if (months.length < 2) return { framing: null, headlines: [], glimmers: [], concerns: [] };
  const cur = months[months.length - 1];
  const prev = months[months.length - 2];
  const appDetail = buildAppDetail(raw);
  return {
    framing: buildFraming(cur, prev),
    headlines: [
      buildMetricObservation('Apps', cur.apps, prev.apps, (n) => Math.round(n).toLocaleString('en-US')),
      buildMetricObservation('Records', cur.records, prev.records),
      buildMetricObservation('Searches', cur.searches, prev.searches),
    ],
    glimmers: buildGlimmers(cur, prev, appDetail),
    concerns: buildConcerns(cur, prev),
  };
}

function renderObsRow(o) {
  const fg = o.kind === 'decline' ? '#dc2626' : o.kind === 'growth' ? '#16a34a' : o.kind === 'glimmer' ? '#7c3aed' : '#6b7280';
  const bg = o.kind === 'decline' ? '#fef2f2' : o.kind === 'growth' ? '#f0fdf4' : o.kind === 'glimmer' ? '#faf5ff' : '#f9fafb';
  const border = o.kind === 'decline' ? '#fecaca' : o.kind === 'growth' ? '#bbf7d0' : o.kind === 'glimmer' ? '#e9d5ff' : '#e5e7eb';
  const arrow = (o.deltaAbs ?? 0) > 0 ? '↑' : (o.deltaAbs ?? 0) < 0 ? '↓' : '—';
  return `
    <tr><td style="padding:6px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:1px solid ${border};border-radius:6px"><tr>
        <td style="padding:8px 10px;width:18px;font-size:14px;font-weight:700;color:${fg};vertical-align:top">${arrow}</td>
        <td style="padding:8px 10px 8px 0">
          <div style="font-size:13px;font-weight:600;color:#111827;line-height:1.4">${o.headline}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.4">${o.detail}</div>
        </td>
      </tr></table>
    </td></tr>`;
}

function renderObservationsBlock(observations) {
  if (!observations.framing) return '';
  const headlines = observations.headlines.map(renderObsRow).join('');
  const concerns = observations.concerns.map(renderObsRow).join('');
  const glimmersHtml = observations.glimmers.length === 0 ? '' : `
    <tr><td style="padding:8px 0 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px"><tr><td style="padding:10px 12px">
        <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px">✦ Glimmers</div>
        ${observations.glimmers.map((g, i) => `
          <div style="${i === observations.glimmers.length - 1 ? '' : 'margin-bottom:6px'}">
            <div style="font-size:12px;font-weight:600;color:#111827">• ${g.headline}</div>
            <div style="font-size:11px;color:#6b7280;margin-left:10px;margin-top:1px">${g.detail}</div>
          </div>`).join('')}
      </td></tr></table>
    </td></tr>`;
  const labelColor = observations.framing.inProgress ? '#d97706' : '#7778AF';
  const labelWeight = observations.framing.inProgress ? 600 : 400;
  return `
<tr><td style="padding:8px 20px 4px">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:10px;font-weight:600;color:#9698C3;text-transform:uppercase;letter-spacing:1.2px">Observations · MoM</td>
      <td style="text-align:right;font-size:10px;color:${labelColor};font-weight:${labelWeight}">${observations.framing.label}</td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">
    ${headlines}
    ${concerns}
    ${glimmersHtml}
  </table>
</td></tr>`;
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

function buildEmailBody(latest, billing, raw) {
  const observations = raw ? computeObservations(raw) : { framing: null, headlines: [], glimmers: [], concerns: [] };
  const observationsHtml = renderObservationsBlock(observations);
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

  // Engagement
  const eng = [
    { label: 'Active', count: latest.engagement.active_both, color: '#16a34a' },
    { label: 'Records only', count: latest.engagement.records_no_search, color: '#d97706' },
    { label: 'Search only', count: latest.engagement.search_no_records, color: '#8b5cf6' },
    { label: 'Zombie', count: latest.engagement.zombie, color: '#dc2626' },
  ];
  const engTotal = eng.reduce((s, e) => s + e.count, 0);

  function quotaRow(label, pct, current, quota, color) {
    const w = Math.min(parseFloat(pct), 100);
    return `
    <tr><td style="padding:12px 0;border-bottom:1px solid #f3f4f6">
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

<!-- OBSERVATIONS · MoM -->
${observationsHtml}

<!-- QUOTA STATUS -->
<tr><td style="padding:12px 20px">
  <table width="100%" cellpadding="0" cellspacing="0">
    ${quotaRow('Applications', appsPct, apps, 1500, barColor(appsPct))}
    ${quotaRow('Records', recsPct, records, 50000000, barColor(recsPct))}
    ${quotaRow('Searches', srchPct, searches, 75000000, barColor(srchPct))}
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

<!-- SIGN OFF -->
<tr><td style="padding:16px 20px 14px;font-size:13px;color:#36395A;border-top:1px solid #f3f4f6">
  CSV + PDF attached.<br><br>
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
  const htmlBody = buildEmailBody(latest, billing, data);

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
