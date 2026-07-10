# PWS & ALPHA Tracker — PRD

## Overview
Unified mobile-first task management & attendance system for **Prarambhika World School (PWS)** and **ALPHA Sports Academy** (Patna, Bihar). Single app for academics, sports, hostel and ops staff with role-based dashboards and quick attendance marking.

## Audience & Roles (8)
Super Admin · Admin · Teacher · Coach · Warden · Staff · Student · Player.

## Modules Delivered (MVP)
1. **Auth** — JWT bearer token, 10 seeded demo accounts (incl. principal/VP/asst-coach), Quick role chips grouped by org/category on login.
2. **Dashboard** — Role-aware stat tiles (My Tasks / Pending / Overdue / Unread); admin sees totals (users, tasks, pending gate passes); warden sees residents & pending passes; Sports Admin/Head Coach see Coach + Staff Attendance quick actions.
3. **Attendance** — Multi-entity (Students / Players / Staff / **Coach**). Default-present workflow for Staff & Coach. Multi-centre logic (Balua / Harding Park, Daily-only at HP). Per-person quick toggle, idempotent upsert.
4. **Coach Attendance & Lifecycle** — Sports Admin and Head Coach mark coach attendance (default present). Sports Admin and Super Admin can deactivate/reactivate coach accounts; deactivated coaches are excluded from attendance and blocked from login. Read-only view for Assistant Coaches.
5. **Tasks** — Create, list (filters), detail with status workflow + threaded comments + in-app notifications.
6. **Hostel / Warden** — Gate-pass create + approve/reject; morning/night roll-call.
7. **Permission Control Panel** — Super-Admin-only dynamic role permissions (15 keys / 4 templates / audit trail).
8. **Fees Collection** — Auto-create on ALPHA player POST (Registration + Monthly), half-fee rule (admission day≥16), Cash/Online collection, super-only edit.
9. **Bulk Upload** — CSV/XLSX (openpyxl) for player onboarding with row validation + auto-fee.
10. **Controlled Deactivation** — Sports Admin/Head Coach raise request; Super Admin approves/rejects.
12. **Parent App** — Dedicated read-only portal for parents at `/parent`. Wards overview with today's status + 30-day attendance %, ward detail with attendance history, ALPHA fees view, computed alerts (`absent_today`, `low_attendance_7d`, `fees_overdue`). Auto-notifications fire when a student/player is marked absent today.
13. **Notifications + Profile + Directory**.

## Tech
- **Backend**: FastAPI + Motor + MongoDB. JWT (HS256) bearer, bcrypt hashing, role guards (`require_roles`), seed-on-startup with idempotent password sync.
- **Frontend**: Expo SDK 54 + expo-router. AuthContext with expo-secure-store (mobile) + localStorage (web). Axios with token interceptor. Vibrant Play + Swiss design tokens (#3B28CC primary, role-coded chips).

## Demo accounts
See `/app/memory/test_credentials.md`. Tap any role chip on the login screen to auto-fill.

## Smart business angle
Quick role-chip login + colour-coded role pills + "All Present" haptic shortcut cut attendance time per class to under 10 seconds — directly addressing the success metric "reduced manual registers" and driving daily usage retention from teachers/coaches.

## Future enhancements (out of MVP)
GPS / biometric attendance, parent app, performance analytics, AI absentee patterns, push notifications.

## Session updates (June 2026 — fork continuation)
14. **Reports Module Phase 1 (complete)** — `/reports` financial reports (Revenue Summary, Defaulters & Aging, Payment Modes) with global filters + Excel export. Frontend tested; export bug fixed (now uses shared axios client with blob download). Duplicate-sidebar bug fixed (root `_layout.tsx` owns Sidebar; screens must NOT render their own).
15. **Fees Closeout Phase 2 (complete)** — `GET /api/fees/receipt/{batch_id}/pdf` (reportlab, PUBLIC — batch_id UUID is the capability token so parents can open shared links). Receipt modal now has "Download PDF" + "Share Link" buttons (web: open tab / clipboard copy; native: Linking / Share sheet).
16. **Admin Link-Parents UI (complete)** — In `manage/[kind]/[id].tsx` edit form (student/player, admin-only): "Linked Parents" section lists linked parents, link via picker (`POST /api/people/{id}/link-parent`), unlink with confirm (`DELETE /api/people/{id}/link-parent/{user_id}`).
17. **Players Boarding-Status Filters (complete)** — `/manage/player` list has filter chips: All Types / Daily / Day Boarding / Hostel / Boarding. Client-side filter on `player_type` ("Hostel" chip matches legacy "Hostel" + "Hostel Only"), combinable with the Active / All (incl. deactivated) toggle; header count reflects filtered list.
18. **Attendance Mobile-First UX (complete)** — GenericAttendance (`/attendance`) now has a mobile variant (<768px via useBreakpoint): dense 2-column grid with truncated names ("Karan Raj" → "Karan R."), exception-based marking (all default Present), tap-to-cycle P→A→L→Lv per card, and a sticky bottom bar with P|A|L|Lv counters + All P + Save. Desktop wide-row layout with 4 status buttons unchanged. Kind/group chip rows compacted (flexGrow:0).
19. **Auth Redesign — Email/Password + Domain Restriction (complete)** — Mobile/OTP login fully REMOVED. All users sign in with @prarambhika.com email + password (`POST /api/auth/login`). Super Admin assigns accounts/passwords; new/reset accounts carry must_change_password=true → forced password-change step on login screen. Profile change-password now works for all roles incl. Super Admin. Super Admin reset-password (`POST /api/users/{id}/reset-password {new_password}`) assigns temp password. Permission tick-box grid at user creation (custom `permissions` map, admins only). Legacy @pws-alpha.com emails migrated by seed. Super Admins: superadmin@prarambhika.com & superadmin2@prarambhika.com / Super@123. RBAC unchanged. Full credentials: /app/memory/test_credentials.md.
20. **Multi-Month Fee Collection (complete)** — Collect Fees shows ALL unpaid periods grouped (PREVIOUS DUES / CURRENT MONTH) with checkboxes, live total, no-partial rule, single batch receipt (+PDF). New `ensure_all_players_monthly_fees()` bulk-materializes recurring monthly dues for every active player (15-min throttle) and is invoked by fees dashboard, ALPHA dashboard financial band, and reports financial endpoints, so previous dues/outstanding are always complete.
21. **Advance Fee Payment (complete)** — Collect Fees offers a collapsible "Pay in advance" section listing future months up to the Indian FY end (Apr–Mar). Advance months (Monthly/Transport) are materialized as fee rows (advance_payment=true) and settled in the same single batch/receipt as any selected outstanding dues; paid future months never resurface as dues and don't inflate outstanding.
22. **Staff ↔ Permissions Sync (complete)** — Staff people auto-get synced user accounts (person_id link, slug email @prarambhika.com, default Staff@123 + forced change), visible in Permissions; sync on create/update/activate/deactivate; seed purge removed + idempotent backfill. Permissions page now has fast search + org/status/role filter chips with live result count.
