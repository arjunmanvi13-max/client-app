"""
Backend test suite for Add-New-Player workflow enhancement (Prompt 8).

Scenarios A → I:
  A) Boarding player: dob auto-computes age, Reg 20000 + Monthly 15000 (or 50%)
  B) Hostel Only → Reg 3000 + Monthly 12000/15000 (Cricket/Football)
  C) Day Boarding → Reg 3000 + Monthly 7500
  D) Daily → Reg 3000 + Monthly 2500 (Cricket) / 2000 (Football)
  E) Hostel legacy → same as Hostel Only
  F) Super Admin override monthly=9999, reg=1111 → fees use overrides
  G) Sports Admin override → silently dropped, fees at rate-card
  H) Harding Park + Boarding → 400
  I) PATCH dob → age auto-updates
"""
import os
import sys
import json
from datetime import datetime, date
import requests

BASE = "https://unified-track.preview.emergentagent.com/api"

SUPER_MOBILE = "9631252241"
SUPER_OTP = "123456"
ADMIN_MOBILE = "9000000001"
ADMIN_PASSWORD = "Admin@123"

created_player_ids: list[str] = []
PASS = 0
FAIL = 0
FAILS: list[str] = []

def _p(msg):
    print(msg, flush=True)

def check(cond, label):
    global PASS, FAIL
    if cond:
        PASS += 1
        _p(f"  ✅ {label}")
    else:
        FAIL += 1
        FAILS.append(label)
        _p(f"  ❌ {label}")

def expected_age(dob_iso: str) -> int:
    d = datetime.fromisoformat(dob_iso)
    today = datetime.now()
    return today.year - d.year - ((today.month, today.day) < (d.month, d.day))

def login_super() -> str:
    r = requests.post(f"{BASE}/auth/otp/send", json={"mobile": SUPER_MOBILE, "purpose": "super_admin"})
    assert r.status_code == 200, f"OTP send failed: {r.status_code} {r.text}"
    r = requests.post(f"{BASE}/auth/otp/verify", json={"mobile": SUPER_MOBILE, "code": SUPER_OTP, "purpose": "super_admin"})
    assert r.status_code == 200, f"OTP verify failed: {r.status_code} {r.text}"
    return r.json()["access_token"]

def login_admin() -> str:
    r = requests.post(f"{BASE}/auth/login/mobile", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]

def hdr(tok): return {"Authorization": f"Bearer {tok}"}

def create_player(tok, payload, expect_status=200):
    r = requests.post(f"{BASE}/people", json=payload, headers=hdr(tok))
    return r

def get_fees(tok, player_id):
    r = requests.get(f"{BASE}/fees?player_id={player_id}", headers=hdr(tok))
    return r

def find_fee(fees, ftype):
    for f in fees:
        if f.get("fee_type") == ftype:
            return f
    return None

TODAY = datetime.now().strftime("%Y-%m-%d")
TODAY_DAY = datetime.now().day
FIRST_MONTH_HALF = TODAY_DAY >= 16

# Use today for DOA so first monthly uses first_month rule
def base_payload(**overrides):
    p = {
        "name": overrides.pop("name", "AutoTest Player"),
        "kind": "player",
        "organization": "ALPHA",
        "centre": "Balua",
        "sport": "Cricket",
        "player_type": "Daily",
        "slot": "Evening",
        "skill_level": "Beginner",
        "date_of_admission": TODAY,
    }
    p.update(overrides)
    return p


def cleanup(tok):
    _p("\n--- Cleanup ---")
    for pid in created_player_ids:
        # Delete fees first
        fees_r = requests.get(f"{BASE}/fees?player_id={pid}", headers=hdr(tok))
        if fees_r.status_code == 200:
            for f in fees_r.json():
                # Delete fee record directly via Mongo? No delete-fee endpoint typically.
                # We'll use direct mongo via test — but not accessible here. Rely on deleting the player;
                # fees remain but are orphaned. To keep DB clean, DELETE via /api? no endpoint exists for fees.
                pass
        r = requests.delete(f"{BASE}/people/{pid}", headers=hdr(tok))
        _p(f"  DELETE player {pid} → {r.status_code}")
    # Also purge orphan fees by directly cleaning via a direct db call would be nice, but no endpoint exists.
    # We'll delete fees via db access if available (using motor from backend/.env).


def try_delete_orphan_fees():
    """Delete fees records for created players via direct MongoDB (fallback)."""
    try:
        from pymongo import MongoClient
        from dotenv import load_dotenv as _ld
        _ld("/app/backend/.env")
        mc = MongoClient(os.environ["MONGO_URL"])
        dbc = mc[os.environ["DB_NAME"]]
        for pid in created_player_ids:
            res = dbc.fees.delete_many({"player_id": pid})
            _p(f"  Removed {res.deleted_count} fee(s) for player {pid}")
        mc.close()
    except Exception as e:
        _p(f"  (skip orphan fees cleanup: {e})")


# ============================================================
# Test Execution
# ============================================================
_p("=" * 70)
_p("Add-New-Player Workflow Enhancement — Backend Test (Prompt 8)")
_p(f"Backend: {BASE}")
_p(f"Today: {TODAY} (day={TODAY_DAY}, first_month_half={FIRST_MONTH_HALF})")
_p("=" * 70)

SUPER_TOK = login_super()
ADMIN_TOK = login_admin()
_p(f"Super Admin logged in via OTP. Sports Admin logged in via mobile+password.\n")


# ---------- A) Boarding ----------
_p("=== A) POST player type=Boarding, centre=Balua, sport=Cricket, dob=2014-08-15 ===")
dob = "2014-08-15"
exp_age = expected_age(dob)
_p(f"   Expected age for DOB {dob} today ({TODAY}) = {exp_age}")

r = create_player(SUPER_TOK, base_payload(
    name="AT Boarding Cricket", player_type="Boarding", sport="Cricket",
    dob=dob, slot="Both", skill_level="Beginner",
))
check(r.status_code == 200, f"A: create Boarding → 200 (got {r.status_code} {r.text[:150]})")
if r.status_code == 200:
    body = r.json()
    pid = body["id"]
    created_player_ids.append(pid)
    check(body.get("dob") == dob, f"A: response.dob == {dob} (got {body.get('dob')})")
    check(body.get("age") == exp_age, f"A: response.age auto-computed == {exp_age} (got {body.get('age')})")
    check(body.get("slot") == "Both", f"A: slot == 'Both' (got {body.get('slot')})")
    check(body.get("player_type") == "Boarding", "A: player_type == 'Boarding'")

    fees_r = get_fees(SUPER_TOK, pid)
    check(fees_r.status_code == 200, f"A: GET /fees?player_id → 200")
    fees = fees_r.json()
    reg = find_fee(fees, "Registration")
    mon = find_fee(fees, "Monthly")
    check(reg is not None, "A: Registration fee auto-created")
    check(mon is not None, "A: Monthly fee auto-created")
    if reg:
        check(reg.get("amount_due") == 20000, f"A: Reg amount_due == 20000 (got {reg.get('amount_due')})")
    if mon:
        exp_monthly = 15000 if not FIRST_MONTH_HALF else 7500
        # Actually first_month_amount: full if day <= 15 else half; expected 15000 if day <= 15 else 7500
        exp_first = 15000 if TODAY_DAY <= 15 else int(15000/2)
        check(mon.get("amount") == 15000, f"A: Monthly.amount == 15000 (got {mon.get('amount')})")
        check(mon.get("amount_due") == exp_first, f"A: Monthly.amount_due == {exp_first} (got {mon.get('amount_due')})")

# ---------- B) Hostel Only ----------
_p("\n=== B) POST player type=Hostel Only, sport=Cricket ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT HostelOnly Cricket", player_type="Hostel Only", sport="Cricket",
    dob="2013-05-10",
))
check(r.status_code == 200, f"B: create Hostel Only → 200 (got {r.status_code} {r.text[:150]})")
if r.status_code == 200:
    pid = r.json()["id"]; created_player_ids.append(pid)
    check(r.json().get("player_type") == "Hostel Only", "B: player_type == 'Hostel Only'")
    fees = get_fees(SUPER_TOK, pid).json()
    reg = find_fee(fees, "Registration"); mon = find_fee(fees, "Monthly")
    check(reg and reg.get("amount_due") == 3000, f"B: Reg amount_due == 3000 (got {reg and reg.get('amount_due')})")
    exp_first = 12000 if TODAY_DAY <= 15 else 6000
    check(mon and mon.get("amount") == 12000, f"B: Monthly.amount == 12000 (got {mon and mon.get('amount')})")
    check(mon and mon.get("amount_due") == exp_first, f"B: Monthly.amount_due == {exp_first} (got {mon and mon.get('amount_due')})")

_p("\n=== B2) Hostel Only + Football (monthly=15000) ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT HostelOnly Football", player_type="Hostel Only", sport="Football",
    dob="2013-05-10",
))
check(r.status_code == 200, f"B2: create Hostel Only Football → 200")
if r.status_code == 200:
    pid = r.json()["id"]; created_player_ids.append(pid)
    fees = get_fees(SUPER_TOK, pid).json()
    mon = find_fee(fees, "Monthly")
    exp_first = 15000 if TODAY_DAY <= 15 else 7500
    check(mon and mon.get("amount") == 15000, f"B2: Monthly.amount == 15000 (got {mon and mon.get('amount')})")
    check(mon and mon.get("amount_due") == exp_first, f"B2: Monthly.amount_due == {exp_first} (got {mon and mon.get('amount_due')})")

# ---------- C) Day Boarding ----------
_p("\n=== C) POST player type=Day Boarding, sport=Cricket ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT DayBoarding Cricket", player_type="Day Boarding", sport="Cricket",
    dob="2015-03-20",
))
check(r.status_code == 200, f"C: create Day Boarding → 200 (got {r.status_code} {r.text[:150]})")
if r.status_code == 200:
    pid = r.json()["id"]; created_player_ids.append(pid)
    fees = get_fees(SUPER_TOK, pid).json()
    reg = find_fee(fees, "Registration"); mon = find_fee(fees, "Monthly")
    check(reg and reg.get("amount_due") == 3000, f"C: Reg amount_due == 3000 (got {reg and reg.get('amount_due')})")
    exp_first = 7500 if TODAY_DAY <= 15 else 3750
    check(mon and mon.get("amount") == 7500, f"C: Monthly.amount == 7500 (got {mon and mon.get('amount')})")
    check(mon and mon.get("amount_due") == exp_first, f"C: Monthly.amount_due == {exp_first} (got {mon and mon.get('amount_due')})")

# ---------- D) Daily ----------
_p("\n=== D) POST player type=Daily, sport=Cricket ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT Daily Cricket", player_type="Daily", sport="Cricket",
    dob="2015-01-05",
))
check(r.status_code == 200, f"D: create Daily Cricket → 200")
if r.status_code == 200:
    pid = r.json()["id"]; created_player_ids.append(pid)
    fees = get_fees(SUPER_TOK, pid).json()
    reg = find_fee(fees, "Registration"); mon = find_fee(fees, "Monthly")
    check(reg and reg.get("amount_due") == 3000, f"D: Reg amount_due == 3000")
    check(mon and mon.get("amount") == 2500, f"D: Monthly.amount == 2500 (got {mon and mon.get('amount')})")

_p("\n=== D2) Daily + Football (monthly=2000) ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT Daily Football", player_type="Daily", sport="Football",
    dob="2015-01-05",
))
check(r.status_code == 200, f"D2: create Daily Football → 200")
if r.status_code == 200:
    pid = r.json()["id"]; created_player_ids.append(pid)
    fees = get_fees(SUPER_TOK, pid).json()
    mon = find_fee(fees, "Monthly")
    check(mon and mon.get("amount") == 2000, f"D2: Monthly.amount == 2000 (got {mon and mon.get('amount')})")

# ---------- E) Hostel (legacy) ----------
_p("\n=== E) POST player type=Hostel (legacy) sport=Cricket ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT Legacy Hostel", player_type="Hostel", sport="Cricket",
    dob="2014-12-01",
))
check(r.status_code == 200, f"E: create legacy Hostel → 200 (got {r.status_code} {r.text[:200]})")
if r.status_code == 200:
    pid = r.json()["id"]; created_player_ids.append(pid)
    fees = get_fees(SUPER_TOK, pid).json()
    reg = find_fee(fees, "Registration"); mon = find_fee(fees, "Monthly")
    check(reg and reg.get("amount_due") == 3000, f"E: Reg amount_due == 3000 (got {reg and reg.get('amount_due')})")
    check(mon and mon.get("amount") == 12000, f"E: Monthly.amount == 12000 (got {mon and mon.get('amount')})")

# ---------- F) Super Admin overrides ----------
_p("\n=== F) POST as Super Admin with monthly_fee_override=9999 & registration_fee_override=1111 ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT Override Super", player_type="Boarding", sport="Cricket",
    dob="2015-06-01",
    monthly_fee_override=9999,
    registration_fee_override=1111,
))
check(r.status_code == 200, f"F: create with overrides (Super) → 200 (got {r.status_code} {r.text[:200]})")
if r.status_code == 200:
    body = r.json()
    pid = body["id"]; created_player_ids.append(pid)
    check(body.get("monthly_fee_override") == 9999, f"F: person.monthly_fee_override persisted == 9999 (got {body.get('monthly_fee_override')})")
    check(body.get("registration_fee_override") == 1111, f"F: person.registration_fee_override persisted == 1111 (got {body.get('registration_fee_override')})")
    fees = get_fees(SUPER_TOK, pid).json()
    reg = find_fee(fees, "Registration"); mon = find_fee(fees, "Monthly")
    check(reg and reg.get("amount") == 1111, f"F: Reg.amount == 1111 (got {reg and reg.get('amount')})")
    check(reg and reg.get("amount_due") == 1111, f"F: Reg.amount_due == 1111 (got {reg and reg.get('amount_due')})")
    check(mon and mon.get("amount") == 9999, f"F: Monthly.amount == 9999 (got {mon and mon.get('amount')})")
    exp_first = 9999 if TODAY_DAY <= 15 else int(9999/2)
    check(mon and mon.get("amount_due") == exp_first, f"F: Monthly.amount_due == {exp_first} (got {mon and mon.get('amount_due')})")

# ---------- G) Sports Admin overrides silently dropped ----------
_p("\n=== G) POST as Sports Admin with overrides → silently dropped ===")
r = create_player(ADMIN_TOK, base_payload(
    name="AT Override Admin", player_type="Boarding", sport="Cricket",
    dob="2015-07-15",
    monthly_fee_override=9999,
    registration_fee_override=1111,
))
check(r.status_code == 200, f"G: create as Sports Admin → 200 (got {r.status_code} {r.text[:200]})")
if r.status_code == 200:
    body = r.json()
    pid = body["id"]; created_player_ids.append(pid)
    check(body.get("monthly_fee_override") in (None, 0), f"G: overrides dropped (monthly_fee_override is None/absent) (got {body.get('monthly_fee_override')})")
    check(body.get("registration_fee_override") in (None, 0), f"G: overrides dropped (registration_fee_override is None/absent) (got {body.get('registration_fee_override')})")
    fees = get_fees(SUPER_TOK, pid).json()
    reg = find_fee(fees, "Registration"); mon = find_fee(fees, "Monthly")
    check(reg and reg.get("amount") == 20000, f"G: Reg at rate-card 20000 (Boarding) (got {reg and reg.get('amount')})")
    check(mon and mon.get("amount") == 15000, f"G: Monthly at rate-card 15000 (Boarding) (got {mon and mon.get('amount')})")

# ---------- H) Harding Park + Boarding → 400 ----------
_p("\n=== H) POST centre=Harding Park + player_type=Boarding → 400 ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT HP Boarding",
    centre="Harding Park",
    player_type="Boarding",
    sport="Cricket",
    dob="2014-09-09",
))
check(r.status_code == 400, f"H: HP + Boarding → 400 (got {r.status_code})")
if r.status_code == 200:
    # Unexpected — cleanup this leak
    created_player_ids.append(r.json()["id"])
if r.status_code == 400:
    check("Harding Park" in r.text and "Daily" in r.text, f"H: 400 body mentions Harding Park + Daily-only (got: {r.text[:150]})")

# Additional sanity: Harding Park + Daily should still work
_p("\n=== H2) sanity: Harding Park + Daily → 200 ===")
r = create_player(SUPER_TOK, base_payload(
    name="AT HP Daily",
    centre="Harding Park",
    player_type="Daily",
    sport="Cricket",
    dob="2015-04-04",
))
check(r.status_code == 200, f"H2: HP + Daily → 200 (got {r.status_code})")
if r.status_code == 200:
    created_player_ids.append(r.json()["id"])

# ---------- I) PATCH dob → age auto-updated ----------
_p("\n=== I) PATCH /people/{id} with new dob → age auto-updates ===")
# Create baseline player
r = create_player(SUPER_TOK, base_payload(
    name="AT PatchDob", player_type="Daily", sport="Cricket",
    dob="2010-01-01",
))
if r.status_code == 200:
    pid = r.json()["id"]; created_player_ids.append(pid)
    orig_age = r.json().get("age")
    _p(f"   Created with dob=2010-01-01 → age={orig_age}")

    new_dob = "2016-11-20"
    exp_new_age = expected_age(new_dob)
    r2 = requests.patch(f"{BASE}/people/{pid}", json={"dob": new_dob}, headers=hdr(SUPER_TOK))
    check(r2.status_code == 200, f"I: PATCH → 200 (got {r2.status_code} {r2.text[:150]})")
    if r2.status_code == 200:
        body = r2.json()
        check(body.get("dob") == new_dob, f"I: dob updated == {new_dob}")
        check(body.get("age") == exp_new_age, f"I: age auto-updated == {exp_new_age} (got {body.get('age')})")

# ============================================================
# Cleanup
# ============================================================
cleanup(SUPER_TOK)
try_delete_orphan_fees()

# ============================================================
# Summary
# ============================================================
_p("\n" + "=" * 70)
_p(f"RESULT: {PASS} passed, {FAIL} failed")
if FAILS:
    _p("\nFailed assertions:")
    for f in FAILS:
        _p(f"  ❌ {f}")
_p("=" * 70)
sys.exit(0 if FAIL == 0 else 1)
