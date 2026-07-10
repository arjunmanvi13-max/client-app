"""Backend tests for /api/reports/* — Financial Reports + Excel Export.

Tests all scenarios from the review request:
1. Access control (401/200/200/403)
2. Revenue Summary shape (no filters)
3. Revenue Summary with filters (ALPHA-centric, PWS-zero, Sports Admin coercion)
4. Defaulters buckets + rows + centre filter
5. Payment Modes: summary + transactions + date filter
6. Excel export: 3 kinds + invalid → 400
"""
from __future__ import annotations

import os
import sys
import json
from typing import Any, Dict, Optional

import requests

BASE = os.environ.get("BACKEND_URL", "https://unified-track.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

PASSES: list[str] = []
FAILS: list[str] = []


def _pf(cond: bool, name: str, detail: str = ""):
    if cond:
        PASSES.append(name)
        print(f"[PASS] {name}")
    else:
        FAILS.append(f"{name} — {detail}")
        print(f"[FAIL] {name}: {detail}")


def login_password(mobile: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login/mobile", json={"mobile": mobile, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {mobile}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def login_super_otp(mobile: str) -> str:
    r = requests.post(f"{API}/auth/otp/send", json={"mobile": mobile, "purpose": "super_admin"}, timeout=30)
    assert r.status_code == 200, f"otp/send: {r.status_code} {r.text}"
    r2 = requests.post(f"{API}/auth/otp/verify", json={"mobile": mobile, "code": "123456", "purpose": "super_admin"}, timeout=30)
    assert r2.status_code == 200, f"otp/verify: {r2.status_code} {r2.text}"
    j = r2.json()
    return j["access_token"]


def h(tok: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {tok}"}


def main():
    print(f"BASE = {BASE}\n")

    # ---------- Auth ----------
    super_tok = login_super_otp("9631252241")
    admin_tok = login_password("9000000001", "Admin@123")
    teacher_tok = login_password("9000000004", "Teacher@123")
    print("Logged in super, sports admin, teacher\n")

    endpoints = [
        "/reports/financial/summary",
        "/reports/financial/defaulters",
        "/reports/financial/payment-modes",
        "/reports/financial/export?kind=summary",
    ]

    # ---------- 1. Access control ----------
    print("=== Access control ===")
    for ep in endpoints:
        # Unauthenticated
        r = requests.get(f"{API}{ep}", timeout=30)
        _pf(r.status_code in (401, 403), f"Unauthenticated {ep} → 401/403", f"got {r.status_code}")

        # Super Admin
        r = requests.get(f"{API}{ep}", headers=h(super_tok), timeout=60)
        _pf(r.status_code == 200, f"Super Admin {ep} → 200", f"got {r.status_code} {r.text[:120]}")

        # Sports Admin
        r = requests.get(f"{API}{ep}", headers=h(admin_tok), timeout=60)
        _pf(r.status_code == 200, f"Sports Admin {ep} → 200", f"got {r.status_code} {r.text[:120]}")

        # Teacher
        r = requests.get(f"{API}{ep}", headers=h(teacher_tok), timeout=30)
        cond = r.status_code == 403
        try:
            body = r.json()
            msg = body.get("detail", "")
        except Exception:
            msg = r.text
        cond2 = "do not have access" in msg.lower() or "reports" in msg.lower()
        _pf(cond and cond2, f"Teacher {ep} → 403 w/ Reports msg", f"status={r.status_code} msg={msg!r}")

    # ---------- 2. Revenue Summary shape ----------
    print("\n=== Revenue Summary shape ===")
    r = requests.get(f"{API}/reports/financial/summary", headers=h(super_tok), timeout=60)
    _pf(r.status_code == 200, "Summary GET status 200", f"{r.status_code}")
    j = r.json()
    for k in ("totals", "by_fee_head", "by_centre", "by_sport", "by_institution"):
        _pf(k in j, f"Summary contains {k}", f"keys={list(j.keys())}")
    t = j.get("totals", {})
    for k in ("collected_all_time", "current_month", "previous_month", "outstanding"):
        _pf(isinstance(t.get(k), int), f"Summary.totals.{k} is int", f"type={type(t.get(k)).__name__} val={t.get(k)}")
    for k in ("by_fee_head", "by_centre", "by_sport", "by_institution"):
        _pf(isinstance(j.get(k), list), f"Summary.{k} is list", f"type={type(j.get(k)).__name__}")

    # ---------- 3. Revenue Summary with filters ----------
    print("\n=== Revenue Summary filters ===")
    # 3a. Full filter set
    params = "?institution=ALPHA&centre=Balua&sport=Cricket&date_from=2026-01-01&date_to=2026-12-31"
    r = requests.get(f"{API}/reports/financial/summary{params}", headers=h(super_tok), timeout=60)
    _pf(r.status_code == 200, "Summary filtered (ALPHA/Balua/Cricket/dates) → 200", f"{r.status_code} {r.text[:200]}")

    # 3b. PWS as super → zeros
    r = requests.get(f"{API}/reports/financial/summary?institution=PWS", headers=h(super_tok), timeout=30)
    _pf(r.status_code == 200, "Summary PWS (super) → 200", f"{r.status_code}")
    j_pws = r.json() if r.status_code == 200 else {}
    tots = j_pws.get("totals", {})
    zeros_ok = all(tots.get(k) == 0 for k in ("collected_all_time", "current_month", "previous_month", "outstanding"))
    _pf(zeros_ok, "Summary PWS totals all zero", f"totals={tots}")
    _pf(j_pws.get("by_fee_head") == [] and j_pws.get("by_centre") == [] and j_pws.get("by_sport") == [],
        "Summary PWS lists empty", f"fh={j_pws.get('by_fee_head')} c={j_pws.get('by_centre')} s={j_pws.get('by_sport')}")

    # 3c. Sports Admin sending institution=PWS → coerced to ALPHA
    r = requests.get(f"{API}/reports/financial/summary?institution=PWS", headers=h(admin_tok), timeout=30)
    _pf(r.status_code == 200, "Summary Sports Admin+PWS → 200", f"{r.status_code}")
    j_coerce = r.json() if r.status_code == 200 else {}
    tots_c = j_coerce.get("totals", {})
    # ALPHA should have fees seeded (Registration + Monthly for seeded players). Assert non-zero collected/outstanding OR by_institution has ALPHA (not PWS)
    inst_list = j_coerce.get("by_institution", [])
    inst_names = [x.get("institution") for x in inst_list]
    has_alpha = "ALPHA" in inst_names
    has_pws_only = inst_names == ["PWS"]
    _pf(has_alpha and not has_pws_only, "Sports Admin PWS silently coerced to ALPHA", f"by_institution={inst_list}")

    # Extra: compare Sports Admin PWS vs Super PWS — Sports admin should NOT return zeros pattern of PWS
    same_as_pws = (tots_c == tots and inst_names == ["PWS"])
    _pf(not same_as_pws, "Sports Admin PWS ≠ super's PWS zero payload (coerced)", f"tots={tots_c}")

    # ---------- 4. Defaulters ----------
    print("\n=== Defaulters ===")
    r = requests.get(f"{API}/reports/financial/defaulters", headers=h(super_tok), timeout=60)
    _pf(r.status_code == 200, "Defaulters GET → 200", f"{r.status_code}")
    jd = r.json()
    b = jd.get("buckets", {})
    _pf(set(b.keys()) == {"0_7", "8_15", "16_30", "gt_30"}, "Defaulters bucket keys", f"keys={list(b.keys())}")
    _pf(all(isinstance(b.get(k), int) for k in ("0_7", "8_15", "16_30", "gt_30")), "Bucket values are ints", f"buckets={b}")
    _pf(isinstance(jd.get("rows"), list), "Defaulters.rows is list", f"type={type(jd.get('rows')).__name__}")
    # counts consistent
    from collections import Counter
    row_bucket_counts = Counter([r.get("bucket") for r in jd.get("rows", [])])
    consistent = all(row_bucket_counts.get(k, 0) == b.get(k, 0) for k in ("0_7", "8_15", "16_30", "gt_30"))
    _pf(consistent, "Defaulters buckets match row counts", f"row_counts={dict(row_bucket_counts)} bucket_counts={b}")

    # Centre filter Balua
    r = requests.get(f"{API}/reports/financial/defaulters?centre=Balua", headers=h(super_tok), timeout=30)
    _pf(r.status_code == 200, "Defaulters centre=Balua → 200", f"{r.status_code}")
    jd_b = r.json() if r.status_code == 200 else {"rows": [], "buckets": {}}
    all_balua = all(r.get("centre") == "Balua" for r in jd_b.get("rows", []))
    _pf(all_balua, "Defaulters centre filter narrows to Balua only", f"rows_centres={[r.get('centre') for r in jd_b.get('rows',[])][:5]}")

    # ---------- 5. Payment Modes ----------
    print("\n=== Payment Modes ===")
    r = requests.get(f"{API}/reports/financial/payment-modes", headers=h(super_tok), timeout=60)
    _pf(r.status_code == 200, "Payment modes GET → 200", f"{r.status_code}")
    jp = r.json()
    _pf(isinstance(jp.get("summary"), dict), "PaymentModes.summary is dict", f"type={type(jp.get('summary')).__name__}")
    _pf(isinstance(jp.get("transactions"), list), "PaymentModes.transactions is list", f"type={type(jp.get('transactions')).__name__}")
    # Verify summary structure
    for mode, agg in (jp.get("summary") or {}).items():
        _pf(isinstance(agg, dict) and "count" in agg and "sum" in agg,
            f"summary[{mode}] has count+sum", f"agg={agg}")
        break  # sample check on first entry
    # Verify transactions have required keys
    txns = jp.get("transactions", [])
    if txns:
        t0 = txns[0]
        required = {"player_name", "payment_mode", "reference_id", "paid_at", "collected_by_name"}
        missing = required - set(t0.keys())
        _pf(not missing, "Transactions[0] has required keys", f"missing={missing} keys={list(t0.keys())}")
    else:
        print("  [INFO] No transactions returned — verifying structure only")

    # Date filter
    r = requests.get(f"{API}/reports/financial/payment-modes?date_from=2020-01-01&date_to=2020-12-31", headers=h(super_tok), timeout=30)
    _pf(r.status_code == 200, "PaymentModes date filter → 200", f"{r.status_code}")
    jp_old = r.json() if r.status_code == 200 else {"transactions": []}
    _pf(len(jp_old.get("transactions", [])) == 0 or all("2020" in (t.get("paid_at") or "") for t in jp_old.get("transactions", [])),
        "PaymentModes date filter narrows results", f"txns_returned={len(jp_old.get('transactions',[]))}")

    # ---------- 6. Excel Export ----------
    print("\n=== Excel export ===")
    for kind in ("summary", "defaulters", "payment-modes"):
        r = requests.get(f"{API}/reports/financial/export?kind={kind}", headers=h(super_tok), timeout=120)
        _pf(r.status_code == 200, f"Export kind={kind} → 200", f"{r.status_code} {r.text[:200] if r.status_code != 200 else ''}")
        ct = r.headers.get("content-type", "")
        cd = r.headers.get("content-disposition", "")
        _pf("spreadsheetml" in ct.lower(), f"Export kind={kind} content-type spreadsheetml", f"ct={ct}")
        _pf("attachment" in cd.lower() and ".xlsx" in cd.lower(), f"Export kind={kind} content-disposition attachment xlsx", f"cd={cd}")
        body_len = len(r.content or b"")
        _pf(body_len > 500, f"Export kind={kind} body >500 bytes", f"len={body_len}")
        # Verify valid xlsx magic (PK zip)
        _pf(r.content[:2] == b"PK", f"Export kind={kind} valid xlsx zip magic", f"first2={r.content[:2]!r}")

    # invalid kind
    r = requests.get(f"{API}/reports/financial/export?kind=invalid", headers=h(super_tok), timeout=30)
    _pf(r.status_code == 400, "Export kind=invalid → 400", f"{r.status_code} body={r.text[:200]}")

    # ---------- Summary ----------
    print("\n\n" + "=" * 60)
    print(f"PASSED: {len(PASSES)}")
    print(f"FAILED: {len(FAILS)}")
    if FAILS:
        print("\nFailures:")
        for f in FAILS:
            print(f"  - {f}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(main())
