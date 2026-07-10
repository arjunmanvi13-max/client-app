"""Backend test suite for PWS & ALPHA Tracker — focus: new staff attendance / org-access endpoints."""
import os
import sys
import json
import requests
from typing import Optional

BASE = os.environ.get("BACKEND_BASE", "https://unified-track.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

CREDS = {
    "admin":      ("admin@pws-alpha.com",      "Admin@123"),
    "super":      ("super@pws-alpha.com",      "Super@123"),
    "principal":  ("principal@pws-alpha.com",  "Principal@123"),
    "vp":         ("vp@pws-alpha.com",         "Vp@123"),
    "teacher":    ("teacher@pws-alpha.com",    "Teacher@123"),
    "coach":      ("coach@pws-alpha.com",      "Coach@123"),
    "asst_coach": ("asst_coach@pws-alpha.com", "Asst@123"),
    "warden":     ("warden@pws-alpha.com",     "Warden@123"),
    "student":    ("student@pws-alpha.com",    "Student@123"),
    "player":     ("player@pws-alpha.com",     "Player@123"),
    "staff":      ("staff@pws-alpha.com",      "Staff@123"),  # deleted, should 401
}

PASS = []
FAIL = []


def rec(name: str, ok: bool, detail: str = ""):
    (PASS if ok else FAIL).append((name, detail))
    print(f"  {'PASS' if ok else 'FAIL'}: {name}{(' — ' + detail) if detail else ''}")


def login(key: str) -> Optional[dict]:
    email, password = CREDS[key]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        return None
    return r.json()


def hdrs(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def section(title: str):
    print(f"\n=== {title} ===")


# -------------------- 1. Deleted staff login --------------------
def test_staff_deleted():
    section("1. Deleted staff@ login must 401")
    r = requests.post(f"{API}/auth/login", json={"email": "staff@pws-alpha.com", "password": "Staff@123"}, timeout=30)
    rec("staff@ login returns 401", r.status_code == 401, f"status={r.status_code}")


# -------------------- 2. All logins work & auth/me has coach_type --------------------
_tokens = {}
_users = {}


def test_logins_and_me():
    section("2. Login all roles; /auth/me returns coach_type")
    for k in ["admin", "super", "principal", "vp", "teacher", "coach", "asst_coach", "warden", "student", "player"]:
        out = login(k)
        ok = out is not None and "access_token" in out
        rec(f"login {k}", ok, f"email={CREDS[k][0]}")
        if out:
            _tokens[k] = out["access_token"]
            _users[k] = out["user"]

    # coach_type expectations via auth/me
    expectations = {
        "principal": None,
        "vp": None,
        "teacher": None,
        "coach": "head",
        "asst_coach": "assistant",
        "admin": None,
        "warden": None,
        "student": None,
        "player": None,
    }
    for k, expected in expectations.items():
        if k not in _tokens:
            continue
        r = requests.get(f"{API}/auth/me", headers=hdrs(_tokens[k]), timeout=30)
        if r.status_code != 200:
            rec(f"/auth/me ({k})", False, f"status={r.status_code}")
            continue
        ct = r.json().get("coach_type")
        ok = ct == expected
        rec(f"auth/me coach_type ({k}) == {expected}", ok, f"got={ct}")

    # sanity: role fields
    rec("principal.role=='principal'", _users.get("principal", {}).get("role") == "principal",
        f"got={_users.get('principal', {}).get('role')}")
    rec("vp.role=='vice_principal'", _users.get("vp", {}).get("role") == "vice_principal",
        f"got={_users.get('vp', {}).get('role')}")


# -------------------- 3. Principal: staff-list & mark --------------------
PWS_EXPECTED = {"Reena Devi", "Manoj Pandey", "Geeta Kumari"}


def test_principal():
    section("3. Principal -> PWS staff only")
    tok = _tokens["principal"]
    r = requests.get(f"{API}/attendance/staff-list", headers=hdrs(tok), timeout=30)
    ok = r.status_code == 200
    rec("GET /attendance/staff-list (principal)", ok, f"status={r.status_code}")
    if ok:
        names = {s["name"] for s in r.json()}
        rec("principal sees exactly PWS 3 staff", names == PWS_EXPECTED, f"got={sorted(names)}")
        orgs = {s.get("organization") for s in r.json()}
        rec("principal staff all PWS org", orgs == {"PWS"}, f"orgs={orgs}")

    r2 = requests.post(f"{API}/attendance/staff",
                       headers=hdrs(tok),
                       json={"date": "2026-05-04", "absent_staff_ids": []}, timeout=30)
    ok2 = r2.status_code == 200
    rec("POST /attendance/staff (principal, no org)", ok2, f"status={r2.status_code} body={r2.text[:160]}")
    if ok2:
        body = r2.json()
        rec("principal POST infers PWS + count=3", body.get("organization") == "PWS" and body.get("count") == 3,
            f"body={body}")


def test_vp():
    section("3b. Vice Principal -> same as Principal")
    tok = _tokens["vp"]
    r = requests.get(f"{API}/attendance/staff-list", headers=hdrs(tok), timeout=30)
    ok = r.status_code == 200
    rec("GET /attendance/staff-list (vp)", ok, f"status={r.status_code}")
    if ok:
        names = {s["name"] for s in r.json()}
        rec("vp sees exactly PWS 3 staff", names == PWS_EXPECTED, f"got={sorted(names)}")
    r2 = requests.post(f"{API}/attendance/staff", headers=hdrs(tok),
                       json={"date": "2026-05-04", "absent_staff_ids": []}, timeout=30)
    ok2 = r2.status_code == 200
    rec("POST /attendance/staff (vp, no org)", ok2, f"status={r2.status_code}")
    if ok2:
        body = r2.json()
        rec("vp POST infers PWS + count=3", body.get("organization") == "PWS" and body.get("count") == 3,
            f"body={body}")


# -------------------- 4. Head coach (Balua) --------------------
ALPHA_BALUA_STAFF = {"Alok Singh", "Neeraj Raj"}


def test_head_coach():
    section("4. Head coach -> ALPHA Balua staff")
    tok = _tokens["coach"]
    r = requests.get(f"{API}/attendance/staff-list", headers=hdrs(tok), timeout=30)
    ok = r.status_code == 200
    rec("GET /attendance/staff-list (head coach)", ok, f"status={r.status_code}")
    if ok:
        names = {s["name"] for s in r.json()}
        rec("head coach sees ALPHA Balua staff only", names == ALPHA_BALUA_STAFF,
            f"got={sorted(names)}")

    # POST with centre=Balua
    r2 = requests.post(f"{API}/attendance/staff", headers=hdrs(tok),
                       json={"date": "2026-05-04", "centre": "Balua", "absent_staff_ids": []}, timeout=30)
    ok2 = r2.status_code == 200
    rec("POST /attendance/staff (coach, Balua)", ok2, f"status={r2.status_code} body={r2.text[:160]}")
    if ok2:
        body = r2.json()
        rec("coach Balua POST infers ALPHA + count=2",
            body.get("organization") == "ALPHA" and body.get("count") == 2, f"body={body}")

    # POST with centre=Harding Park -> 403
    r3 = requests.post(f"{API}/attendance/staff", headers=hdrs(tok),
                       json={"date": "2026-05-04", "centre": "Harding Park", "absent_staff_ids": []}, timeout=30)
    rec("POST /attendance/staff (coach, Harding Park) -> 403", r3.status_code == 403,
        f"status={r3.status_code} body={r3.text[:160]}")


# -------------------- 5. Assistant coach & other roles forbidden --------------------
def test_forbidden_roles():
    section("5-6. Forbidden roles (asst_coach, teacher, warden, student, player)")
    for role in ["asst_coach", "teacher", "warden", "student", "player"]:
        tok = _tokens.get(role)
        if not tok:
            continue
        r = requests.get(f"{API}/attendance/staff-list", headers=hdrs(tok), timeout=30)
        rec(f"GET staff-list ({role}) -> 403", r.status_code == 403, f"status={r.status_code}")
        r2 = requests.post(f"{API}/attendance/staff", headers=hdrs(tok),
                           json={"date": "2026-05-04", "absent_staff_ids": []}, timeout=30)
        rec(f"POST staff ({role}) -> 403", r2.status_code == 403, f"status={r2.status_code}")


# -------------------- 7. Admin behaviour --------------------
def test_admin():
    section("7. Admin staff attendance")
    tok = _tokens["admin"]
    # No org -> 400
    r = requests.post(f"{API}/attendance/staff", headers=hdrs(tok),
                      json={"date": "2026-05-04", "absent_staff_ids": []}, timeout=30)
    rec("admin POST w/o organization -> 400", r.status_code == 400, f"status={r.status_code} body={r.text[:160]}")

    # org=PWS -> 200 with count=3
    r2 = requests.post(f"{API}/attendance/staff", headers=hdrs(tok),
                       json={"date": "2026-05-04", "organization": "PWS", "absent_staff_ids": []}, timeout=30)
    ok2 = r2.status_code == 200
    rec("admin POST org=PWS", ok2, f"status={r2.status_code} body={r2.text[:160]}")
    if ok2:
        rec("admin PWS count=3", r2.json().get("count") == 3, f"body={r2.json()}")

    # org=ALPHA + Harding Park -> 200 with count=1 (Sunita Das)
    r3 = requests.post(f"{API}/attendance/staff", headers=hdrs(tok),
                       json={"date": "2026-05-04", "organization": "ALPHA", "centre": "Harding Park",
                             "absent_staff_ids": []}, timeout=30)
    ok3 = r3.status_code == 200
    rec("admin POST org=ALPHA centre=Harding Park", ok3, f"status={r3.status_code} body={r3.text[:160]}")
    if ok3:
        rec("admin ALPHA/HardingPark count=1", r3.json().get("count") == 1, f"body={r3.json()}")


# -------------------- 9. Regressions --------------------
def test_regressions():
    section("9. Regression: existing endpoints")
    # command-center as admin
    r = requests.get(f"{API}/command-center", headers=hdrs(_tokens["admin"]), timeout=30)
    rec("GET /command-center (admin)", r.status_code == 200, f"status={r.status_code}")

    # coach dashboard
    r = requests.get(f"{API}/coach/dashboard", headers=hdrs(_tokens["coach"]), timeout=30)
    rec("GET /coach/dashboard (coach)", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        rec("coach dashboard has total_players>0", r.json().get("total_players", 0) > 0, f"body keys={list(r.json().keys())}")

    # coach attendance mark
    r = requests.post(f"{API}/coach/attendance",
                      headers=hdrs(_tokens["coach"]),
                      json={"date": "2026-05-04", "slot": "Morning", "centre": "Balua",
                            "sport": "Cricket", "absent_player_ids": []}, timeout=30)
    rec("POST /coach/attendance (head coach)", r.status_code == 200, f"status={r.status_code} body={r.text[:160]}")

    # People list kind=staff
    r = requests.get(f"{API}/people?kind=staff", headers=hdrs(_tokens["admin"]), timeout=30)
    rec("GET /people?kind=staff (admin)", r.status_code == 200 and len(r.json()) >= 6,
        f"status={r.status_code} count={len(r.json()) if r.status_code==200 else '-'}")

    # People list kind=player
    r = requests.get(f"{API}/people?kind=player", headers=hdrs(_tokens["admin"]), timeout=30)
    rec("GET /people?kind=player (admin)", r.status_code == 200 and len(r.json()) >= 6,
        f"status={r.status_code}")

    # Harding-Park = Daily validation on Person creation
    admin_tok = _tokens["admin"]
    bad_payload = {
        "name": "Test Hostel Invalid HP",
        "kind": "player",
        "group": "U-15 Cricket",
        "sport": "Cricket",
        "organization": "ALPHA",
        "centre": "Harding Park",
        "player_type": "Hostel",
        "slot": "Morning",
    }
    r = requests.post(f"{API}/people", headers=hdrs(admin_tok), json=bad_payload, timeout=30)
    rec("POST /people Harding-Park+Hostel -> 400", r.status_code == 400, f"status={r.status_code} body={r.text[:160]}")

    # Valid player Harding-Park Daily
    good_payload = {**bad_payload, "name": "Test HP Daily Regression", "player_type": "Daily"}
    r = requests.post(f"{API}/people", headers=hdrs(admin_tok), json=good_payload, timeout=30)
    ok_create = r.status_code == 200
    rec("POST /people Harding-Park+Daily -> 200", ok_create, f"status={r.status_code}")
    created_id = r.json().get("id") if ok_create else None

    # PATCH to Hostel -> 400 (after merge validation)
    if created_id:
        r = requests.patch(f"{API}/people/{created_id}", headers=hdrs(admin_tok),
                           json={"player_type": "Hostel"}, timeout=30)
        rec("PATCH /people HP -> Hostel blocked", r.status_code == 400, f"status={r.status_code}")
        # cleanup
        requests.delete(f"{API}/people/{created_id}", headers=hdrs(admin_tok), timeout=30)

    # staff person CRUD (create + delete)
    staff_payload = {
        "name": "Test Staff Regression",
        "kind": "staff",
        "group": "Driver",
        "organization": "ALPHA",
        "centre": "Balua",
    }
    r = requests.post(f"{API}/people", headers=hdrs(admin_tok), json=staff_payload, timeout=30)
    ok_staff = r.status_code == 200
    rec("POST /people kind=staff (admin)", ok_staff, f"status={r.status_code} body={r.text[:160]}")
    if ok_staff:
        sid = r.json().get("id")
        r = requests.delete(f"{API}/people/{sid}", headers=hdrs(admin_tok), timeout=30)
        rec("DELETE /people staff (admin)", r.status_code == 200, f"status={r.status_code}")


# -------------------- 8. GET /attendance/staff history role-scoped --------------------
def test_staff_history():
    section("8. GET /attendance/staff history endpoint")
    # principal gets only PWS records
    r = requests.get(f"{API}/attendance/staff?date=2026-05-04", headers=hdrs(_tokens["principal"]), timeout=30)
    ok = r.status_code == 200
    rec("GET /attendance/staff history (principal)", ok, f"status={r.status_code}")
    # head coach
    r = requests.get(f"{API}/attendance/staff?date=2026-05-04", headers=hdrs(_tokens["coach"]), timeout=30)
    rec("GET /attendance/staff history (head coach)", r.status_code == 200, f"status={r.status_code}")
    # asst coach -> 403
    r = requests.get(f"{API}/attendance/staff?date=2026-05-04", headers=hdrs(_tokens["asst_coach"]), timeout=30)
    rec("GET /attendance/staff history (asst coach) -> 403", r.status_code == 403, f"status={r.status_code}")


def main():
    print(f"Base: {API}")
    test_staff_deleted()
    test_logins_and_me()
    test_principal()
    test_vp()
    test_head_coach()
    test_forbidden_roles()
    test_admin()
    test_staff_history()
    test_regressions()

    print("\n" + "=" * 60)
    print(f"TOTAL PASS: {len(PASS)}   FAIL: {len(FAIL)}")
    if FAIL:
        print("\nFailures:")
        for n, d in FAIL:
            print(f" - {n} :: {d}")
    sys.exit(0 if not FAIL else 1)


if __name__ == "__main__":
    main()
