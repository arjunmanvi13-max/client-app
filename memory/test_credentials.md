# Test Credentials – PWS & ALPHA Tracker

## AUTH MODEL (since June 2026 redesign)
- **Email + password ONLY.** All emails MUST end with `@prarambhika.com` (other domains rejected with 400).
- Mobile/OTP login has been REMOVED entirely (`/api/auth/otp/*` and `/api/auth/login/mobile` no longer exist).
- Login: `POST /api/auth/login {email, password}` → `{access_token, user, must_change_password}`.
- If `must_change_password=true`, the UI forces the user to set a new password via `POST /api/auth/password/change {current_password, new_password}`.
- Super Admin resets any user's password: `POST /api/users/{id}/reset-password {new_password}` (sets must_change_password=true).
- New users created via `POST /api/users` require email (@prarambhika.com) + password; created with must_change_password=true. Optional `permissions` tick-box map.

## Accounts (all password-based)
| Role | Email | Password |
|---|---|---|
| Super Admin 1 | superadmin@prarambhika.com | Super@123 |
| Super Admin 2 | superadmin2@prarambhika.com | Super@123 |
| Super Admin (demo, Anita) | super@prarambhika.com | Super@123 |
| Sports Admin | admin@prarambhika.com | Admin@123 |
| Principal | principal@prarambhika.com | Principal@123 |
| Vice Principal | vp@prarambhika.com | Vp@123 |
| Teacher | teacher@prarambhika.com | Teacher@123 |
| Head Coach | coach@prarambhika.com | Coach@123 |
| Asst Coach | asst_coach@prarambhika.com | Asst@123 |
| Warden | warden@prarambhika.com | Warden@123 |
| Student | student@prarambhika.com | Student@123 |
| Player | player@prarambhika.com | Player@123 |
| Parent PWS | parent_pws@prarambhika.com | Parent@123 |
| Parent ALPHA | parent_alpha@prarambhika.com | Parent@123 |

Notes:
- Login page has quick-fill demo chips (web) with these accounts.
- Seed re-applies these passwords on backend restart (demo accounts only).
- Frontend login testIDs: `login-email`, `login-password`, `btn-login`; force-change step: `force-new-pwd`, `force-new-pwd2`, `btn-force-change`.
