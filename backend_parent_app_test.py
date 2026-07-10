"""Backend test for Parent App endpoints.

Covers 15 scenarios from review request:
- wards/attendance/fees/alerts (parent only)
- link/unlink (admin only)
- auto-absent notification hooks (attendance batch + coach attendance)
- regressions (principal staff-list, admin command-center, coach dashboard)
"""
import os
import sys
import uuid
import json
import time
import asyncio
from datetime import datetime, timezone, timedelta

import requests

BACKEND_URL = "https://unified-track.preview.emergentagent.com/api"

CREDS = {
    "super":        ("super@pws-alpha.com",        "Super@123"),
    "admin":        ("admin@pws-alpha.com",        "Admin@123"),
    "principal":    ("principal@pws-alpha.com",    "Principal@123"),
    "teacher":      ("teacher@pws-alpha.com",      "Teacher@123"),
    "coach":        ("coach@pws-alpha.com",        "Coach@123"),
    "parent_pws":   ("parent_pws@pws-alpha.com",   "Parent@123"),
    "parent_alpha": ("parent_alpha@pws-alpha.com", "Parent@123"),
}

results = []  # (scenario_id, pass/fail, msg)
inserted_attendance_keys = []  # tuples to delete via mongo

def rec(sid, ok, msg=""):
    results.append((sid, ok, msg))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] S{sid}: {msg}")


def login(key):
    em, pw = CREDS[key]
    r = requests.post(f"{BACKEND_URL}/auth/login", json={"email": em, "password": pw}, timeout=20)
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def today_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def date_n_days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).strftime("%Y-%m-%d")


def main():
    # ---- Login all roles ----
    tokens = {}
    users = {}
    for k in CREDS:
        try:
            t, u = login(k)
            tokens[k] = t
            users[k] = u
        except Exception as e:
            rec("login-" + k, False, f"login failed: {e}")
            return

    # =================== S1 ===================
    r = requests.get(f"{BACKEND_URL}/auth/me", headers=H(tokens["parent_pws"]), timeout=20)
    if r.status_code == 200:
        u = r.json()
        ok = (
            u.get("role") == "parent"
            and u.get("organization") == "PWS"
            and isinstance(u.get("linked_person_ids"), list)
            and len(u.get("linked_person_ids")) == 1
            and u.get("role_category") == "Employee"
        )
        rec(1, ok, f"role={u.get('role')} org={u.get('organization')} linked_ids_count={len(u.get('linked_person_ids') or [])} role_category={u.get('role_category')}")
    else:
        rec(1, False, f"/auth/me status={r.status_code} body={r.text[:120]}")

    aarav_id = users["parent_pws"]["linked_person_ids"][0] if users["parent_pws"].get("linked_person_ids") else None
    aditya_id = users["parent_alpha"]["linked_person_ids"][0] if users["parent_alpha"].get("linked_person_ids") else None

    # =================== S2 — non-parent roles forbidden ===================
    forbidden_results = []
    for role_key in ("teacher", "coach", "admin", "super"):
        r = requests.get(f"{BACKEND_URL}/parent/wards", headers=H(tokens[role_key]), timeout=20)
        forbidden_results.append((role_key, r.status_code))
    all_403 = all(s == 403 for _, s in forbidden_results)
    rec(2, all_403, f"non-parent /parent/wards statuses: {forbidden_results}")

    # =================== S3 — parent_pws /wards ===================
    r = requests.get(f"{BACKEND_URL}/parent/wards", headers=H(tokens["parent_pws"]), timeout=20)
    if r.status_code == 200:
        arr = r.json()
        if isinstance(arr, list) and len(arr) == 1:
            w = arr[0]
            att = w.get("attendance_30d") or {}
            ok = (
                w.get("name") == "Aarav Mishra"
                and w.get("kind") == "student"
                and w.get("organization") == "PWS"
                and all(k in att for k in ("total", "present", "absent", "pct"))
                and (w.get("today_status") in (None, "present", "absent", "late", "leave"))
            )
            rec(3, ok, f"name={w.get('name')} kind={w.get('kind')} org={w.get('organization')} att30={att} today={w.get('today_status')}")
        else:
            rec(3, False, f"unexpected wards array: {arr}")
    else:
        rec(3, False, f"status={r.status_code} body={r.text[:200]}")

    # =================== S4 — parent_alpha /wards ===================
    r = requests.get(f"{BACKEND_URL}/parent/wards", headers=H(tokens["parent_alpha"]), timeout=20)
    if r.status_code == 200:
        arr = r.json()
        if isinstance(arr, list) and len(arr) == 1:
            w = arr[0]
            ok = w.get("name") == "Aditya Verma" and w.get("kind") == "player" and w.get("organization") == "ALPHA"
            rec(4, ok, f"name={w.get('name')} kind={w.get('kind')} org={w.get('organization')}")
        else:
            rec(4, False, f"unexpected wards: {arr}")
    else:
        rec(4, False, f"status={r.status_code} body={r.text[:200]}")

    # =================== S5 — /parent/attendance/{aarav_id} ===================
    if aarav_id:
        ok_all = True
        msgs = []
        for days in (7, 14, 200):
            r = requests.get(f"{BACKEND_URL}/parent/attendance/{aarav_id}", params={"days": days}, headers=H(tokens["parent_pws"]), timeout=20)
            if r.status_code != 200:
                ok_all = False
                msgs.append(f"days={days} → {r.status_code}")
                continue
            j = r.json()
            if not (isinstance(j.get("records"), list) and "days" in j):
                ok_all = False
                msgs.append(f"days={days} bad shape")
                continue
            msgs.append(f"days={days} records={len(j['records'])}")
        rec(5, ok_all, " | ".join(msgs))
    else:
        rec(5, False, "no aarav_id from login")

    # =================== S6 — random uuid → 404 ===================
    r = requests.get(f"{BACKEND_URL}/parent/attendance/{uuid.uuid4()}", headers=H(tokens["parent_pws"]), timeout=20)
    rec(6, r.status_code == 404, f"status={r.status_code} body={r.text[:80]}")

    # =================== S7 — parent_alpha fees ===================
    if aditya_id:
        r = requests.get(f"{BACKEND_URL}/parent/fees/{aditya_id}", headers=H(tokens["parent_alpha"]), timeout=20)
        if r.status_code == 200:
            j = r.json()
            fees = j.get("fees") or []
            summ = j.get("summary") or {}
            ok = len(fees) >= 2 and all(k in summ for k in ("total_due", "total_paid", "overdue_count"))
            rec(7, ok, f"fees_count={len(fees)} summary={summ}")
        else:
            rec(7, False, f"status={r.status_code} body={r.text[:200]}")
    else:
        rec(7, False, "no aditya_id from login")

    # =================== S8 — parent_pws fees for PWS student ===================
    if aarav_id:
        r = requests.get(f"{BACKEND_URL}/parent/fees/{aarav_id}", headers=H(tokens["parent_pws"]), timeout=20)
        if r.status_code == 200:
            j = r.json()
            ok = j.get("fees") == [] and (j.get("summary") or {}).get("total_due") == 0
            rec(8, ok, f"fees={j.get('fees')} summary={j.get('summary')}")
        else:
            rec(8, False, f"status={r.status_code}")
    else:
        rec(8, False, "no aarav_id")

    # =================== S9 — student auto-alert via /attendance/batch ===================
    today = today_str()
    if aarav_id:
        payload = {
            "date": today,
            "kind": "student",
            "group": "9-A",
            "marks": [{"person_id": aarav_id, "status": "absent"}],
        }
        r = requests.post(f"{BACKEND_URL}/attendance/batch", json=payload, headers=H(tokens["admin"]), timeout=20)
        if r.status_code == 200:
            inserted_attendance_keys.append((today, "student", "9-A", None, aarav_id))
            # short wait for the async hook (we await in code but call is synchronous within FastAPI)
            time.sleep(0.5)
            r2 = requests.get(f"{BACKEND_URL}/parent/alerts", headers=H(tokens["parent_pws"]), timeout=20)
            if r2.status_code == 200:
                j = r2.json()
                comp = j.get("computed") or []
                stored = j.get("stored") or []
                has_comp = any(a.get("type") == "absent_today" and a.get("ward_id") == aarav_id and a.get("severity") == "high" for a in comp)
                has_stored = any(s.get("type") == "absent_today" and s.get("person_id") == aarav_id for s in stored)
                ok = has_comp and has_stored
                rec(9, ok, f"computed={has_comp} stored={has_stored} stored_count={len(stored)} computed_count={len(comp)}")
            else:
                rec(9, False, f"/parent/alerts → {r2.status_code} {r2.text[:120]}")
        else:
            rec(9, False, f"POST /attendance/batch → {r.status_code} {r.text[:200]}")
    else:
        rec(9, False, "no aarav_id")

    # =================== S10 — player auto-alert via /coach/attendance ===================
    if aditya_id:
        payload = {
            "date": today,
            "slot": "Evening",
            "centre": "Balua",
            "sport": "Football",
            "absent_player_ids": [aditya_id],
        }
        r = requests.post(f"{BACKEND_URL}/coach/attendance", json=payload, headers=H(tokens["coach"]), timeout=20)
        if r.status_code == 200:
            inserted_attendance_keys.append((today, "player", None, "Evening", aditya_id))
            time.sleep(0.5)
            r2 = requests.get(f"{BACKEND_URL}/parent/alerts", headers=H(tokens["parent_alpha"]), timeout=20)
            if r2.status_code == 200:
                j = r2.json()
                comp = j.get("computed") or []
                stored = j.get("stored") or []
                has_comp = any(a.get("type") == "absent_today" and a.get("ward_id") == aditya_id for a in comp)
                has_stored = any(s.get("type") == "absent_today" and s.get("person_id") == aditya_id for s in stored)
                ok = has_comp and has_stored
                rec(10, ok, f"computed={has_comp} stored={has_stored} stored_count={len(stored)} computed_count={len(comp)} resp={r.json()}")
            else:
                rec(10, False, f"/parent/alerts → {r2.status_code}")
        else:
            rec(10, False, f"POST /coach/attendance → {r.status_code} {r.text[:200]}")
    else:
        rec(10, False, "no aditya_id")

    # =================== S11 — low_attendance_7d for Aarav ===================
    if aarav_id:
        ok_post = True
        for days_back in (1, 3, 5):
            d = date_n_days_ago(days_back)
            payload = {
                "date": d,
                "kind": "student",
                "group": "9-A",
                "marks": [{"person_id": aarav_id, "status": "absent"}],
            }
            r = requests.post(f"{BACKEND_URL}/attendance/batch", json=payload, headers=H(tokens["admin"]), timeout=20)
            if r.status_code != 200:
                ok_post = False
                break
            inserted_attendance_keys.append((d, "student", "9-A", None, aarav_id))
        if ok_post:
            time.sleep(0.5)
            r2 = requests.get(f"{BACKEND_URL}/parent/alerts", headers=H(tokens["parent_pws"]), timeout=20)
            if r2.status_code == 200:
                comp = r2.json().get("computed") or []
                match = [a for a in comp if a.get("type") == "low_attendance_7d" and a.get("ward_id") == aarav_id]
                ok = bool(match) and match[0].get("severity") == "medium"
                rec(11, ok, f"matches={len(match)} severity={match[0].get('severity') if match else None}")
            else:
                rec(11, False, f"/parent/alerts → {r2.status_code}")
        else:
            rec(11, False, "backfill failed")
    else:
        rec(11, False, "no aarav_id")

    # =================== S12 — fees_overdue for parent_alpha ===================
    r = requests.get(f"{BACKEND_URL}/parent/alerts", headers=H(tokens["parent_alpha"]), timeout=20)
    if r.status_code == 200:
        comp = r.json().get("computed") or []
        overdue = [a for a in comp if a.get("type") == "fees_overdue"]
        # Look up Aditya's fees to determine whether overdue should exist
        rf = requests.get(f"{BACKEND_URL}/parent/fees/{aditya_id}", headers=H(tokens["parent_alpha"]), timeout=20)
        fee_data = rf.json() if rf.status_code == 200 else {}
        cutoff = date_n_days_ago(7)
        fees = fee_data.get("fees") or []
        actually_overdue = [f for f in fees if (f.get("status") != "paid") and (f.get("due_date") or "9999") < cutoff]
        if actually_overdue:
            ok = bool(overdue) and ("amount_due" in (overdue[0] if overdue else {}))
            rec(12, ok, f"overdue_alerts={len(overdue)} expected={len(actually_overdue)} amount_due_present={'amount_due' in (overdue[0] if overdue else {})}")
        else:
            ok = (len(overdue) == 0)
            rec(12, ok, f"no fees with due_date<{cutoff} (alpha seed); alerts overdue={len(overdue)}")
    else:
        rec(12, False, f"/parent/alerts → {r.status_code}")

    # =================== S13 — link/unlink as super ===================
    # Pick some active student that isn't already linked to parent_pws
    r = requests.get(f"{BACKEND_URL}/people", params={"kind": "student", "group": "9-A"}, headers=H(tokens["super"]), timeout=20)
    candidates = [p for p in (r.json() if r.status_code == 200 else []) if p.get("id") != aarav_id and p.get("status") != "deactivated"]
    if candidates:
        target = candidates[0]
        target_id = target["id"]
        before_wards = requests.get(f"{BACKEND_URL}/parent/wards", headers=H(tokens["parent_pws"]), timeout=20).json()
        rl = requests.post(
            f"{BACKEND_URL}/people/{target_id}/link-parent",
            json={"user_id": users["parent_pws"]["id"]},
            headers=H(tokens["super"]),
            timeout=20,
        )
        after_wards = requests.get(f"{BACKEND_URL}/parent/wards", headers=H(tokens["parent_pws"]), timeout=20).json()
        ok_link = rl.status_code == 200 and (len(after_wards) == len(before_wards) + 1)
        # unlink
        ru = requests.delete(
            f"{BACKEND_URL}/people/{target_id}/link-parent/{users['parent_pws']['id']}",
            headers=H(tokens["super"]),
            timeout=20,
        )
        after2 = requests.get(f"{BACKEND_URL}/parent/wards", headers=H(tokens["parent_pws"]), timeout=20).json()
        ok_unlink = ru.status_code == 200 and (len(after2) == len(before_wards))
        rec(13, ok_link and ok_unlink, f"link={rl.status_code} before={len(before_wards)} after_link={len(after_wards)} unlink={ru.status_code} final={len(after2)}")
    else:
        rec(13, False, "no candidate student to link")

    # =================== S14 — teacher 403 + invalid parent 404 ===================
    if candidates:
        target_id = candidates[0]["id"]
        rt = requests.post(
            f"{BACKEND_URL}/people/{target_id}/link-parent",
            json={"user_id": users["parent_pws"]["id"]},
            headers=H(tokens["teacher"]),
            timeout=20,
        )
        # non-parent user — try super_admin's user_id, should 404
        rb = requests.post(
            f"{BACKEND_URL}/people/{target_id}/link-parent",
            json={"user_id": users["super"]["id"]},
            headers=H(tokens["super"]),
            timeout=20,
        )
        ok = (rt.status_code == 403) and (rb.status_code == 404)
        rec(14, ok, f"teacher_status={rt.status_code} bad_parent_status={rb.status_code}")
    else:
        rec(14, False, "no candidate")

    # =================== S15 — regression ===================
    rg1 = requests.get(f"{BACKEND_URL}/attendance/staff-list", headers=H(tokens["principal"]), timeout=20)
    rg2 = requests.get(f"{BACKEND_URL}/command-center", headers=H(tokens["admin"]), timeout=20)
    rg3 = requests.get(f"{BACKEND_URL}/coach/dashboard", headers=H(tokens["coach"]), timeout=20)
    ok = rg1.status_code == 200 and rg2.status_code == 200 and rg3.status_code == 200
    pws_staff_count = len(rg1.json() if rg1.status_code == 200 else [])
    rec(15, ok, f"principal_staff_list={rg1.status_code}(n={pws_staff_count}) admin_command={rg2.status_code} coach_dashboard={rg3.status_code}")

    # =================== CLEANUP ===================
    print("\n--- Cleanup ---")
    # Cleanup attendance via direct mongo (avoid leaving today/back-dated absent records lingering)
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        cli = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        ddb = cli[os.environ.get("DB_NAME", "pws_alpha_db")]

        async def _clean():
            cutoff = date_n_days_ago(8)
            for pid in [x for x in (aarav_id, aditya_id) if x]:
                resd = await ddb.attendance.delete_many({"person_id": pid, "date": {"$gte": cutoff}})
                print(f"  deleted attendance for {pid}: {resd.deleted_count}")
            # delete parent notifications created by hook for these test runs
            resn = await ddb.notifications.delete_many({
                "user_id": {"$in": [users["parent_pws"]["id"], users["parent_alpha"]["id"]]},
                "type": "absent_today",
            })
            print(f"  deleted parent notifications: {resn.deleted_count}")
        asyncio.get_event_loop().run_until_complete(_clean())
    except Exception as e:
        print(f"  cleanup failed: {e}")

    # =================== SUMMARY ===================
    print("\n========= SUMMARY =========")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"{passed}/{total} scenarios passed")
    for sid, ok, msg in results:
        flag = "PASS" if ok else "FAIL"
        print(f"  S{sid}: {flag} — {msg}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
