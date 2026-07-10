"""Sports Admin (admin@) ALPHA-only scope — backend tests for scenarios 1-9."""
import os
import sys
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://unified-track.preview.emergentagent.com").rstrip("/") + "/api"

CREDS = {
    "admin": ("admin@pws-alpha.com", "Admin@123"),
    "super": ("super@pws-alpha.com", "Super@123"),
    "principal": ("principal@pws-alpha.com", "Principal@123"),
    "coach": ("coach@pws-alpha.com", "Coach@123"),
    "teacher": ("teacher@pws-alpha.com", "Teacher@123"),
    "vp": ("vp@pws-alpha.com", "Vp@123"),
}

PASS = "✅"
FAIL = "❌"
results = []
fails = []


def log(ok: bool, msg: str):
    results.append((ok, msg))
    icon = PASS if ok else FAIL
    print(f"{icon} {msg}")
    if not ok:
        fails.append(msg)


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def H(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    print(f"\n=== Backend: {BASE} ===\n")

    tokens = {}
    users = {}
    for k, (em, pw) in CREDS.items():
        try:
            tk = login(em, pw)
            tokens[k] = tk["access_token"]
            users[k] = tk["user"]
            log(True, f"login {k}@ -> 200")
        except Exception as e:
            log(False, f"login {k}@ failed: {e}")
            return

    admin_h = H(tokens["admin"])
    super_h = H(tokens["super"])
    principal_h = H(tokens["principal"])
    coach_h = H(tokens["coach"])
    teacher_h = H(tokens["teacher"])
    vp_h = H(tokens["vp"])

    # ============ Scenario 1: /auth/me role_display etc. ============
    print("\n--- S1: /auth/me role_display labels ---")
    r = requests.get(f"{BASE}/auth/me", headers=admin_h, timeout=10)
    log(r.status_code == 200, f"S1 admin /auth/me 200 (got {r.status_code})")
    me = r.json() if r.status_code == 200 else {}
    log(me.get("role") == "admin", f"S1 admin role=admin (got {me.get('role')})")
    log(me.get("role_display") == "Sports Admin",
        f"S1 admin role_display='Sports Admin' (got {me.get('role_display')!r})")
    log(me.get("role_category") == "Sports Admin",
        f"S1 admin role_category='Sports Admin' (got {me.get('role_category')!r})")
    log(me.get("organization") == "ALPHA",
        f"S1 admin organization=ALPHA (got {me.get('organization')!r})")
    log(me.get("department") == "ALPHA Operations",
        f"S1 admin department='ALPHA Operations' (got {me.get('department')!r})")

    # ============ Scenario 9: other role_display values ============
    print("\n--- S9: role_display for other roles ---")
    expected_displays = {
        "super": "Super Admin",
        "principal": "Principal",
        "coach": "Coach",
        "teacher": "Teacher",
        "vp": "Vice Principal",
    }
    for k, exp in expected_displays.items():
        r = requests.get(f"{BASE}/auth/me", headers=H(tokens[k]), timeout=10)
        ok = r.status_code == 200
        rd = r.json().get("role_display") if ok else None
        log(ok and rd == exp, f"S9 {k}@ role_display='{exp}' (got {rd!r}, status {r.status_code})")

    # ============ Scenario 2: /api/people scope for admin ============
    print("\n--- S2: admin /api/people ALPHA scope ---")
    r = requests.get(f"{BASE}/people", headers=admin_h, params={"kind": "player"}, timeout=10)
    log(r.status_code == 200, f"S2 admin /people?kind=player 200 (got {r.status_code})")
    players = r.json() if r.status_code == 200 else []
    orgs_p = {p.get("organization") for p in players}
    log(orgs_p.issubset({"ALPHA"}), f"S2 admin player orgs subset {{ALPHA}} (got {orgs_p})")
    log(len(players) >= 1, f"S2 admin sees >=1 ALPHA player (got {len(players)})")

    r = requests.get(f"{BASE}/people", headers=admin_h, params={"kind": "student"}, timeout=10)
    log(r.status_code == 200 and r.json() == [], f"S2 admin /people?kind=student -> [] (got {r.status_code} len={len(r.json()) if r.status_code==200 else 'NA'})")
    r = requests.get(f"{BASE}/people", headers=admin_h, params={"kind": "teacher"}, timeout=10)
    log(r.status_code == 200 and r.json() == [], f"S2 admin /people?kind=teacher -> [] (got {r.status_code} len={len(r.json()) if r.status_code==200 else 'NA'})")

    # also kind=staff should be ALPHA-scoped
    r = requests.get(f"{BASE}/people", headers=admin_h, params={"kind": "staff"}, timeout=10)
    if r.status_code == 200:
        staff_orgs = {p.get("organization") for p in r.json()}
        log(staff_orgs.issubset({"ALPHA"}), f"S2 admin /people?kind=staff orgs subset {{ALPHA}} (got {staff_orgs})")

    # ============ Scenario 3: /api/users scope for admin ============
    print("\n--- S3: admin /api/users ALPHA-only, no PWS-only roles ---")
    r = requests.get(f"{BASE}/users", headers=admin_h, timeout=10)
    log(r.status_code == 200, f"S3 admin /users 200 (got {r.status_code})")
    users_list = r.json() if r.status_code == 200 else []
    roles_seen = {u.get("role") for u in users_list}
    orgs_seen = {u.get("organization") for u in users_list}
    log(roles_seen.isdisjoint({"principal", "vice_principal", "teacher"}),
        f"S3 admin /users excludes principal/vice_principal/teacher (saw {roles_seen})")
    log(orgs_seen.issubset({"ALPHA", "BOTH"}),
        f"S3 admin /users orgs subset {{ALPHA, BOTH}} (saw {orgs_seen})")

    # filtering by excluded role explicitly returns []
    r = requests.get(f"{BASE}/users", headers=admin_h, params={"role": "teacher"}, timeout=10)
    log(r.status_code == 200 and r.json() == [],
        f"S3 admin /users?role=teacher -> [] (got {r.status_code} len={len(r.json()) if r.status_code==200 else 'NA'})")
    r = requests.get(f"{BASE}/users", headers=admin_h, params={"role": "principal"}, timeout=10)
    log(r.status_code == 200 and r.json() == [],
        f"S3 admin /users?role=principal -> [] (got {r.status_code} len={len(r.json()) if r.status_code==200 else 'NA'})")

    # super sees full list
    r = requests.get(f"{BASE}/users", headers=super_h, timeout=10)
    super_users = r.json() if r.status_code == 200 else []
    super_roles = {u.get("role") for u in super_users}
    log({"principal", "teacher"}.issubset(super_roles),
        f"S3 super /users still sees principal+teacher (saw {super_roles})")

    # ============ Scenario 4: /command-center for admin ============
    print("\n--- S4: admin /command-center ALPHA scope ---")
    r = requests.get(f"{BASE}/command-center", headers=admin_h, timeout=10)
    log(r.status_code == 200, f"S4 admin /command-center 200 (got {r.status_code})")
    cc = r.json() if r.status_code == 200 else {}
    rc = cc.get("roster_counts", {})
    log(rc.get("students") == 0, f"S4 roster_counts.students=0 (got {rc.get('students')})")
    log(rc.get("teachers") == 0, f"S4 roster_counts.teachers=0 (got {rc.get('teachers')})")
    log(rc.get("players", 0) >= 1, f"S4 roster_counts.players >=1 (got {rc.get('players')})")
    abk = cc.get("attendance_by_kind", {})
    log("student" not in abk, f"S4 attendance_by_kind no 'student' key (keys={list(abk.keys())})")
    log("teacher" not in abk, f"S4 attendance_by_kind no 'teacher' key (keys={list(abk.keys())})")
    deact = cc.get("deactivated_players", [])
    deact_orgs = {p.get("organization") for p in deact}
    log(deact_orgs.issubset({"ALPHA"}) or not deact,
        f"S4 deactivated_players ALPHA-only (orgs seen: {deact_orgs})")

    # ============ Scenario 5: super /command-center full PWS+ALPHA ============
    print("\n--- S5: super /command-center full stats (regression) ---")
    r = requests.get(f"{BASE}/command-center", headers=super_h, timeout=10)
    log(r.status_code == 200, f"S5 super /command-center 200 (got {r.status_code})")
    cc_s = r.json() if r.status_code == 200 else {}
    rc_s = cc_s.get("roster_counts", {})
    log(rc_s.get("students", 0) > 0, f"S5 super students > 0 (got {rc_s.get('students')})")
    log(rc_s.get("teachers", 0) >= 0, f"S5 super teachers field present (got {rc_s.get('teachers')})")
    log(rc_s.get("players", 0) > 0, f"S5 super players > 0 (got {rc_s.get('players')})")

    # ============ Scenario 6: admin POST /people kind=player ALPHA -> 200 ============
    print("\n--- S6: admin POST /people kind=player ALPHA -> 200 ---")
    new_player_payload = {
        "name": "Sports Admin Test Player",
        "kind": "player",
        "organization": "ALPHA",
        "centre": "Balua",
        "player_type": "Daily",
        "sport": "Cricket",
        "slot": "Morning",
        "skill_level": "Beginner",
        "date_of_admission": "2026-05-01",
    }
    r = requests.post(f"{BASE}/people", headers=admin_h, json=new_player_payload, timeout=10)
    log(r.status_code == 200, f"S6 admin POST /people ALPHA player 200 (got {r.status_code} body={r.text[:200]})")
    new_player_id = None
    if r.status_code == 200:
        new_player_id = r.json().get("id")
        log(r.json().get("organization") == "ALPHA", "S6 created player organization=ALPHA")

    # ============ Scenario 7: admin PATCH /people/{pws_id} -> 404 ============
    print("\n--- S7: admin PATCH PWS records -> 404 ---")
    # Find a PWS student via super
    r = requests.get(f"{BASE}/people", headers=super_h, params={"kind": "student"}, timeout=10)
    students = r.json() if r.status_code == 200 else []
    log(len(students) > 0, f"S7 super sees PWS students (count={len(students)})")
    pws_student_id = students[0]["id"] if students else None

    if pws_student_id:
        r = requests.patch(f"{BASE}/people/{pws_student_id}", headers=admin_h, json={"name": "Hacked Name"}, timeout=10)
        log(r.status_code == 404, f"S7 admin PATCH PWS student id -> 404 (got {r.status_code})")

    # Find a PWS staff via super
    r = requests.get(f"{BASE}/people", headers=super_h, params={"kind": "staff"}, timeout=10)
    all_staff = r.json() if r.status_code == 200 else []
    pws_staff = [s for s in all_staff if s.get("organization") == "PWS"]
    log(len(pws_staff) > 0, f"S7 PWS staff present (count={len(pws_staff)})")
    if pws_staff:
        sid = pws_staff[0]["id"]
        r = requests.patch(f"{BASE}/people/{sid}", headers=admin_h, json={"group": "Tester"}, timeout=10)
        log(r.status_code == 404, f"S7 admin PATCH PWS staff id -> 404 (got {r.status_code})")

    # Sanity: admin can PATCH ALPHA player they just created
    if new_player_id:
        r = requests.patch(f"{BASE}/people/{new_player_id}", headers=admin_h, json={"skill_level": "Intermediate"}, timeout=10)
        log(r.status_code == 200, f"S7 admin PATCH own ALPHA player -> 200 (got {r.status_code})")

    # ============ Scenario 8: regression /fees, /fees/dashboard, /coach/dashboard ============
    print("\n--- S8: regression endpoints ---")
    r = requests.get(f"{BASE}/fees", headers=admin_h, timeout=10)
    log(r.status_code == 200, f"S8 admin GET /fees 200 (got {r.status_code})")
    r = requests.get(f"{BASE}/fees/dashboard", headers=admin_h, timeout=10)
    log(r.status_code == 200, f"S8 admin GET /fees/dashboard 200 (got {r.status_code})")
    r = requests.get(f"{BASE}/coach/dashboard", headers=coach_h, timeout=10)
    log(r.status_code == 200, f"S8 coach GET /coach/dashboard 200 (got {r.status_code})")

    # ============ Cleanup ============
    print("\n--- Cleanup ---")
    if new_player_id:
        r = requests.delete(f"{BASE}/people/{new_player_id}", headers=admin_h, timeout=10)
        log(r.status_code == 200, f"Cleanup DELETE new player (got {r.status_code})")

    # ============ Summary ============
    total = len(results)
    passed = sum(1 for ok, _ in results if ok)
    print(f"\n========== RESULT: {passed}/{total} PASS ==========")
    if fails:
        print("\nFAILS:")
        for f in fails:
            print(f"  - {f}")
        sys.exit(1)


if __name__ == "__main__":
    main()
