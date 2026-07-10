"""Re-verify S1 (super 9801772660 OTP) and S12 (POST /users for new principal) after fix in core.py line 316."""
import requests, sys, time, os

BASE = os.environ.get("BACKEND_URL", "https://unified-track.preview.emergentagent.com") + "/api"

def log(ok, msg):
    print(("\033[32m[PASS]\033[0m " if ok else "\033[31m[FAIL]\033[0m ") + msg)

# Quick login helper for super_admin (legacy email)
def super_token():
    r = requests.post(f"{BASE}/auth/login", json={"email":"super@pws-alpha.com","password":"Super@123"}, timeout=20)
    assert r.status_code == 200, f"Super login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]

results = []

# ============== S1 part (b): 9801772660 super OTP ==============
print("\n=== S1 part (b): Super Admin OTP login for 9801772660 ===")

# Clear any cooldown by waiting briefly; if cooldown hits we retry
mobile = "9801772660"

def otp_send_super(mobile):
    return requests.post(f"{BASE}/auth/otp/send", json={"mobile":mobile, "purpose":"super_admin"}, timeout=20)

r = otp_send_super(mobile)
if r.status_code == 429:
    # wait for cooldown
    print(f"Cooldown hit; waiting 31s ...")
    time.sleep(31)
    r = otp_send_super(mobile)

s1_send_ok = r.status_code == 200 and r.json().get("mock_code") == "123456"
log(s1_send_ok, f"S1 otp/send 9801772660 super_admin → {r.status_code} body={r.text[:200]}")
results.append(("S1 otp/send 9801772660", s1_send_ok))

# verify
r = requests.post(f"{BASE}/auth/otp/verify", json={"mobile":mobile, "code":"123456", "purpose":"super_admin"}, timeout=20)
print(f"otp/verify status={r.status_code} body={r.text[:400]}")
verify_ok = False
user_obj = None
access_token = None
if r.status_code == 200:
    body = r.json()
    stage = body.get("stage")
    access_token = body.get("access_token")
    user_obj = body.get("user") or {}
    role_ok = user_obj.get("role") == "super_admin"
    email_field = user_obj.get("email")
    # spec: email=None or absent
    email_ok = (email_field is None)
    stage_ok = stage == "logged_in"
    token_ok = bool(access_token)
    verify_ok = role_ok and email_ok and stage_ok and token_ok
    log(stage_ok, f"S1 stage == 'logged_in' (got {stage})")
    log(token_ok, f"S1 access_token present (len={len(access_token or '')})")
    log(role_ok, f"S1 user.role == 'super_admin' (got {user_obj.get('role')})")
    log(email_ok, f"S1 user.email is None/absent (got {email_field!r})")
    log(verify_ok, f"S1 mobile={user_obj.get('mobile')} name={user_obj.get('name')}")
else:
    log(False, f"S1 otp/verify failed: {r.status_code} {r.text}")

results.append(("S1 otp/verify 9801772660 → 200 logged_in", verify_ok))

# ============== S12: POST /users (super) ==============
print("\n=== S12: super POST /users for additional principal ===")
super_t = super_token()
hdr = {"Authorization": f"Bearer {super_t}"}

# Pre-cleanup: delete any pre-existing user with mobile 9000000099
list_r = requests.get(f"{BASE}/users", headers=hdr, timeout=20).json()
existing = [u for u in list_r if u.get("mobile") == "9000000099"]
for u in existing:
    requests.delete(f"{BASE}/users/{u['id']}", headers=hdr, timeout=20)
    print(f"Pre-cleanup: deleted existing user {u.get('id')} mobile {u.get('mobile')}")

# Capture original principal count
princ_list_before = requests.get(f"{BASE}/users?role=principal", headers=hdr, timeout=20).json()
original_principal_ids = {u["id"] for u in princ_list_before if u.get("role") == "principal"}
print(f"Original principals: {len(original_principal_ids)} ids={original_principal_ids}")

# Create Test Principal 2
payload = {"role":"principal", "organization":"PWS", "mobile":"9000000099", "name":"Test Principal 2"}
r = requests.post(f"{BASE}/users", headers=hdr, json=payload, timeout=20)
print(f"POST /users → {r.status_code} body={r.text[:600]}")
s12_create_ok = r.status_code == 200
log(s12_create_ok, f"S12 POST /users → 200 (got {r.status_code})")
results.append(("S12 POST /users 200", s12_create_ok))

new_user = None
test_p2_id = None
if s12_create_ok:
    new_user = r.json()
    test_p2_id = new_user.get("id")
    has_id = bool(test_p2_id)
    role_ok = new_user.get("role") == "principal"
    mobile_ok = new_user.get("mobile") == "9000000099"
    name_ok = new_user.get("name") == "Test Principal 2"
    org_ok = new_user.get("organization") == "PWS"
    log(has_id, f"S12 response has id={test_p2_id}")
    log(role_ok, f"S12 response role=principal (got {new_user.get('role')})")
    log(mobile_ok, f"S12 response mobile=9000000099 (got {new_user.get('mobile')})")
    log(name_ok, f"S12 response name='Test Principal 2' (got {new_user.get('name')})")
    log(org_ok, f"S12 response organization=PWS (got {new_user.get('organization')})")
    results.append(("S12 response shape", has_id and role_ok and mobile_ok and name_ok and org_ok))

# GET /users?role=principal should contain BOTH original + Test P2
princ_list_after = requests.get(f"{BASE}/users?role=principal", headers=hdr, timeout=20).json()
after_ids = {u["id"] for u in princ_list_after if u.get("role") == "principal"}
has_test_p2 = test_p2_id in after_ids if test_p2_id else False
has_originals = original_principal_ids.issubset(after_ids)
print(f"After-create principals: {len(after_ids)} ids={after_ids}")
log(has_originals, f"S12 GET /users?role=principal still contains all original {len(original_principal_ids)} principal(s)")
log(has_test_p2, f"S12 GET /users?role=principal contains Test P2 ({test_p2_id})")
results.append(("S12 GET ?role=principal contains both", has_originals and has_test_p2))

# DELETE Test P2
if test_p2_id:
    r = requests.delete(f"{BASE}/users/{test_p2_id}", headers=hdr, timeout=20)
    print(f"DELETE /users/{test_p2_id} → {r.status_code} {r.text[:200]}")
    del_ok = r.status_code == 200
    log(del_ok, f"S12 DELETE /users/{test_p2_id} → 200")
    results.append(("S12 DELETE → 200", del_ok))

    # verify deletion
    princ_list_final = requests.get(f"{BASE}/users?role=principal", headers=hdr, timeout=20).json()
    final_ids = {u["id"] for u in princ_list_final if u.get("role") == "principal"}
    removed_ok = test_p2_id not in final_ids
    log(removed_ok, f"S12 Verify Test P2 removed from list (final count={len(final_ids)})")
    results.append(("S12 deletion verified", removed_ok))
else:
    results.append(("S12 DELETE", False))

# Final summary
print("\n========== SUMMARY ==========")
passed = sum(1 for _, ok in results if ok)
total = len(results)
for name, ok in results:
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
print(f"\nTotal: {passed}/{total} assertions PASS")
sys.exit(0 if passed == total else 1)
