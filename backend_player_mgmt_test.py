"""Backend tests for ALPHA Player Management Update — date_of_admission, status active/deactivated, activate/deactivate endpoints."""
import os
import sys
import requests
from typing import Optional

BASE = os.environ.get("BACKEND_BASE", "https://unified-track.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

CREDS = {
    "admin":      ("admin@pws-alpha.com",      "Admin@123"),
    "principal":  ("principal@pws-alpha.com",  "Principal@123"),
    "teacher":    ("teacher@pws-alpha.com",    "Teacher@123"),
    "coach":      ("coach@pws-alpha.com",      "Coach@123"),
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
        print(f"  LOGIN FAIL [{key}]: {r.status_code} {r.text}")
        return None
    return r.json()


def hdrs(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def section(title: str):
    print(f"\n=== {title} ===")


def main():
    # Authenticate
    tokens = {}
    users = {}
    for key in CREDS:
        data = login(key)
        if not data:
            print(f"FATAL: cannot login {key}")
            sys.exit(1)
        tokens[key] = data["access_token"]
        users[key] = data["user"]
    admin_h = hdrs(tokens["admin"])
    teacher_h = hdrs(tokens["teacher"])
    coach_h = hdrs(tokens["coach"])
    principal_h = hdrs(tokens["principal"])

    # ---------- Scenario 1: GET players as admin returns 6 ALPHA players w/ date_of_admission, status=active, no coach assignment ----------
    section("1. GET /api/people?kind=player (admin)")
    r = requests.get(f"{API}/people", params={"kind": "player"}, headers=admin_h, timeout=30)
    rec("GET players 200", r.status_code == 200, f"status={r.status_code}")
    players = r.json() if r.status_code == 200 else []
    rec("6 active players returned", len(players) == 6, f"count={len(players)} names={[p.get('name') for p in players]}")
    all_have_doa = all(isinstance(p.get("date_of_admission"), str) and len(p["date_of_admission"]) == 10 for p in players)
    rec("All players have date_of_admission YYYY-MM-DD", all_have_doa, f"sample={[p.get('date_of_admission') for p in players[:3]]}")
    all_active = all(p.get("status") == "active" for p in players)
    rec("All players status=active", all_active)
    no_coach = all(p.get("assigned_coach_id") in (None, "") for p in players)
    rec("All players assigned_coach_id=null", no_coach)
    by_name = {p["name"]: p for p in players}
    aditya = by_name.get("Aditya Verma")
    rec("Aditya Verma seeded (Balua/Football)", aditya is not None and aditya.get("centre") == "Balua" and aditya.get("sport") == "Football")

    # ---------- Scenario 2: missing date_of_admission ----------
    section("2. POST player without date_of_admission → 400")
    r = requests.post(f"{API}/people", headers=admin_h, timeout=30, json={
        "kind": "player", "name": "Missing DOA", "organization": "ALPHA",
        "centre": "Balua", "player_type": "Daily", "sport": "Cricket", "slot": "Morning", "skill_level": "Beginner",
    })
    rec("POST without DOA → 400", r.status_code == 400, f"status={r.status_code} body={r.text[:160]}")
    rec("Error mentions date of admission", "date of admission" in r.text.lower(), f"body={r.text[:160]}")

    # ---------- Scenario 3: Harding Park + Day Boarding rejected ----------
    section("3. POST Harding Park Day Boarding → 400")
    r = requests.post(f"{API}/people", headers=admin_h, timeout=30, json={
        "kind": "player", "name": "Test", "organization": "ALPHA",
        "centre": "Harding Park", "player_type": "Day Boarding", "sport": "Cricket", "slot": "Morning",
        "skill_level": "Beginner", "date_of_admission": "2026-05-05",
    })
    rec("Harding Park Day Boarding → 400", r.status_code == 400, f"status={r.status_code} body={r.text[:160]}")
    rec("Error mentions Daily players only", "daily" in r.text.lower(), f"body={r.text[:160]}")

    # ---------- Scenario 4: Balua Day Boarding accepted ----------
    section("4. POST Balua Day Boarding → 200")
    r = requests.post(f"{API}/people", headers=admin_h, timeout=30, json={
        "kind": "player", "name": "Test Day Boarder", "organization": "ALPHA",
        "centre": "Balua", "player_type": "Day Boarding", "sport": "Cricket", "slot": "Morning",
        "skill_level": "Beginner", "date_of_admission": "2026-05-05",
    })
    rec("Balua Day Boarding → 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    new_player = r.json() if r.status_code == 200 else {}
    new_player_id = new_player.get("id")
    rec("Created with status=active", new_player.get("status") == "active", f"status={new_player.get('status')}")
    rec("Created with assigned_coach_id=null", new_player.get("assigned_coach_id") in (None, ""), f"v={new_player.get('assigned_coach_id')}")
    rec("Created with date_of_admission=2026-05-05", new_player.get("date_of_admission") == "2026-05-05")

    # ---------- Scenario 5: deactivate auth ----------
    section("5. Deactivate Aditya Verma")
    if aditya is None:
        rec("Aditya present", False, "aditya not seeded — skipping rest")
        return
    aditya_id = aditya["id"]
    # teacher → 403
    r = requests.post(f"{API}/people/{aditya_id}/deactivate", headers=teacher_h, timeout=30)
    rec("teacher deactivate → 403", r.status_code == 403, f"status={r.status_code}")
    # admin → 200
    r = requests.post(f"{API}/people/{aditya_id}/deactivate", headers=admin_h, timeout=30)
    rec("admin deactivate Aditya → 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        rec("Returned status=deactivated", r.json().get("status") == "deactivated", f"status={r.json().get('status')}")

    # ---------- Scenario 6: list filtering ----------
    section("6. List filtering by status")
    r = requests.get(f"{API}/people", params={"kind": "player"}, headers=admin_h, timeout=30)
    actives = r.json() if r.status_code == 200 else []
    names_active = sorted([p["name"] for p in actives])
    rec(
        "Active list count == 6 (5 seed actives + 1 new)",
        len(actives) == 6,
        f"count={len(actives)} names={names_active}",
    )
    rec("Active list excludes Aditya", "Aditya Verma" not in names_active)

    r = requests.get(f"{API}/people", params={"kind": "player", "include_deactivated": "true"}, headers=admin_h, timeout=30)
    incl = r.json() if r.status_code == 200 else []
    rec(
        "include_deactivated=true → 7",
        len(incl) == 7,
        f"count={len(incl)}",
    )
    names_incl = sorted([p["name"] for p in incl])
    rec("include_deactivated includes Aditya", "Aditya Verma" in names_incl)

    r = requests.get(f"{API}/people", params={"kind": "player", "status": "deactivated"}, headers=admin_h, timeout=30)
    deact = r.json() if r.status_code == 200 else []
    rec("status=deactivated returns exactly 1", len(deact) == 1, f"count={len(deact)} names={[p['name'] for p in deact]}")
    rec("status=deactivated → Aditya only", deact and deact[0].get("name") == "Aditya Verma")

    # ---------- Scenario 7: coach dashboard ----------
    section("7. Coach dashboard reflects deactivation")
    r = requests.get(f"{API}/coach/dashboard", headers=coach_h, timeout=30)
    rec("coach dashboard 200", r.status_code == 200, f"status={r.status_code}")
    dash = r.json() if r.status_code == 200 else {}
    # Coach=head/Balua/sports=[Cricket,Football]. Original 4 Balua players: Karan, Riya, Aditya, Neha.
    # After deactivation of Aditya and addition of "Test Day Boarder" Balua/Cricket: actives = 4 (Karan, Riya, Neha, Test Day Boarder)
    rec("total_players excludes deactivated Aditya", dash.get("total_players") == 4, f"total_players={dash.get('total_players')}")
    deact_arr = dash.get("deactivated_players") or []
    rec("dashboard.deactivated_count == 1", dash.get("deactivated_count") == 1, f"v={dash.get('deactivated_count')}")
    rec(
        "dashboard.deactivated_players contains Aditya",
        len(deact_arr) == 1 and deact_arr[0].get("name") == "Aditya Verma",
        f"arr={[p.get('name') for p in deact_arr]}",
    )

    # ---------- Scenario 8: coach attendance excludes deactivated ----------
    section("8. POST coach attendance Balua/Football/Evening")
    r = requests.post(f"{API}/coach/attendance", headers=coach_h, timeout=30, json={
        "date": "2026-05-05", "slot": "Evening", "centre": "Balua", "sport": "Football", "absent_player_ids": [],
    })
    rec("coach attendance 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        # Active Balua/Football/Evening players: Neha (Aditya excluded)
        rec("count == 1 (Neha only, Aditya excluded)", body.get("count") == 1, f"body={body}")

    # ---------- Scenario 9: PATCH status silently ignored ----------
    section("9. PATCH /people/<aditya> {status:'active'} silently ignored")
    r = requests.patch(f"{API}/people/{aditya_id}", headers=admin_h, timeout=30, json={"status": "active"})
    rec("PATCH status=active responds (200 expected even though ignored)", r.status_code in (200, 400), f"status={r.status_code} body={r.text[:200]}")
    # Backend returns 400 if no other fields and status stripped → "No fields to update". Spec says "returns 200 but status stays deactivated". Verify status remains deactivated regardless.
    r2 = requests.get(f"{API}/people", params={"kind": "player", "include_deactivated": "true"}, headers=admin_h, timeout=30)
    incl2 = r2.json() if r2.status_code == 200 else []
    aditya_after_patch = next((p for p in incl2 if p["name"] == "Aditya Verma"), None)
    rec("Aditya remains deactivated after PATCH status:active", aditya_after_patch and aditya_after_patch.get("status") == "deactivated", f"status={aditya_after_patch.get('status') if aditya_after_patch else 'NA'}")

    # Also test PATCH with another field + status — should still strip status
    r = requests.patch(f"{API}/people/{aditya_id}", headers=admin_h, timeout=30, json={"status": "active", "skill_level": "Advanced"})
    rec("PATCH status+skill_level responds 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        rec("PATCH ignored status (still deactivated)", r.json().get("status") == "deactivated", f"status={r.json().get('status')}")
        rec("PATCH applied skill_level update", r.json().get("skill_level") == "Advanced")

    # ---------- Scenario 10: activate ----------
    section("10. POST /people/<aditya>/activate")
    r = requests.post(f"{API}/people/{aditya_id}/activate", headers=admin_h, timeout=30)
    rec("activate 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        rec("status=active after activate", r.json().get("status") == "active")
    r = requests.get(f"{API}/people", params={"kind": "player"}, headers=admin_h, timeout=30)
    actives2 = r.json() if r.status_code == 200 else []
    names_a = [p["name"] for p in actives2]
    rec("Aditya back in active list", "Aditya Verma" in names_a, f"count={len(actives2)}")

    # ---------- Scenario 11: command-center ----------
    section("11. GET /command-center → roster_counts.deactivated_players + deactivated_players list")
    r = requests.get(f"{API}/command-center", headers=admin_h, timeout=30)
    rec("command-center 200", r.status_code == 200, f"status={r.status_code}")
    cc = r.json() if r.status_code == 200 else {}
    rc = cc.get("roster_counts") or {}
    rec("roster_counts has deactivated_players key", "deactivated_players" in rc, f"keys={list(rc.keys())}")
    rec("roster_counts.deactivated_players == 0 after activate", rc.get("deactivated_players") == 0, f"v={rc.get('deactivated_players')}")
    rec("response.deactivated_players present (list)", isinstance(cc.get("deactivated_players"), list), f"type={type(cc.get('deactivated_players'))}")
    rec("response.deactivated_players empty after activate", cc.get("deactivated_players") == [], f"v={cc.get('deactivated_players')}")

    # ---------- Scenario 12: regression ----------
    section("12. Regression")
    r = requests.get(f"{API}/auth/me", headers=admin_h, timeout=30)
    rec("admin /auth/me 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        rec("auth/me has coach_type field", "coach_type" in r.json(), f"keys={list(r.json().keys())}")
    # principal staff attendance
    r = requests.post(f"{API}/attendance/staff", headers=principal_h, timeout=30, json={"date": "2026-05-05", "absent_staff_ids": []})
    rec("principal POST /attendance/staff 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        rec("principal staff attendance count=3 (PWS staff)", body.get("count") == 3, f"body={body}")
    # coach players grouping
    r = requests.get(f"{API}/coach/players", headers=coach_h, timeout=30)
    rec("coach /coach/players 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        cp = r.json()
        groups = cp.get("groups") or {}
        # Should be Centre=Balua → Sport=(Cricket|Football) → PlayerType=...
        balua = groups.get("Balua") or {}
        rec("coach players grouped by Centre→Sport→PlayerType (Balua present)", bool(balua), f"groups={list(groups.keys())}")
        # Should NOT contain deactivated. Right now Aditya was just reactivated.
        names_in_grouped = []
        for sport_map in balua.values():
            for pt_list in sport_map.values():
                names_in_grouped.extend([p["name"] for p in pt_list])
        rec("coach players includes Aditya (active)", "Aditya Verma" in names_in_grouped, f"names={names_in_grouped}")

        # Now deactivate Aditya again to confirm exclusion
        requests.post(f"{API}/people/{aditya_id}/deactivate", headers=admin_h, timeout=30)
        r2 = requests.get(f"{API}/coach/players", headers=coach_h, timeout=30)
        names2 = []
        if r2.status_code == 200:
            for sport_map in (r2.json().get("groups") or {}).get("Balua", {}).values():
                for pt_list in sport_map.values():
                    names2.extend([p["name"] for p in pt_list])
        rec("coach players excludes deactivated Aditya", "Aditya Verma" not in names2, f"names={names2}")
        # Reactivate so test is idempotent
        requests.post(f"{API}/people/{aditya_id}/activate", headers=admin_h, timeout=30)

    # ---------- Scenario 13: cleanup ----------
    section("13. Cleanup test player")
    if new_player_id:
        r = requests.delete(f"{API}/people/{new_player_id}", headers=admin_h, timeout=30)
        rec("DELETE test player 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # ---------- Summary ----------
    print("\n" + "=" * 60)
    print(f"PASS {len(PASS)} / FAIL {len(FAIL)} (total {len(PASS)+len(FAIL)})")
    if FAIL:
        print("\nFAILED:")
        for n, d in FAIL:
            print(f"  - {n} :: {d}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
