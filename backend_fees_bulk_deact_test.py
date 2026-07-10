"""
Backend test suite for NEW BATCH:
- Fees module (rate cards, list, dashboard, collect, edit, auto-create)
- Bulk Upload (template, upload players with validation)
- Controlled Deactivation (requests, approve/reject)

Runs 18 scenarios described by main agent. Prints PASS/FAIL summary.
"""
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://unified-track.preview.emergentagent.com"
API = f"{BASE}/api"

CREDS = {
    "super": ("super@pws-alpha.com", "Super@123"),
    "admin": ("admin@pws-alpha.com", "Admin@123"),
    "principal": ("principal@pws-alpha.com", "Principal@123"),
    "teacher": ("teacher@pws-alpha.com", "Teacher@123"),
    "coach": ("coach@pws-alpha.com", "Coach@123"),
    "asst_coach": ("asst_coach@pws-alpha.com", "Asst@123"),
    "warden": ("warden@pws-alpha.com", "Warden@123"),
}

results = []
tokens: Dict[str, str] = {}
me: Dict[str, dict] = {}


def log(name: str, ok: bool, detail: str = ""):
    results.append((ok, name, detail))
    print(("✅" if ok else "❌") + f" {name}" + (f" — {detail}" if detail else ""))


def login(key: str) -> str:
    if key in tokens:
        return tokens[key]
    email, pw = CREDS[key]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"Login {key} failed: {r.status_code} {r.text}"
    data = r.json()
    tokens[key] = data["access_token"]
    me[key] = data["user"]
    return tokens[key]


def H(key: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {login(key)}"}


def get(path: str, key: str, **kwargs) -> requests.Response:
    return requests.get(f"{API}{path}", headers=H(key), timeout=15, **kwargs)


def post(path: str, key: str, json_body: Optional[dict] = None, **kwargs) -> requests.Response:
    return requests.post(f"{API}{path}", headers=H(key), json=json_body, timeout=20, **kwargs)


def patch(path: str, key: str, json_body: Optional[dict] = None) -> requests.Response:
    return requests.patch(f"{API}{path}", headers=H(key), json=json_body, timeout=15)


# ---------------- Pre-flight ----------------
print(f"Backend: {API}")
for k in CREDS:
    try:
        login(k)
        print(f"  login {k} OK  (role={me[k].get('role')})")
    except Exception as e:
        print(f"  login {k} FAILED: {e}")
        sys.exit(1)

# Get players for later use
r = get("/people?kind=player", "super")
assert r.status_code == 200, r.text
players = r.json()
player_by_name = {p["name"]: p for p in players}
print(f"Pre-flight players count={len(players)} names={[p['name'] for p in players]}")


# ---------------- S1: super GET /fees -> expected content ----------------
def s1():
    r = get("/fees", "super")
    if r.status_code != 200:
        return log("S1 super GET /fees 200", False, f"{r.status_code} {r.text}")
    fees = r.json()
    log("S1 super GET /fees 200", True, f"count={len(fees)}")
    # at least 12
    log("S1 fees count >= 12", len(fees) >= 12, f"got {len(fees)}")

    def find_fee(name, ftype):
        return next((f for f in fees if f.get("player_name") == name and f.get("fee_type") == ftype), None)

    # Karan Raj (Balua Hostel Cricket) — Reg 20000, Monthly 12000
    kr_reg = find_fee("Karan Raj", "Registration")
    kr_m = find_fee("Karan Raj", "Monthly")
    log("S1 Karan Raj Registration = 20000", bool(kr_reg) and kr_reg["amount"] == 20000, str(kr_reg and kr_reg.get("amount")))
    log("S1 Karan Raj Monthly amount = 12000", bool(kr_m) and kr_m["amount"] == 12000, str(kr_m and kr_m.get("amount")))

    # Riya Singh (Balua Daily Cricket) — Reg 3000, Monthly 2500
    rs_reg = find_fee("Riya Singh", "Registration")
    rs_m = find_fee("Riya Singh", "Monthly")
    log("S1 Riya Singh Registration = 3000", bool(rs_reg) and rs_reg["amount"] == 3000)
    log("S1 Riya Singh Monthly = 2500", bool(rs_m) and rs_m["amount"] == 2500)

    # Neha Sharma (Balua Day Boarding Football) — Reg 20000, Monthly 7500
    ns_reg = find_fee("Neha Sharma", "Registration")
    ns_m = find_fee("Neha Sharma", "Monthly")
    log("S1 Neha Sharma Registration = 20000", bool(ns_reg) and ns_reg["amount"] == 20000)
    log("S1 Neha Sharma Monthly = 7500", bool(ns_m) and ns_m["amount"] == 7500)

    return fees


fees_all = s1()


# ---------------- S2: super GET /fees/dashboard ----------------
def s2():
    r = get("/fees/dashboard", "super")
    if r.status_code != 200:
        return log("S2 dashboard 200", False, f"{r.status_code} {r.text}")
    d = r.json()
    bc = d.get("by_centre") or {}
    log("S2 by_centre has Balua", "Balua" in bc)
    log("S2 by_centre has Harding Park", "Harding Park" in bc)
    for c in ("Balua", "Harding Park"):
        if c in bc:
            item = bc[c]
            for k in ("due_current_month", "due_past", "players_with_dues"):
                log(f"S2 {c}.{k} present", k in item)


s2()


# ---------------- S3: coach@ blocked ----------------
def s3():
    r = get("/fees", "coach"); log("S3 coach GET /fees -> 403", r.status_code == 403, f"{r.status_code}")
    r = get("/fees/dashboard", "coach"); log("S3 coach /fees/dashboard -> 403", r.status_code == 403, f"{r.status_code}")
    # Need a fee id; pick any
    any_fee = fees_all[0]
    r = post(f"/fees/{any_fee['id']}/collect", "coach", {"payment_mode": "Cash"})
    log("S3 coach collect -> 403", r.status_code == 403, f"{r.status_code}")


s3()


# ---------------- Pick target fees for collection ----------------
def find_due(player_name, ftype):
    return next((f for f in fees_all if f.get("player_name") == player_name and f.get("fee_type") == ftype and f.get("status") == "due"), None)


# Pick Riya Singh's Registration (due ₹3000) for admin Cash collect
target_cash = find_due("Riya Singh", "Registration")
# Pick another due for Online collect — Simran Gupta Monthly
target_online = find_due("Simran Gupta", "Monthly") or find_due("Rahul Kumar", "Monthly")

# ---------------- S4: admin GET /fees 200, collect Cash, re-collect 400 ----------------
def s4():
    r = get("/fees", "admin")
    log("S4 admin GET /fees 200", r.status_code == 200, f"{r.status_code}")
    if not target_cash:
        return log("S4 find due fee for cash", False, "no due fee")
    r = post(f"/fees/{target_cash['id']}/collect", "admin", {"payment_mode": "Cash"})
    ok = r.status_code == 200 and r.json().get("status") == "paid"
    log("S4 admin Cash collect -> 200 + paid", ok, f"{r.status_code} {r.text[:120]}")
    # Re-collect
    r2 = post(f"/fees/{target_cash['id']}/collect", "admin", {"payment_mode": "Cash"})
    log("S4 re-collect -> 400", r2.status_code == 400, f"{r2.status_code} {r2.text[:120]}")


s4()


# ---------------- S5: admin Online without ref -> 400, with ref -> 200 ----------------
def s5():
    if not target_online:
        return log("S5 find due for online", False, "no due fee")
    r = post(f"/fees/{target_online['id']}/collect", "admin", {"payment_mode": "Online"})
    log("S5 Online w/o reference -> 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")
    r = post(f"/fees/{target_online['id']}/collect", "admin", {"payment_mode": "Online", "reference_id": "TXN-TEST-001"})
    ok = r.status_code == 200 and r.json().get("status") == "paid"
    log("S5 Online with reference -> 200 paid", ok, f"{r.status_code} {r.text[:120]}")


s5()


# ---------------- Pick another due fee for PATCH tests ----------------
# Reload fees
fees_all = get("/fees", "super").json()
patch_target = next((f for f in fees_all if f.get("status") == "due"), None)


# ---------------- S6: admin PATCH /fees -> 403 ----------------
def s6():
    if not patch_target:
        return log("S6 pick a due fee to patch", False, "none")
    r = patch(f"/fees/{patch_target['id']}", "admin", {"discount": 500})
    log("S6 admin PATCH /fees -> 403", r.status_code == 403, f"{r.status_code} {r.text[:150]}")


s6()


# ---------------- S7: super PATCH discount then amount_due ----------------
def s7():
    if not patch_target:
        return log("S7 pick due fee", False, "none")
    before = patch_target.get("amount_due")
    r = patch(f"/fees/{patch_target['id']}", "super", {"discount": 500})
    if r.status_code != 200:
        return log("S7 super PATCH discount 200", False, f"{r.status_code} {r.text[:150]}")
    new_amt = r.json().get("amount_due")
    ok = new_amt == max(0, before - 500)
    log("S7 super PATCH discount 200 amount decreased by 500", ok, f"before={before} after={new_amt}")
    r = patch(f"/fees/{patch_target['id']}", "super", {"amount_due": 1000})
    ok = r.status_code == 200 and r.json().get("amount_due") == 1000
    log("S7 super PATCH amount_due=1000 -> 200", ok, f"{r.status_code} {r.text[:150]}")


s7()


# ---------------- S8: super POST new ALPHA player, fees auto-created (2) ----------------
NEW_PLAYER_IDS = []

def s8():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    body = {
        "name": "Arjun Test S8",
        "kind": "player",
        "organization": "ALPHA",
        "centre": "Balua",
        "sport": "Football",
        "player_type": "Daily",
        "slot": "Morning",
        "skill_level": "Beginner",
        "date_of_admission": today,
        "group": "Morning Football",
    }
    r = post("/people", "super", body)
    if r.status_code != 200:
        return log("S8 create ALPHA player", False, f"{r.status_code} {r.text[:200]}")
    new = r.json()
    NEW_PLAYER_IDS.append(new["id"])
    log("S8 create ALPHA player 200", True, new["name"])
    r = get(f"/fees?player_id={new['id']}", "super")
    fees = r.json() if r.status_code == 200 else []
    log("S8 GET /fees?player_id -> 2 fees", len(fees) == 2, f"got {len(fees)}")
    types = sorted({f.get("fee_type") for f in fees})
    log("S8 fees types = [Monthly, Registration]", types == ["Monthly", "Registration"], str(types))


s8()


# ---------------- S9: first Monthly half-fee when admission day >= 16 ----------------
def s9():
    # pick a date on the 18th of current month (or last month if today<18) to keep it valid
    now = datetime.now(timezone.utc)
    if now.day >= 18:
        doa = now.replace(day=18).strftime("%Y-%m-%d")
    else:
        # last month 18th
        first_this = now.replace(day=1)
        last_month_end = first_this - timedelta(days=1)
        doa = last_month_end.replace(day=18).strftime("%Y-%m-%d")
    body = {
        "name": "Kabir Test S9",
        "kind": "player",
        "organization": "ALPHA",
        "centre": "Balua",
        "sport": "Cricket",
        "player_type": "Hostel",  # monthly 12000 -> first month should be 6000
        "slot": "Morning",
        "skill_level": "Intermediate",
        "date_of_admission": doa,
        "group": "Morning Cricket",
    }
    r = post("/people", "super", body)
    if r.status_code != 200:
        return log("S9 create ALPHA player (day 18)", False, f"{r.status_code} {r.text[:200]}")
    new = r.json()
    NEW_PLAYER_IDS.append(new["id"])
    fees = get(f"/fees?player_id={new['id']}", "super").json()
    monthly = next((f for f in fees if f.get("fee_type") == "Monthly"), None)
    if not monthly:
        return log("S9 first monthly present", False, str(fees))
    # Hostel Cricket monthly = 12000; half = 6000
    ok = monthly.get("amount_due") == 6000 and monthly.get("amount") == 12000 and monthly.get("first_month_discounted") is True
    log("S9 first Monthly half fee (amount_due=6000, amount=12000)", ok, json.dumps(monthly, default=str)[:200])


s9()


# ---------------- S10: /bulk-upload/template teacher 403; super 200 CSV headers ----------------
def s10():
    r = get("/bulk-upload/template", "teacher")
    log("S10 teacher /bulk-upload/template -> 403", r.status_code == 403, f"{r.status_code}")
    r = get("/bulk-upload/template", "super")
    log("S10 super /bulk-upload/template -> 200", r.status_code == 200, f"{r.status_code}")
    text = r.text if r.status_code == 200 else ""
    required = ["Name", "Father's Name", "Age", "Mobile Number", "Locality", "City", "Centre", "Sport", "Category", "Slot", "Skill Level", "Date of Admission"]
    header_line = text.splitlines()[0] if text else ""
    ok_headers = all(h in header_line for h in required)
    log("S10 template CSV has required headers", ok_headers, header_line[:200])


s10()


# ---------------- S11: POST bulk-upload 1 valid + 1 invalid -> validation_failed, no inserts ----------------
def s11():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    headers = "Name,Father's Name,Age,Mobile Number,Locality,City,Centre,Sport,Category,Slot,Skill Level,Date of Admission"
    good = f"Rohit Bulk Good,Sita Bulk,14,9999900001,Patna,Patna,Balua,Cricket,Daily,Morning,Beginner,{today}"
    # bad: invalid sport
    bad = f"Suman Bulk Bad,Mohan Bulk,15,9999900002,Patna,Patna,Balua,Basketball,Daily,Morning,Beginner,{today}"
    csv_content = "\n".join([headers, good, bad]) + "\n"

    files = {"file": ("players.csv", csv_content.encode("utf-8"), "text/csv")}
    r = requests.post(f"{API}/bulk-upload/players", headers=H("super"), files=files, timeout=30)
    if r.status_code != 200:
        return log("S11 bulk upload mixed 200", False, f"{r.status_code} {r.text[:200]}")
    body = r.json()
    log("S11 status=validation_failed", body.get("status") == "validation_failed", json.dumps(body)[:300])
    log("S11 errors includes the bad row", any(e.get("name") == "Suman Bulk Bad" for e in body.get("errors", [])), str(body.get("errors")))
    # Verify no inserts
    found_good = get(f"/people?kind=player", "super").json()
    any_good_inserted = any(p.get("name") == "Rohit Bulk Good" for p in found_good)
    log("S11 NO inserts when validation_failed", not any_good_inserted, f"found={any_good_inserted}")


s11()


# ---------------- S12: 2 valid rows -> ok, players_created=2, fees_created=4 ----------------
def s12():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    headers = "Name,Father's Name,Age,Mobile Number,Locality,City,Centre,Sport,Category,Slot,Skill Level,Date of Admission"
    r1 = f"Bulk Player One,Dad One,13,9000011111,Patna,Patna,Balua,Cricket,Daily,Morning,Beginner,{today}"
    r2 = f"Bulk Player Two,Dad Two,14,9000022222,Patna,Patna,Balua,Football,Day Boarding,Evening,Intermediate,{today}"
    csv_content = "\n".join([headers, r1, r2]) + "\n"
    files = {"file": ("players.csv", csv_content.encode("utf-8"), "text/csv")}
    r = requests.post(f"{API}/bulk-upload/players", headers=H("super"), files=files, timeout=30)
    if r.status_code != 200:
        return log("S12 bulk upload 2 valid 200", False, f"{r.status_code} {r.text[:200]}")
    body = r.json()
    ok = body.get("status") == "ok" and body.get("players_created") == 2 and body.get("fees_created") == 4
    log("S12 status ok, players=2, fees=4", ok, json.dumps(body)[:300])
    # track for cleanup
    ppl = get("/people?kind=player", "super").json()
    for p in ppl:
        if p["name"] in ("Bulk Player One", "Bulk Player Two"):
            NEW_PLAYER_IDS.append(p["id"])


s12()


# ---------------- S13: teacher POST /deactivation-requests -> 403 ----------------
# Pick an active player (not one we created) — pick Aditya Verma
active_players = [p for p in get("/people?kind=player", "super").json() if p.get("status") == "active"]
target_player = next((p for p in active_players if p["name"] == "Aditya Verma"), active_players[0])


def s13():
    r = post("/deactivation-requests", "teacher", {"player_id": target_player["id"], "reason": "no-op"})
    log("S13 teacher POST deactivation-requests -> 403", r.status_code == 403, f"{r.status_code} {r.text[:120]}")


s13()


# ---------------- S14: admin POST deactivation request ----------------
REQ_ID_1 = None

def s14():
    global REQ_ID_1
    r = post("/deactivation-requests", "admin", {"player_id": target_player["id"], "reason": "Admin S14 request"})
    if r.status_code != 200:
        return log("S14 admin create deactivation req 200", False, f"{r.status_code} {r.text[:200]}")
    data = r.json()
    REQ_ID_1 = data.get("id")
    ok = data.get("status") == "pending"
    log("S14 admin create deactivation req -> status=pending", ok, json.dumps(data)[:300])


s14()


# ---------------- S15: admin approve -> 403 ----------------
def s15():
    if not REQ_ID_1:
        return log("S15 need REQ_ID_1", False, "no request")
    r = post(f"/deactivation-requests/{REQ_ID_1}/approve", "admin", {})
    log("S15 admin approve -> 403", r.status_code == 403, f"{r.status_code} {r.text[:200]}")


s15()


# ---------------- S16: super approves -> 200, player.status=deactivated ----------------
def s16():
    if not REQ_ID_1:
        return log("S16 need REQ_ID_1", False, "no request")
    r = post(f"/deactivation-requests/{REQ_ID_1}/approve", "super", {})
    if r.status_code != 200:
        return log("S16 super approve 200", False, f"{r.status_code} {r.text[:200]}")
    data = r.json()
    log("S16 super approve -> 200 status=approved", data.get("status") == "approved", json.dumps(data)[:200])
    # Verify player deactivated
    r2 = get(f"/people?kind=player&include_deactivated=true", "super")
    players2 = r2.json()
    p = next((x for x in players2 if x["id"] == target_player["id"]), None)
    log("S16 player.status == 'deactivated'", bool(p) and p.get("status") == "deactivated", str(p and p.get("status")))


s16()


# ---------------- S17: admin requests again → super rejects → player stays active ----------------
REQ_ID_2 = None

def s17():
    global REQ_ID_2
    # First reactivate the player
    r = post(f"/people/{target_player['id']}/activate", "super")
    if r.status_code != 200:
        return log("S17 reactivate player (prep)", False, f"{r.status_code}")
    # Now create new request
    r = post("/deactivation-requests", "admin", {"player_id": target_player["id"], "reason": "Admin S17 request"})
    if r.status_code != 200:
        return log("S17 admin create req #2", False, f"{r.status_code} {r.text[:200]}")
    REQ_ID_2 = r.json()["id"]
    # super rejects
    rr = post(f"/deactivation-requests/{REQ_ID_2}/reject", "super", {"note": "Not this time"})
    log("S17 super reject -> 200", rr.status_code == 200 and rr.json().get("status") == "rejected", f"{rr.status_code} {rr.text[:200]}")
    # Verify player still active
    players2 = get("/people?kind=player&include_deactivated=true", "super").json()
    p = next((x for x in players2 if x["id"] == target_player["id"]), None)
    log("S17 player.status stays active after reject", bool(p) and p.get("status") == "active", str(p and p.get("status")))


s17()


# ---------------- S18: regression ----------------
def s18():
    # /people (admin) kind=player 200
    r = get("/people?kind=player", "admin"); log("S18 /people?kind=player (admin) 200", r.status_code == 200, f"{r.status_code}")
    # /coach/dashboard (coach) 200
    r = get("/coach/dashboard", "coach"); log("S18 /coach/dashboard (coach) 200", r.status_code == 200, f"{r.status_code}")
    # /coach/attendance POST (coach) 200 -- need a player. Use POST form
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    body = {"date": today, "centre": "Balua", "sport": "Football", "slot": "Evening", "marks": []}
    r = post("/coach/attendance", "coach", body)
    log("S18 /coach/attendance POST (coach) 200", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    # /attendance/staff-list (principal) 200
    r = get("/attendance/staff-list", "principal"); log("S18 /attendance/staff-list (principal) 200", r.status_code == 200, f"{r.status_code}")
    # /attendance/staff-list (coach head) 200
    r = get("/attendance/staff-list", "coach"); log("S18 /attendance/staff-list (coach) 200", r.status_code == 200, f"{r.status_code}")
    # /command-center (admin) 200
    r = get("/command-center", "admin"); log("S18 /command-center (admin) 200", r.status_code == 200, f"{r.status_code}")


s18()


# ---------------- Cleanup (best effort) ----------------
def cleanup():
    for pid in NEW_PLAYER_IDS:
        try:
            requests.delete(f"{API}/people/{pid}", headers=H("super"), timeout=10)
        except Exception:
            pass


cleanup()


# ---------------- Summary ----------------
total = len(results)
passed = sum(1 for r in results if r[0])
failed = total - passed
print("\n" + "=" * 70)
print(f"TOTAL {passed}/{total} passed, {failed} failed")
print("=" * 70)
if failed:
    for ok, name, detail in results:
        if not ok:
            print(f"FAIL: {name} — {detail}")
sys.exit(0 if failed == 0 else 1)
