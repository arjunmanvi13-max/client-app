"""
Backend test suite for Coach Attendance scope filter + user lifecycle endpoints.
"""
import os
import sys
import json
import requests

BASE = os.environ.get("BACKEND_URL", "https://unified-track.preview.emergentagent.com").rstrip("/") + "/api"

CREDS = {
    "super":   ("super@pws-alpha.com",      "Super@123"),
    "admin":   ("admin@pws-alpha.com",      "Admin@123"),
    "coach":   ("coach@pws-alpha.com",      "Coach@123"),
    "asst":    ("asst_coach@pws-alpha.com", "Asst@123"),
    "principal": ("principal@pws-alpha.com","Principal@123"),
    "vp":      ("vp@pws-alpha.com",         "Vp@123"),
    "teacher": ("teacher@pws-alpha.com",    "Teacher@123"),
}

results = []
def rec(name, ok, detail=""):
    results.append((ok, name, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {name}" + (f"  -- {detail}" if detail else ""))

def login(key, expect=200):
    email, pw = CREDS[key]
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}, timeout=20)
    if r.status_code != expect:
        return None, r
    if expect != 200:
        return None, r
    return r.json().get("access_token"), r

def H(tok):
    return {"Authorization": f"Bearer {tok}"}

def me(tok):
    return requests.get(f"{BASE}/auth/me", headers=H(tok), timeout=20).json()

def main():
    tokens = {}
    for k in CREDS:
        tk, r = login(k)
        if not tk:
            rec(f"login {k}", False, f"status={r.status_code} body={r.text[:200]}")
            return
        tokens[k] = tk
    rec("All demo logins succeed", True)

    coach_me = me(tokens["coach"])
    asst_me  = me(tokens["asst"])
    coach_id = coach_me["id"]
    asst_id  = asst_me["id"]
    rec("coach@ coach_type=head", coach_me.get("coach_type") == "head", str(coach_me.get("coach_type")))
    rec("asst_coach@ coach_type=assistant", asst_me.get("coach_type") == "assistant", str(asst_me.get("coach_type")))

    original_asst_centres = list(asst_me.get("assigned_centres") or [])
    print(f"   (original asst_coach assigned_centres = {original_asst_centres})")

    # ===== S1 Super Admin =====
    r = requests.get(f"{BASE}/attendance/coaches-list", headers=H(tokens["super"]), timeout=20)
    rec("S1 super GET /attendance/coaches-list 200", r.status_code == 200, f"status={r.status_code}")
    s_list = r.json() if r.status_code == 200 else []
    ids_s1 = {c["id"] for c in s_list}
    rec("S1 super list count=2 includes head + asst",
        len(s_list) == 2 and coach_id in ids_s1 and asst_id in ids_s1,
        f"count={len(s_list)} ids={ids_s1}")

    r = requests.post(f"{BASE}/attendance/coaches", headers=H(tokens["super"]),
                      json={"date": "2026-05-10", "absent_coach_ids": []}, timeout=20)
    rec("S1 super POST /attendance/coaches 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        b = r.json()
        rec("S1 super POST count=2 present=2", b.get("count") == 2 and b.get("present") == 2, json.dumps(b))

    # ===== S2 Sports Admin =====
    r = requests.get(f"{BASE}/attendance/coaches-list", headers=H(tokens["admin"]), timeout=20)
    rec("S2 admin GET /attendance/coaches-list 200", r.status_code == 200, f"status={r.status_code}")
    a_list = r.json() if r.status_code == 200 else []
    ids_s2 = {c["id"] for c in a_list}
    rec("S2 admin list count=2", len(a_list) == 2 and coach_id in ids_s2 and asst_id in ids_s2,
        f"count={len(a_list)} ids={ids_s2}")
    r = requests.post(f"{BASE}/attendance/coaches", headers=H(tokens["admin"]),
                      json={"date": "2026-05-10", "absent_coach_ids": []}, timeout=20)
    rec("S2 admin POST /attendance/coaches 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        rec("S2 admin POST count=2", r.json().get("count") == 2, json.dumps(r.json()))

    # ===== S3 Head Coach (initial) =====
    r = requests.get(f"{BASE}/attendance/coaches-list", headers=H(tokens["coach"]), timeout=20)
    rec("S3 coach GET /attendance/coaches-list 200", r.status_code == 200, f"status={r.status_code}")
    c_list = r.json() if r.status_code == 200 else []
    ids_initial = {c["id"] for c in c_list}
    asst_overlap = bool(set(original_asst_centres) & set(coach_me.get("assigned_centres") or []))
    expected_count = 2 if asst_overlap else 1
    rec(f"S3 coach initial scope count={expected_count} (asst overlap={asst_overlap})",
        len(c_list) == expected_count and coach_id in ids_initial,
        f"count={len(c_list)} expected={expected_count} ids={ids_initial} asst_centres={original_asst_centres}")

    r = requests.post(f"{BASE}/attendance/coaches", headers=H(tokens["coach"]),
                      json={"date": "2026-05-10", "absent_coach_ids": []}, timeout=20)
    rec("S3 coach POST /attendance/coaches 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        rec(f"S3 coach POST count={expected_count}", r.json().get("count") == expected_count, json.dumps(r.json()))

    # PATCH asst centres -> [Balua]
    r = requests.patch(f"{BASE}/users/{asst_id}", headers=H(tokens["super"]),
                       json={"assigned_centres": ["Balua"]}, timeout=20)
    rec("S3 super PATCH asst assigned_centres=[Balua] 200",
        r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{BASE}/attendance/coaches-list", headers=H(tokens["coach"]), timeout=20)
    rec("S3 coach GET (after PATCH) 200", r.status_code == 200, f"status={r.status_code}")
    c_list2 = r.json() if r.status_code == 200 else []
    ids2 = {c["id"] for c in c_list2}
    rec("S3 coach scope post-PATCH count=2 (self+asst)",
        len(c_list2) == 2 and coach_id in ids2 and asst_id in ids2,
        f"count={len(c_list2)} ids={ids2}")

    r = requests.post(f"{BASE}/attendance/coaches", headers=H(tokens["coach"]),
                      json={"date": "2026-05-10", "absent_coach_ids": []}, timeout=20)
    rec("S3 coach POST after PATCH 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        rec("S3 coach POST count=2 after PATCH", r.json().get("count") == 2, json.dumps(r.json()))

    # ===== S4 Assistant coach =====
    r = requests.get(f"{BASE}/attendance/coaches-list", headers=H(tokens["asst"]), timeout=20)
    rec("S4 asst GET /attendance/coaches-list 200", r.status_code == 200, f"status={r.status_code}")
    r = requests.post(f"{BASE}/attendance/coaches", headers=H(tokens["asst"]),
                      json={"date": "2026-05-10", "absent_coach_ids": []}, timeout=20)
    rec("S4 asst POST /attendance/coaches 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # ===== S5 Teacher / Principal / VP =====
    for role in ("teacher", "principal", "vp"):
        r = requests.get(f"{BASE}/attendance/coaches-list", headers=H(tokens[role]), timeout=20)
        rec(f"S5 {role} GET /attendance/coaches-list 403", r.status_code == 403, f"status={r.status_code}")
        r = requests.post(f"{BASE}/attendance/coaches", headers=H(tokens[role]),
                          json={"date": "2026-05-10", "absent_coach_ids": []}, timeout=20)
        rec(f"S5 {role} POST /attendance/coaches 403", r.status_code == 403, f"status={r.status_code}")

    # ===== S6 Lifecycle (super) =====
    r = requests.post(f"{BASE}/users/{coach_id}/deactivate", headers=H(tokens["super"]), timeout=20)
    rec("S6 super deactivate coach 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        rec("S6 coach status=deactivated", r.json().get("status") == "deactivated", json.dumps(r.json())[:200])

    _, lr = login("coach", expect=403)
    body_text = lr.text if lr is not None else ""
    rec("S6 coach login blocked 403 (Account deactivated)",
        lr.status_code == 403 and "deactivated" in body_text.lower(),
        f"status={lr.status_code} body={body_text[:200]}")

    r = requests.post(f"{BASE}/users/{coach_id}/activate", headers=H(tokens["super"]), timeout=20)
    rec("S6 super activate coach 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        rec("S6 coach status=active", r.json().get("status") == "active", "")
    tk, lr = login("coach")
    rec("S6 coach login re-enabled 200", tk is not None, f"status={lr.status_code}")
    if tk:
        tokens["coach"] = tk

    # ===== S7 Lifecycle (admin) =====
    r = requests.post(f"{BASE}/users/{asst_id}/deactivate", headers=H(tokens["admin"]), timeout=20)
    rec("S7 admin deactivate asst 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        rec("S7 asst status=deactivated", r.json().get("status") == "deactivated", "")
    _, lr = login("asst", expect=403)
    rec("S7 asst login blocked 403", lr.status_code == 403, f"status={lr.status_code}")
    r = requests.post(f"{BASE}/users/{asst_id}/activate", headers=H(tokens["admin"]), timeout=20)
    rec("S7 admin activate asst 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        rec("S7 asst status=active", r.json().get("status") == "active", "")
    tk, lr = login("asst")
    rec("S7 asst login re-enabled 200", tk is not None, f"status={lr.status_code}")
    if tk:
        tokens["asst"] = tk

    # ===== S8 Regression =====
    r = requests.get(f"{BASE}/attendance/staff-list", headers=H(tokens["principal"]), timeout=20)
    rec("S8 principal /attendance/staff-list 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        sl = r.json()
        rec("S8 principal staff list count=3 PWS", len(sl) == 3, f"count={len(sl)}")

    r = requests.get(f"{BASE}/coach/dashboard", headers=H(tokens["coach"]), timeout=20)
    rec("S8 coach /coach/dashboard 200", r.status_code == 200, f"status={r.status_code}")

    r = requests.get(f"{BASE}/command-center", headers=H(tokens["admin"]), timeout=20)
    rec("S8 admin /command-center 200", r.status_code == 200, f"status={r.status_code}")
    r = requests.get(f"{BASE}/command-center", headers=H(tokens["super"]), timeout=20)
    rec("S8 super /command-center 200", r.status_code == 200, f"status={r.status_code}")

    # ===== Cleanup =====
    body = {"assigned_centres": original_asst_centres}
    r = requests.patch(f"{BASE}/users/{asst_id}", headers=H(tokens["super"]), json=body, timeout=20)
    if r.status_code != 200 and not original_asst_centres:
        body["coach_type"] = asst_me.get("coach_type") or "assistant"
        r = requests.patch(f"{BASE}/users/{asst_id}", headers=H(tokens["super"]), json=body, timeout=20)
    rec(f"Cleanup: asst centres restored to {original_asst_centres}",
        r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    asst_after = me(tokens["asst"])
    rec("Cleanup verified: asst assigned_centres restored",
        list(asst_after.get("assigned_centres") or []) == original_asst_centres,
        f"now={asst_after.get('assigned_centres')} expected={original_asst_centres}")

    passed = sum(1 for ok, *_ in results if ok)
    failed = [r for r in results if not r[0]]
    print(f"\n=== {passed}/{len(results)} assertions passed ===")
    for ok, name, detail in failed:
        print(f"  FAIL: {name} -- {detail}")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
