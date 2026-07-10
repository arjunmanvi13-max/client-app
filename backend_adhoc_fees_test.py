"""
Ad-Hoc Fee Creation Backend Tests — Fees Closeout Sprint
Tests POST /api/fees and GET /api/fees/adhoc-types endpoints.
Backend URL: from EXPO_PUBLIC_BACKEND_URL (frontend/.env)
MOCK OTP = "123456"
"""
import time
import requests
from datetime import date, timedelta

BACKEND_URL = "https://unified-track.preview.emergentagent.com"
BASE = f"{BACKEND_URL}/api"

results = []  # list of (sid, name, passed, detail)


def report(sid, name, passed, detail=""):
    mark = "PASS" if passed else "FAIL"
    print(f"[{mark}] {sid} {name}: {detail}")
    results.append((sid, name, passed, detail))


def post(path, **kw):
    return requests.post(BASE + path, timeout=30, **kw)


def get(path, **kw):
    return requests.get(BASE + path, timeout=30, **kw)


def patch(path, **kw):
    return requests.patch(BASE + path, timeout=30, **kw)


def authh(token):
    return {"Authorization": f"Bearer {token}"}


def legacy_login(email, pw):
    r = post("/auth/login", json={"email": email, "password": pw})
    return r


def super_otp_login(mobile="9631252241"):
    r = post("/auth/otp/send", json={"mobile": mobile, "purpose": "super_admin"})
    if r.status_code == 429:
        # cooldown — sleep and retry once
        time.sleep(35)
        r = post("/auth/otp/send", json={"mobile": mobile, "purpose": "super_admin"})
    if r.status_code != 200:
        return None, None, f"send {r.status_code} {r.text}"
    time.sleep(0.3)
    r2 = post("/auth/otp/verify", json={"mobile": mobile, "code": "123456", "purpose": "super_admin"})
    if r2.status_code != 200:
        return None, None, f"verify {r2.status_code} {r2.text}"
    j = r2.json()
    return j.get("access_token"), j.get("user"), j


# ------------------ Logins ------------------
print("\n=== Setup logins ===")

# Super admin via OTP (review requires this)
SUPER_TOKEN, SUPER_USER, _ = super_otp_login("9631252241")
assert SUPER_TOKEN, f"Super OTP login failed: {_}"
report("Setup", "Super OTP login (9631252241/123456)", True, f"user={SUPER_USER.get('name')}, role={SUPER_USER.get('role')}")
SUPER_NAME = SUPER_USER.get("name")

# Sports admin via mobile+password
r = post("/auth/login/mobile", json={"mobile": "9000000001", "password": "Admin@123"})
assert r.status_code == 200, f"sports admin login failed: {r.status_code} {r.text}"
ADMIN_TOKEN = r.json()["access_token"]
ADMIN_USER = r.json()["user"]
report("Setup", "Sports admin login (9000000001/Admin@123)", True, f"name={ADMIN_USER.get('name')}, role={ADMIN_USER.get('role')}")

# Other roles via legacy login (simpler)
r = legacy_login("principal@pws-alpha.com", "Principal@123")
PRINCIPAL_TOKEN = r.json()["access_token"] if r.status_code == 200 else None

r = legacy_login("teacher@pws-alpha.com", "Teacher@123")
TEACHER_TOKEN = r.json()["access_token"] if r.status_code == 200 else None

r = legacy_login("coach@pws-alpha.com", "Coach@123")
COACH_TOKEN = r.json()["access_token"] if r.status_code == 200 else None

print(f"Principal token: {'OK' if PRINCIPAL_TOKEN else 'MISSING'}")
print(f"Teacher token:   {'OK' if TEACHER_TOKEN else 'MISSING'}")
print(f"Coach token:     {'OK' if COACH_TOKEN else 'MISSING'}")


# ------------------ Track created fees for cleanup ------------------
created_fee_ids = []

# ------------------ Find ALPHA player + PWS student + coach person ------------------
print("\n=== Setup test subjects ===")
r = get("/people", params={"kind": "player"}, headers=authh(SUPER_TOKEN))
assert r.status_code == 200, f"GET /people?kind=player failed: {r.status_code} {r.text}"
players = r.json()
alpha_players = [p for p in players if p.get("organization") == "ALPHA"]
assert alpha_players, "No ALPHA players found in DB"
ALPHA_PLAYER = alpha_players[0]
print(f"Picked ALPHA player: {ALPHA_PLAYER['name']} (id={ALPHA_PLAYER['id']}, centre={ALPHA_PLAYER.get('centre')}, sport={ALPHA_PLAYER.get('sport')}, category={ALPHA_PLAYER.get('player_type')})")

# PWS student
r = get("/people", params={"kind": "student"}, headers=authh(SUPER_TOKEN))
PWS_STUDENT = None
if r.status_code == 200:
    students = [s for s in r.json() if s.get("organization") == "PWS"]
    if students:
        PWS_STUDENT = students[0]
        print(f"Picked PWS student: {PWS_STUDENT['name']} (id={PWS_STUDENT['id']})")

# A coach person (kind=coach in /people)
r = get("/people", params={"kind": "coach"}, headers=authh(SUPER_TOKEN))
COACH_PERSON = None
if r.status_code == 200 and r.json():
    COACH_PERSON = r.json()[0]
    print(f"Picked coach person: {COACH_PERSON['name']} (id={COACH_PERSON['id']})")


# ------------------ S1. Super Admin happy path ------------------
print("\n=== S1: Super admin happy path POST /api/fees ===")
due_date = (date.today() + timedelta(days=5)).strftime("%Y-%m-%d")
payload = {
    "player_id": ALPHA_PLAYER["id"],
    "fee_type": "Uniform",
    "amount": 1500,
    "due_date": due_date,
    "notes": "Annual uniform charge",
}
r = post("/fees", json=payload, headers=authh(SUPER_TOKEN))
ok = r.status_code == 200
report("S1.1", "POST /api/fees (Super, Uniform, 1500)", ok, f"status={r.status_code} body={r.text[:200] if not ok else 'OK'}")

if ok:
    body = r.json()
    CREATED_FEE_ID = body.get("id")
    created_fee_ids.append(CREATED_FEE_ID)
    expected_period = due_date[:7]
    checks = [
        ("id present", bool(body.get("id"))),
        ("player_id matches", body.get("player_id") == ALPHA_PLAYER["id"]),
        ("player_name matches", body.get("player_name") == ALPHA_PLAYER["name"]),
        ("centre present", body.get("centre") == ALPHA_PLAYER.get("centre")),
        ("sport present", body.get("sport") == ALPHA_PLAYER.get("sport")),
        ("category present", bool(body.get("category"))),
        ("fee_type=Uniform", body.get("fee_type") == "Uniform"),
        ("amount=1500", body.get("amount") == 1500),
        ("amount_due=1500", body.get("amount_due") == 1500),
        (f"due_date={due_date}", body.get("due_date") == due_date),
        (f"period_month={expected_period}", body.get("period_month") == expected_period),
        ("status=due", body.get("status") == "due"),
        ("is_adhoc=true", body.get("is_adhoc") is True),
        ("created_by_name set", bool(body.get("created_by_name"))),
        ("created_at present", bool(body.get("created_at"))),
    ]
    for label, passed in checks:
        report("S1.2", f"response field: {label}", passed, f"actual={body.get(label.split('=')[0].strip())}" if not passed else "")

    # Verify listing
    r2 = get("/fees", params={"player_id": ALPHA_PLAYER["id"]}, headers=authh(SUPER_TOKEN))
    found = any(f.get("id") == CREATED_FEE_ID for f in (r2.json() if r2.status_code == 200 else []))
    report("S1.3", "GET /api/fees?player_id includes new fee", found, f"status={r2.status_code}")
else:
    CREATED_FEE_ID = None


# ------------------ S2. GET /api/fees/adhoc-types ------------------
print("\n=== S2: GET /api/fees/adhoc-types ===")
EXPECTED_TYPES = ["Uniform", "Kit", "Tournament", "Books", "Event", "Other"]

r = get("/fees/adhoc-types", headers=authh(SUPER_TOKEN))
ok = r.status_code == 200 and r.json().get("types") == EXPECTED_TYPES
report("S2.1", "super GET /adhoc-types", ok, f"status={r.status_code} body={r.text[:200]}")

r = get("/fees/adhoc-types", headers=authh(ADMIN_TOKEN))
ok = r.status_code == 200 and r.json().get("types") == EXPECTED_TYPES
report("S2.2", "sports_admin GET /adhoc-types", ok, f"status={r.status_code} body={r.text[:200]}")

# Role without view_fees - teacher (since parent doesn't exist as seed user with that perm-set)
if TEACHER_TOKEN:
    r = get("/fees/adhoc-types", headers=authh(TEACHER_TOKEN))
    ok = r.status_code == 403
    report("S2.3", "teacher GET /adhoc-types (no view_fees)", ok, f"status={r.status_code} body={r.text[:200]}")


# ------------------ S3. Role restrictions on POST /api/fees ------------------
print("\n=== S3: Non-super_admin POST /fees → 403 ===")

base_payload = {
    "player_id": ALPHA_PLAYER["id"],
    "fee_type": "Kit",
    "amount": 500,
    "due_date": due_date,
}

r = post("/fees", json=base_payload, headers=authh(ADMIN_TOKEN))
ok = r.status_code == 403 and "Super Admin" in r.text
report("S3.1", "sports_admin POST /fees → 403", ok, f"status={r.status_code} body={r.text[:200]}")

if PRINCIPAL_TOKEN:
    r = post("/fees", json=base_payload, headers=authh(PRINCIPAL_TOKEN))
    ok = r.status_code == 403
    report("S3.2", "principal POST /fees → 403", ok, f"status={r.status_code} body={r.text[:200]}")

if TEACHER_TOKEN:
    r = post("/fees", json=base_payload, headers=authh(TEACHER_TOKEN))
    ok = r.status_code == 403
    report("S3.3", "teacher POST /fees → 403", ok, f"status={r.status_code} body={r.text[:200]}")

if COACH_TOKEN:
    r = post("/fees", json=base_payload, headers=authh(COACH_TOKEN))
    ok = r.status_code == 403
    report("S3.4", "coach POST /fees → 403", ok, f"status={r.status_code} body={r.text[:200]}")


# ------------------ S4. Validation errors (as super_admin) ------------------
print("\n=== S4: Validation errors ===")

def post_fees(d):
    return post("/fees", json=d, headers=authh(SUPER_TOKEN))

# 4a. Invalid fee_type
r = post_fees({"player_id": ALPHA_PLAYER["id"], "fee_type": "Random", "amount": 1500, "due_date": due_date})
# Could be 400 (custom check) or 422 (pydantic Literal validation)
ok = r.status_code in (400, 422)
detail = r.text[:200]
report("S4.1", "fee_type='Random' → 400/422", ok, f"status={r.status_code} body={detail}")

# 4b. amount = 0
r = post_fees({"player_id": ALPHA_PLAYER["id"], "fee_type": "Uniform", "amount": 0, "due_date": due_date})
ok = r.status_code == 400 and "greater than 0" in r.text
report("S4.2", "amount=0 → 400 must be greater than 0", ok, f"status={r.status_code} body={r.text[:200]}")

# 4c. amount = -100
r = post_fees({"player_id": ALPHA_PLAYER["id"], "fee_type": "Uniform", "amount": -100, "due_date": due_date})
ok = r.status_code == 400 and "greater than 0" in r.text
report("S4.3", "amount=-100 → 400 must be greater than 0", ok, f"status={r.status_code} body={r.text[:200]}")

# 4d. due_date wrong format "2026/06/15"
r = post_fees({"player_id": ALPHA_PLAYER["id"], "fee_type": "Uniform", "amount": 100, "due_date": "2026/06/15"})
ok = r.status_code == 400
report("S4.4", "due_date='2026/06/15' → 400", ok, f"status={r.status_code} body={r.text[:200]}")

# 4e. due_date "abcd"
r = post_fees({"player_id": ALPHA_PLAYER["id"], "fee_type": "Uniform", "amount": 100, "due_date": "abcd"})
ok = r.status_code == 400
report("S4.5", "due_date='abcd' → 400", ok, f"status={r.status_code} body={r.text[:200]}")

# 4f. due_date missing
r = post_fees({"player_id": ALPHA_PLAYER["id"], "fee_type": "Uniform", "amount": 100})
ok = r.status_code in (400, 422)
report("S4.6", "due_date missing → 400/422", ok, f"status={r.status_code} body={r.text[:200]}")

# 4g. due_date empty
r = post_fees({"player_id": ALPHA_PLAYER["id"], "fee_type": "Uniform", "amount": 100, "due_date": ""})
ok = r.status_code in (400, 422)
report("S4.7", "due_date='' → 400/422", ok, f"status={r.status_code} body={r.text[:200]}")

# 4h. nonexistent player
r = post_fees({"player_id": "nonexistent-uuid-xyz", "fee_type": "Uniform", "amount": 100, "due_date": due_date})
ok = r.status_code == 404 and "Player not found" in r.text
report("S4.8", "player_id non-existent → 404 Player not found", ok, f"status={r.status_code} body={r.text[:200]}")

# 4i. PWS student id → 400
if PWS_STUDENT:
    r = post_fees({"player_id": PWS_STUDENT["id"], "fee_type": "Uniform", "amount": 100, "due_date": due_date})
    ok = r.status_code == 400 and ("ALPHA" in r.text or "players" in r.text)
    report("S4.9", "PWS student id → 400", ok, f"status={r.status_code} body={r.text[:200]}")
else:
    report("S4.9", "PWS student id → skipped (no PWS student in seed)", True, "skipped")

# 4j. Coach kind id → 400
if COACH_PERSON:
    r = post_fees({"player_id": COACH_PERSON["id"], "fee_type": "Uniform", "amount": 100, "due_date": due_date})
    ok = r.status_code == 400 and "players" in r.text.lower()
    report("S4.10", "coach kind id → 400 (can only be created for players)", ok, f"status={r.status_code} body={r.text[:200]}")
else:
    # Try to use the coach@ user id (User.id, not Person id) — should also fail with 404 since not in people
    report("S4.10", "coach kind id → skipped (no kind=coach person)", True, "skipped")


# ------------------ S5. Audit notification ------------------
print("\n=== S5: Audit notification ===")
if CREATED_FEE_ID:
    # Try to access notifications via DB directly through a helper API or pymongo
    # Use pymongo since we have backend access
    try:
        from pymongo import MongoClient
        import os as _os
        # backend/.env has MONGO_URL
        mclient = MongoClient("mongodb://localhost:27017")
        mdb = mclient["pws_alpha_db"]
        notif = mdb.notifications.find_one({
            "kind": "fee_adhoc_created",
            "audience_role": "super_admin",
            "body": {"$regex": ALPHA_PLAYER["name"]},
        }, sort=[("at", -1)])
        if notif:
            body_str = notif.get("body", "")
            has_name = ALPHA_PLAYER["name"] in body_str
            has_amt = "1,500" in body_str or "1500" in body_str
            report("S5.1", "notification doc exists (kind=fee_adhoc_created, audience=super_admin)", True, f"body={body_str[:120]}")
            report("S5.2", "notification body contains player name + amount", has_name and has_amt, f"name={has_name} amt={has_amt}")
        else:
            report("S5.1", "notification doc exists", False, "no matching doc found")
        mclient.close()
    except Exception as e:
        report("S5.1", "notification check (pymongo)", False, f"err={e}")


# ------------------ S6. Regression: discount + collect ------------------
print("\n=== S6: Discount + collect on ad-hoc fee ===")
if CREATED_FEE_ID:
    # PATCH /fees/{id}/discount as super
    r = patch(f"/fees/{CREATED_FEE_ID}/discount", json={"discount_amount": 100, "reason": "test discount"}, headers=authh(SUPER_TOKEN))
    ok = r.status_code == 200
    if ok:
        body = r.json()
        ok = body.get("amount_due") == 1400 and body.get("discount_applied") == 100
    report("S6.1", "PATCH /fees/{id}/discount (super, 100) → amount_due=1400", ok, f"status={r.status_code} body={r.text[:200]}")

    # POST /fees/{id}/collect as super
    r = post(f"/fees/{CREATED_FEE_ID}/collect", json={"payment_mode": "Cash"}, headers=authh(SUPER_TOKEN))
    ok = r.status_code == 200 and r.json().get("status") == "paid"
    report("S6.2", "POST /fees/{id}/collect (super, Cash) → paid", ok, f"status={r.status_code} body={r.text[:200]}")


# ------------------ Cleanup ------------------
print("\n=== Cleanup ===")
try:
    from pymongo import MongoClient
    mclient = MongoClient("mongodb://localhost:27017")
    mdb = mclient["pws_alpha_db"]
    # Remove our created ad-hoc fees
    if created_fee_ids:
        d = mdb.fees.delete_many({"id": {"$in": created_fee_ids}})
        report("Cleanup", f"removed {d.deleted_count} ad-hoc fees", True, f"ids={created_fee_ids}")
    # Remove notifications produced during this test
    d = mdb.notifications.delete_many({
        "kind": "fee_adhoc_created",
        "body": {"$regex": ALPHA_PLAYER["name"]},
    })
    report("Cleanup", f"removed {d.deleted_count} notification docs", True, "")
    mclient.close()
except Exception as e:
    report("Cleanup", "cleanup failed", False, f"err={e}")


# ------------------ Summary ------------------
print("\n" + "=" * 60)
total = len(results)
passed = sum(1 for r in results if r[2])
failed = total - passed
print(f"TOTAL: {total}  PASSED: {passed}  FAILED: {failed}")
print("=" * 60)
if failed:
    print("\nFAILURES:")
    for sid, name, ok, det in results:
        if not ok:
            print(f"  [{sid}] {name} :: {det}")
