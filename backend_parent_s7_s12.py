"""Re-verification of S7 and S12 only after parents.py fees query fix."""
import requests
from datetime import datetime, timezone, timedelta

BACKEND_URL = "https://unified-track.preview.emergentagent.com/api"
CREDS = {"parent_alpha": ("parent_alpha@pws-alpha.com", "Parent@123")}


def login(em, pw):
    r = requests.post(f"{BACKEND_URL}/auth/login", json={"email": em, "password": pw}, timeout=20)
    r.raise_for_status()
    return r.json()


def H(t):
    return {"Authorization": f"Bearer {t}"}


def main():
    j = login(*CREDS["parent_alpha"])
    tok = j["access_token"]
    user = j["user"]
    aditya_id = (user.get("linked_person_ids") or [None])[0]
    print(f"parent_alpha user.id={user['id']} aditya_id={aditya_id}")

    # ---- S7 ----
    print("\n--- S7: GET /parent/fees/{aditya_id} ---")
    r = requests.get(f"{BACKEND_URL}/parent/fees/{aditya_id}", headers=H(tok), timeout=20)
    print(f"status={r.status_code}")
    s7_pass = False
    if r.status_code == 200:
        b = r.json()
        fees = b.get("fees") or []
        summ = b.get("summary") or {}
        print(f"  fees_count={len(fees)}")
        for f in fees:
            print(f"    - type={f.get('fee_type')} due_date={f.get('due_date')} amount_due={f.get('amount_due')} status={f.get('status')}")
        print(f"  summary={summ}")
        s7_pass = len(fees) >= 2 and summ.get("total_due", 0) > 0
    print(f"S7 PASS={s7_pass}")

    # ---- S12 ----
    print("\n--- S12: GET /parent/alerts (computed fees_overdue) ---")
    r = requests.get(f"{BACKEND_URL}/parent/alerts", headers=H(tok), timeout=20)
    print(f"status={r.status_code}")
    s12_pass = False
    if r.status_code == 200:
        b = r.json()
        comp = b.get("computed") or []
        print(f"  computed_count={len(comp)}")
        for a in comp:
            print(f"    - type={a.get('type')} ward_id={a.get('ward_id')} severity={a.get('severity')} amount_due={a.get('amount_due')}")
        overdue = [a for a in comp if a.get("type") == "fees_overdue" and a.get("ward_id") == aditya_id]
        if overdue:
            o = overdue[0]
            s12_pass = (o.get("severity") == "medium") and (o.get("amount_due", 0) > 0)
    print(f"S12 PASS={s12_pass}")

    print(f"\n=== Summary: S7={s7_pass}, S12={s12_pass} ===")
    return 0 if s7_pass and s12_pass else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
