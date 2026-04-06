#!/usr/bin/env python3
"""
Adobe OEM Usage Data Consolidator
===================================
Traverses the "Reports Sent to Adobe" folder, processes every weekly CSV,
and outputs a single compact JSON summary file for dashboard consumption.

Usage:
    cd to the "Reports Sent to Adobe" folder, then:
        python3 consolidate_adobe_data.py

    Or specify the path:
        python3 consolidate_adobe_data.py "/path/to/Reports Sent to Adobe"

Output:
    adobe_oem_consolidated.json  (in current working directory)

What it does:
    1. Finds all weekly CSVs (skips PDFs, skips stage_prod_parent_agg_stat files)
    2. For each CSV, computes per-report-week aggregates + app-level rollups
    3. Outputs ONE JSON file with:
       - Weekly snapshots (apps, records, searches, segmentation)
       - Monthly aggregates (rolled up from weekly)
       - App-level summary (latest state of every child app ever seen)
       - Concentration metrics over time
"""

import csv
import json
import os
import sys
import re
from collections import defaultdict
from datetime import datetime, date


# ═══════════════════════════════════════════════════════════
# FILE DISCOVERY
# ═══════════════════════════════════════════════════════════

def find_csv_files(root_dir):
    """Find all relevant CSV files, return sorted by report date."""
    csv_files = []

    for dirpath, dirnames, filenames in os.walk(root_dir):
        for fname in filenames:
            if not fname.lower().endswith('.csv'):
                continue

            # Skip non-daily-usage files
            if fname.startswith('stage_prod_parent_agg_stat'):
                continue
            if fname.startswith('last_three_months'):
                continue

            full_path = os.path.join(dirpath, fname)
            report_date = extract_date(dirpath, fname)

            if report_date:
                # Check if a billing summary file exists in the same folder
                billing_file = find_billing_file(dirpath)
                csv_files.append({
                    'path': full_path,
                    'filename': fname,
                    'report_date': report_date,
                    'report_date_str': report_date.isoformat(),
                    'folder': os.path.basename(dirpath),
                    'billing_file': billing_file,
                })

    csv_files.sort(key=lambda x: x['report_date'])
    return csv_files


def find_billing_file(dirpath):
    """Find a stage_prod_parent_agg_stat CSV in the same folder, if one exists."""
    for fname in os.listdir(dirpath):
        if fname.startswith('stage_prod_parent_agg_stat') and fname.endswith('.csv'):
            return os.path.join(dirpath, fname)
    return None


def load_billing_totals(billing_path):
    """Load authoritative billing totals from stage_prod_parent_agg_stat CSV.

    Returns dict with prod/staging breakdowns and combined totals.
    These numbers come directly from the billing system and are the source of truth.
    """
    if not billing_path or not os.path.exists(billing_path):
        return None

    result = {'prod': {}, 'staging': {}}
    try:
        with open(billing_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                parent_id = (row.get('billing_public_application_id') or '').strip()
                entry = {
                    'parent_id': parent_id,
                    'billing_period_start': (row.get('billing_period_start') or '')[:10],
                    'billing_period_end': (row.get('billing_period_end') or '')[:10],
                    'billable_search_requests': int(float(row.get('billable_search_requests', 0) or 0)),
                    'billable_records': int(float(row.get('billable_records', 0) or 0)),
                    'period_end_live_apps': int(float(row.get('period_end_live_apps', 0) or 0)),
                    'deleted_in_period_apps': int(float(row.get('deleted_in_period_apps', 0) or 0)),
                    'provisioned_apps': int(float(row.get('provisioned_apps', 0) or 0)),
                }
                if parent_id == 'EX9JOVML7S':
                    result['prod'] = entry
                elif parent_id == 'J50O6J0MJP':
                    result['staging'] = entry

        if result['prod']:
            result['combined'] = {
                'live_apps': result['prod'].get('period_end_live_apps', 0) + result['staging'].get('period_end_live_apps', 0),
                'billable_records': result['prod'].get('billable_records', 0) + result['staging'].get('billable_records', 0),
                'billable_search_requests': result['prod'].get('billable_search_requests', 0) + result['staging'].get('billable_search_requests', 0),
            }
            return result
    except Exception as e:
        print(f"  WARNING: Could not read billing file {billing_path}: {e}")

    return None


def extract_date(dirpath, filename):
    """Extract the report date from folder name or filename."""
    folder = os.path.basename(dirpath)

    # Try folder name: "Adobe-oem-usage-DD-Mon-YYYY"
    m = re.search(r'Adobe-oem-usage-(\d{1,2})-(\w+)-(\d{4})', folder, re.IGNORECASE)
    if m:
        day, month_str, year = m.group(1), m.group(2), m.group(3)
        for fmt in ['%d-%B-%Y', '%d-%b-%Y']:
            try:
                return datetime.strptime(f"{day}-{month_str}-{year}", fmt).date()
            except ValueError:
                continue

    # Try filename: "all_children_daily_usage_YYYY-MM-DDTHHMM.csv"
    m = re.search(r'all_children_daily_usage_(\d{4})-(\d{2})-(\d{2})', filename)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))

    # Try filename: "Adobe-oem-usage-DD-Mon-YYYY.csv"
    m = re.search(r'Adobe-oem-usage-(\d{1,2})-(\w+)-(\d{4})\.csv', filename, re.IGNORECASE)
    if m:
        day, month_str, year = m.group(1), m.group(2), m.group(3)
        for fmt in ['%d-%B-%Y', '%d-%b-%Y']:
            try:
                return datetime.strptime(f"{day}-{month_str}-{year}", fmt).date()
            except ValueError:
                continue

    return None


# ═══════════════════════════════════════════════════════════
# CSV PROCESSING
# ═══════════════════════════════════════════════════════════

def process_csv(csv_info):
    """Process one CSV, return a weekly snapshot summary.

    Billing methodology:
    - Records: use max_monthly_record_usage (4th-highest-day method, how customers get billed)
    - Searches: use billable_search_requests_rsum (cumulative from billing period start)
    - Apps: exclude parent app IDs (EX9JOVML7S, J50O6J0MJP) from child app counts
    """
    path = csv_info['path']
    report_date = csv_info['report_date']
    apps = {}
    row_count = 0

    # Parent app IDs to exclude from child app counts
    PARENT_APP_IDS = {'EX9JOVML7S', 'J50O6J0MJP'}

    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)

            if not reader.fieldnames or 'public_app_id' not in reader.fieldnames:
                print(f"  SKIP (missing columns): {csv_info['filename']}")
                return None

            for row in reader:
                row_count += 1
                app_id = (row.get('public_app_id') or '').strip()
                if not app_id:
                    continue

                # Skip parent app IDs — they are billing containers, not child apps
                if app_id in PARENT_APP_IDS:
                    continue

                try:
                    daily_records = int(row.get('daily_used_records', 0) or 0)
                    billable_records = int(row.get('max_monthly_record_usage', 0) or 0)
                    searches = int(row.get('billable_search_requests', 0) or 0)
                    search_ops = int(row.get('total_search_operations', 0) or 0)
                    roll_30d = int(row.get('roll_30day_search_operations', 0) or 0)
                    rsum = int(row.get('billable_search_requests_rsum', 0) or 0)
                except (ValueError, TypeError):
                    continue

                usage_date = (row.get('usage_date') or '')[:10]

                if app_id not in apps:
                    apps[app_id] = {
                        'name': row.get('app_name', ''),
                        'created': (row.get('app_created_at') or '')[:10],
                        'deleted': (row.get('app_deleted_at') or '')[:10] if row.get('app_deleted_at') else '',
                        'last_activity': (row.get('app_last_activity_at') or '')[:10],
                        'latest_records': billable_records,
                        'latest_date': usage_date,
                        'max_records': billable_records,
                        'total_searches': 0,
                        'max_roll_30d': roll_30d,
                        'max_rsum': rsum,
                        'day_count': 0,
                    }

                a = apps[app_id]
                # Use billable records from the LATEST date row per app
                # (reflects current billing month's 4th-highest-day methodology)
                if usage_date >= a['latest_date']:
                    a['latest_records'] = billable_records
                    a['latest_date'] = usage_date
                a['max_records'] = max(a['max_records'], billable_records)
                a['total_searches'] += searches
                a['max_roll_30d'] = max(a['max_roll_30d'], roll_30d)
                a['max_rsum'] = max(a['max_rsum'], rsum)
                a['day_count'] += 1

    except Exception as e:
        print(f"  ERROR: {csv_info['filename']} - {e}")
        return None

    if not apps:
        return None

    # ── Compute snapshot aggregates ──
    total = len(apps)
    active = sum(1 for a in apps.values() if not a['deleted'])
    deleted = sum(1 for a in apps.values() if a['deleted'])

    # Naming tag classification (within the production parent's children)
    def name_tag(name):
        nl = name.lower()
        if '-nonprod-shared' in nl: return 'nonprod-shared'
        if '-cmprd-genstudio' in nl: return 'cmprd-genstudio'
        if '-cmstg-genstudio' in nl: return 'cmstg-genstudio'
        if name.startswith('cm-'): return 'base'
        if name.startswith('gs-'): return 'genstudio'
        return 'legacy'

    tag_counts = defaultdict(int)
    for a in apps.values():
        tag_counts[name_tag(a['name'])] += 1

    # Legacy segmentation (kept for backward compatibility)
    prod = sum(1 for a in apps.values() if a['name'].startswith('cm-') and 'nonprod' not in a['name'].lower())
    nonprod = sum(1 for a in apps.values() if 'nonprod' in a['name'].lower())
    genstudio = sum(1 for a in apps.values() if a['name'].startswith('gs-'))
    legacy = sum(1 for a in apps.values()
                 if not a['name'].startswith('cm-') and not a['name'].startswith('gs-'))

    zombie = sum(1 for a in apps.values() if a['max_records'] == 0 and a['total_searches'] == 0)
    records_no_search = sum(1 for a in apps.values() if a['max_records'] > 0 and a['total_searches'] == 0)
    search_no_records = sum(1 for a in apps.values() if a['max_records'] == 0 and a['total_searches'] > 0)

    total_latest_records = sum(a['latest_records'] for a in apps.values())
    total_searches = sum(a['total_searches'] for a in apps.values())

    # ── Override totals with billing system numbers if available ──
    billing = load_billing_totals(csv_info.get('billing_file'))
    billing_data = None
    if billing:
        billing_data = billing
        # Use billing system's authoritative numbers for the headline totals
        active = billing['prod'].get('period_end_live_apps', active)
        total_latest_records = billing['prod'].get('billable_records', total_latest_records)
        total_searches = billing['combined'].get('billable_search_requests', total_searches)
        print(f" [billing override: {active} apps, {total_latest_records:,} records]", end='', flush=True)

    # ── Environment breakdown: prod vs nonprod records/searches ──
    def is_nonprod(name):
        return 'nonprod' in name.lower()

    def is_prod_cm(name):
        return name.startswith('cm-') and not is_nonprod(name)

    prod_records = sum(a['latest_records'] for a in apps.values() if is_prod_cm(a['name']))
    prod_searches = sum(a['total_searches'] for a in apps.values() if is_prod_cm(a['name']))
    nonprod_records = sum(a['latest_records'] for a in apps.values() if is_nonprod(a['name']))
    nonprod_searches = sum(a['total_searches'] for a in apps.values() if is_nonprod(a['name']))
    legacy_records = sum(a['latest_records'] for a in apps.values()
                        if not a['name'].startswith('cm-') and not a['name'].startswith('gs-'))
    legacy_searches = sum(a['total_searches'] for a in apps.values()
                         if not a['name'].startswith('cm-') and not a['name'].startswith('gs-'))

    # Concentration
    sorted_rec = sorted(apps.values(), key=lambda x: x['latest_records'], reverse=True)
    sorted_srch = sorted(apps.values(), key=lambda x: x['total_searches'], reverse=True)

    top10_rec = sum(a['latest_records'] for a in sorted_rec[:10])
    top10_rec_pct = round(top10_rec / total_latest_records * 100, 1) if total_latest_records > 0 else 0
    top10_srch = sum(a['total_searches'] for a in sorted_srch[:10])
    top10_srch_pct = round(top10_srch / total_searches * 100, 1) if total_searches > 0 else 0

    # Classify environment for an app
    def env_tag(name):
        if is_nonprod(name):
            return 'nonprod'
        if name.startswith('cm-'):
            return 'prod'
        if name.startswith('gs-'):
            return 'genstudio'
        return 'legacy'

    # Top 15 by records
    top15_records = [
        {'id': aid, 'name': a['name'][:35], 'records': a['latest_records'],
         'searches': a['total_searches'], 'created': a['created'], 'env': env_tag(a['name'])}
        for aid, a in sorted(apps.items(), key=lambda x: x[1]['latest_records'], reverse=True)[:15]
    ]

    # Top 15 by searches
    top15_searches = [
        {'id': aid, 'name': a['name'][:35], 'records': a['latest_records'],
         'searches': a['total_searches'], 'created': a['created'], 'env': env_tag(a['name'])}
        for aid, a in sorted(apps.items(), key=lambda x: x[1]['total_searches'], reverse=True)[:15]
    ]

    # ALL apps with engagement classification — enables interactive drill-down
    def engagement_class(a):
        if a['max_records'] == 0 and a['total_searches'] == 0:
            return 'zombie'
        if a['max_records'] > 0 and a['total_searches'] == 0:
            return 'records_only'
        if a['max_records'] == 0 and a['total_searches'] > 0:
            return 'search_only'
        return 'active'

    all_app_detail = []
    for aid, a in sorted(apps.items(), key=lambda x: x[1]['latest_records'], reverse=True):
        if a['deleted']:
            continue  # skip deleted apps
        all_app_detail.append({
            'id': aid, 'name': a['name'][:40], 'env': env_tag(a['name']),
            'tag': name_tag(a['name']),
            'records': a['latest_records'], 'max_records': a['max_records'],
            'searches': a['total_searches'], 'max_rsum': a['max_rsum'],
            'created': a['created'],
            'status': engagement_class(a),
        })

    # App age distribution
    age = {'0_3mo': 0, '3_6mo': 0, '6_12mo': 0, '12mo_plus': 0, 'unknown': 0}
    for a in apps.values():
        if a['created']:
            try:
                created = datetime.strptime(a['created'], '%Y-%m-%d').date()
                days = (report_date - created).days
                if days <= 90: age['0_3mo'] += 1
                elif days <= 180: age['3_6mo'] += 1
                elif days <= 365: age['6_12mo'] += 1
                else: age['12mo_plus'] += 1
            except:
                age['unknown'] += 1
        else:
            age['unknown'] += 1

    return {
        'report_date': report_date.isoformat(),
        'report_month': report_date.strftime('%Y-%m'),
        'csv_rows': row_count,
        'totals': {
            'apps': total,
            'active_apps': active,
            'deleted_apps': deleted,
            'latest_records': total_latest_records,
            'total_searches': total_searches,
        },
        'segmentation': {
            'prod': prod,
            'nonprod': nonprod,
            'genstudio': genstudio,
            'legacy': legacy,
        },
        'name_tags': {
            'base': tag_counts.get('base', 0),
            'nonprod_shared': tag_counts.get('nonprod-shared', 0),
            'cmprd_genstudio': tag_counts.get('cmprd-genstudio', 0),
            'cmstg_genstudio': tag_counts.get('cmstg-genstudio', 0),
            'genstudio': tag_counts.get('genstudio', 0),
            'legacy': tag_counts.get('legacy', 0),
        },
        'engagement': {
            'zombie': zombie,
            'records_no_search': records_no_search,
            'search_no_records': search_no_records,
            'active_both': total - zombie - records_no_search - search_no_records,
        },
        'concentration': {
            'top10_records_pct': top10_rec_pct,
            'top10_searches_pct': top10_srch_pct,
        },
        'environment': {
            'prod_apps': prod,
            'prod_records': prod_records,
            'prod_searches': prod_searches,
            'nonprod_apps': nonprod,
            'nonprod_records': nonprod_records,
            'nonprod_searches': nonprod_searches,
            'legacy_apps': legacy,
            'legacy_records': legacy_records,
            'legacy_searches': legacy_searches,
        },
        'billing': {
            'source': 'stage_prod_parent_agg_stat' if billing_data else 'computed',
            'prod': billing_data['prod'] if billing_data else None,
            'staging': billing_data['staging'] if billing_data else None,
        } if billing_data else None,
        'age_distribution': age,
        'top15_by_records': top15_records,
        'top15_by_searches': top15_searches,
        'app_detail': all_app_detail,
    }


# ═══════════════════════════════════════════════════════════
# MONTHLY ROLLUP
# ═══════════════════════════════════════════════════════════

def compute_monthly(snapshots):
    """Take the LAST snapshot of each month as the monthly value."""
    by_month = defaultdict(list)
    for s in snapshots:
        by_month[s['report_month']].append(s)

    monthly = []
    for month_key in sorted(by_month.keys()):
        # Take the latest snapshot in the month
        latest = max(by_month[month_key], key=lambda x: x['report_date'])
        monthly.append({
            'month': month_key,
            'report_date': latest['report_date'],
            'weeks_in_month': len(by_month[month_key]),
            'apps': latest['totals']['active_apps'],
            'records': latest['totals']['latest_records'],
            'searches': latest['totals']['total_searches'],
            'total_apps_ever': latest['totals']['apps'],
            'prod': latest['segmentation']['prod'],
            'nonprod': latest['segmentation']['nonprod'],
            'genstudio': latest['segmentation']['genstudio'],
            'zombie': latest['engagement']['zombie'],
            'top10_rec_pct': latest['concentration']['top10_records_pct'],
            'top10_srch_pct': latest['concentration']['top10_searches_pct'],
            'prod_records': latest['environment']['prod_records'],
            'prod_searches': latest['environment']['prod_searches'],
            'nonprod_records': latest['environment']['nonprod_records'],
            'nonprod_searches': latest['environment']['nonprod_searches'],
        })

    return monthly


# ═══════════════════════════════════════════════════════════
# APP MASTER LIST
# ═══════════════════════════════════════════════════════════

def build_app_master(snapshots):
    """Build a master list of every app ever seen, with latest-known state."""
    master = {}

    for snap in snapshots:
        for app_list in [snap['top15_by_records'], snap['top15_by_searches']]:
            for app in app_list:
                aid = app['id']
                if aid not in master or snap['report_date'] > master[aid].get('_last_seen', ''):
                    master[aid] = {
                        'id': aid,
                        'name': app['name'],
                        'records': app['records'],
                        'searches': app['searches'],
                        'created': app['created'],
                        '_last_seen': snap['report_date'],
                    }

    # Clean and return
    result = []
    for aid, a in sorted(master.items(), key=lambda x: x[1]['records'], reverse=True):
        del a['_last_seen']
        result.append(a)

    return result


# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════

def main():
    # Determine root directory
    if len(sys.argv) > 1:
        root = sys.argv[1]
    else:
        root = os.getcwd()

    print(f"Adobe OEM Data Consolidator")
    print(f"===========================")
    print(f"Root: {root}")
    print()

    # Find files
    csv_files = find_csv_files(root)
    print(f"Found {len(csv_files)} CSV files")
    if not csv_files:
        print("No CSV files found. Check the path.")
        sys.exit(1)

    print(f"Date range: {csv_files[0]['report_date']} → {csv_files[-1]['report_date']}")
    print()

    # Process each
    snapshots = []
    for i, cf in enumerate(csv_files):
        label = f"[{i+1}/{len(csv_files)}] {cf['report_date']} — {cf['filename']}"
        print(f"  Processing {label}...", end='', flush=True)
        result = process_csv(cf)
        if result:
            snapshots.append(result)
            t = result['totals']
            print(f" {t['active_apps']} apps, {t['latest_records']:,} records, {t['total_searches']:,} searches")
        else:
            print(" SKIPPED")

    print()
    print(f"Successfully processed {len(snapshots)} of {len(csv_files)} files")

    if not snapshots:
        print("No data processed.")
        sys.exit(1)

    # Trim app_detail from older snapshots to keep JSON size manageable
    # Full detail only on the latest 2 snapshots (for MoM delta), top 30 for the rest
    for i, snap in enumerate(snapshots):
        if i < len(snapshots) - 2:
            # Keep only top 30 by records for older snapshots
            snap['app_detail'] = sorted(snap['app_detail'], key=lambda x: x['records'], reverse=True)[:30]

    # Build outputs
    monthly = compute_monthly(snapshots)
    app_master = build_app_master(snapshots)

    output = {
        '_metadata': {
            'generated_at': datetime.now().isoformat(),
            'root_dir': root,
            'files_found': len(csv_files),
            'files_processed': len(snapshots),
            'date_range_start': snapshots[0]['report_date'],
            'date_range_end': snapshots[-1]['report_date'],
        },
        'weekly_snapshots': snapshots,
        'monthly_summary': monthly,
        'app_master': app_master[:50],  # Top 50 apps ever seen in top-15 lists
        'contract': {
            'note': 'Add your contract details here or they will be configured in the dashboard',
            'current_so': 'Q-47553',
            'start': '2026-02-01',
            'end': '2027-01-31',
            'apps_quota': 1500,
            'records_quota': 50000000,
            'searches_quota': 75000000,
            'annual_rate': 739520,
        },
    }

    # Write output
    out_path = os.path.join(os.getcwd(), 'adobe_oem_consolidated.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2, default=str)

    file_size = os.path.getsize(out_path)
    print()
    print(f"Output: {out_path}")
    print(f"Size:   {file_size / 1024:.0f} KB")
    print(f"Weekly snapshots: {len(snapshots)}")
    print(f"Monthly periods:  {len(monthly)}")
    print(f"App master list:  {len(app_master[:50])} top apps")
    print()
    print("Done! Upload adobe_oem_consolidated.json to Claude.")


if __name__ == '__main__':
    main()
