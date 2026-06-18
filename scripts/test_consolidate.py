#!/usr/bin/env python3
"""Tests for consolidate.py data-integrity fixes.

Run: python3 -m pytest scripts/test_consolidate.py -q
"""
import csv
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import consolidate  # noqa: E402

DAILY_COLS = [
    'usage_date', 'app_created_at', 'app_deleted_at', 'app_blocked_at',
    'app_last_activity_at', 'app_name', 'public_app_id', 'daily_used_records',
    'max_monthly_record_usage', 'billable_search_requests',
    'billable_search_requests_rsum', 'total_search_operations',
    'roll_30day_search_operations',
]
BILLING_COLS = [
    'billing_public_application_id', 'billing_period_start', 'billing_period_end',
    'billable_search_requests', 'billable_records', 'period_end_live_apps',
    'deleted_in_period_apps', 'provisioned_apps',
]


def _app_row(app_id, name, records, searches, deleted=''):
    return {
        'usage_date': '2026-06-15', 'app_created_at': '2025-01-01',
        'app_deleted_at': deleted, 'app_blocked_at': '',
        'app_last_activity_at': '2026-06-15', 'app_name': name,
        'public_app_id': app_id, 'daily_used_records': records,
        'max_monthly_record_usage': records, 'billable_search_requests': searches,
        'billable_search_requests_rsum': searches,
        'total_search_operations': searches, 'roll_30day_search_operations': searches,
    }


def _write_csv(path, cols, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def _run(tmp_path, app_rows, prod_records, prod_searches, prod_apps):
    daily = tmp_path / 'all_children_daily_usage_2026-06-15T0000.csv'
    billing = tmp_path / 'stage_prod_parent_agg_stat_2026-06-15T0000.csv'
    _write_csv(daily, DAILY_COLS, app_rows)
    _write_csv(billing, BILLING_COLS, [
        {'billing_public_application_id': 'EX9JOVML7S', 'billing_period_start': '2026-02-01',
         'billing_period_end': '2026-06-15', 'billable_search_requests': prod_searches,
         'billable_records': prod_records, 'period_end_live_apps': prod_apps,
         'deleted_in_period_apps': 0, 'provisioned_apps': prod_apps},
        {'billing_public_application_id': 'J50O6J0MJP', 'billing_period_start': '2026-02-01',
         'billing_period_end': '2026-06-15', 'billable_search_requests': 0,
         'billable_records': 0, 'period_end_live_apps': 0,
         'deleted_in_period_apps': 0, 'provisioned_apps': 0},
    ])
    from datetime import date
    csv_info = {
        'path': str(daily), 'filename': daily.name, 'report_date': date(2026, 6, 15),
        'folder': tmp_path.name, 'billing_file': str(billing),
    }
    return consolidate.process_csv(csv_info)


def test_concentration_never_exceeds_100_with_large_deleted_app(tmp_path):
    """A deleted app retaining a huge record peak must NOT inflate concentration >100%.

    Reproduces the prod bug: a deleted app with a 14.5M-record peak summed into the
    top-10 numerator while the billing-override denominator counts only live records,
    yielding 101.1%. Concentration is a share — it must be <=100%.
    """
    rows = [
        _app_row('AAAAAAA001', 'cm-active-1', records=100, searches=10),
        _app_row('AAAAAAA002', 'cm-active-2', records=50, searches=5),
        # Deleted app with an enormous retained peak — the bug trigger.
        _app_row('DDDDDDD001', 'cm-deleted-huge', records=10000, searches=0,
                 deleted='2026-04-21'),
    ]
    # Billing prod reflects only the two LIVE apps (150 records, 15 searches).
    snap = _run(tmp_path, rows, prod_records=150, prod_searches=15, prod_apps=2)
    assert snap is not None
    c = snap['concentration']
    assert 0 <= c['top10_records_pct'] <= 100, f"records_pct={c['top10_records_pct']}"
    assert 0 <= c['top10_searches_pct'] <= 100, f"searches_pct={c['top10_searches_pct']}"
    # Top-10 share must be computed over ACTIVE apps only (100+50 of 150 = 100%),
    # the deleted 10000-record app excluded from both numerator and denominator.
    assert c['top10_records_pct'] == 100.0
    assert c['top10_searches_pct'] == 100.0


def test_concentration_partial_share(tmp_path):
    """Sanity: with >10 active apps, top-10 share is a true partial percentage <=100."""
    rows = [_app_row(f'ACT{ i :07d}', f'cm-app-{i}', records=10, searches=2)
            for i in range(20)]
    snap = _run(tmp_path, rows, prod_records=200, prod_searches=40, prod_apps=20)
    c = snap['concentration']
    # 10 of 20 equal apps => 50% of records and searches.
    assert c['top10_records_pct'] == 50.0
    assert c['top10_searches_pct'] == 50.0


def test_dedupe_keeps_most_complete_snapshot_per_date():
    """A stray partial CSV (few rows) must not shadow the full export for the same date.

    Reproduces the prod bug: the 2026-05-19 folder has both a 238k-row full export and a
    ~675-row partial (child_app_daily / *MOM), producing two snapshots for one date — the
    partial one degenerate (zombie=0, active_both=all). Keep the most complete per date.
    """
    full = {'report_date': '2026-05-19', 'csv_rows': 238628,
            'engagement': {'zombie': 246, 'active_both': 963}}
    partial = {'report_date': '2026-05-19', 'csv_rows': 675,
               'engagement': {'zombie': 0, 'active_both': 1481}}
    other = {'report_date': '2026-05-31', 'csv_rows': 240000,
             'engagement': {'zombie': 37, 'active_both': 1183}}
    # Order shouldn't matter — partial appears first here.
    out = consolidate.dedupe_snapshots([partial, full, other])
    assert len(out) == 2
    by_date = {s['report_date']: s for s in out}
    assert by_date['2026-05-19']['csv_rows'] == 238628
    assert by_date['2026-05-19']['engagement']['zombie'] == 246
    # Result stays sorted by date.
    assert [s['report_date'] for s in out] == ['2026-05-19', '2026-05-31']
