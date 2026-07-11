# Entity ID Plan (Milestone 0)

**Status:** Planning only — no schema migration in Milestone 0.  
**Purpose:** Prepare PWS/ALPHA financial and operational isolation before PostgreSQL migration (per SportsSchool OS spec).

## Canonical entities

| `entity_id` | Label | Maps from current `organization` |
|-------------|-------|--------------------------------|
| `pws` | Prarambhika World School | `PWS` |
| `alpha` | ALPHA Sports Academy | `ALPHA` |
| `both` | Cross-org (rare) | `BOTH` on users only |

## Phase 1 — Add optional field (MongoDB, no breaking change)

Add `entity_id` to new writes where `organization` already exists:

| Collection | Current scope field | Proposed `entity_id` rule |
|------------|--------------------|---------------------------|
| `people` | `organization` | `pws` if PWS student/staff; `alpha` if player/ALPHA staff |
| `users` | `organization` | Map PWS→`pws`, ALPHA→`alpha`, BOTH→`both` |
| `attendance` | implicit via person | Copy from person's `entity_id` on write |
| `fees` | ALPHA-only today | Always `alpha` |
| `tasks` | `department` string | Optional `entity_id` when department is org-specific |
| `gate_passes`, `roll_calls` | hostel | `both` or derive from resident |
| `notifications` | none | Optional; not required for M0 |

**Backfill script (future):** One-time job sets `entity_id` from `organization` on `people` and `users`. Reads accept either field during transition.

## Phase 2 — Enforce on API (feature flag)

- `FEATURE_ENTITY_SCOPE=true` gates list endpoints:
  - Sports Admin (`admin`) → `entity_id=alpha` only
  - Principal/VP → `entity_id=pws` for school records
  - Super Admin → no filter unless `?entity_id=` query param

## Phase 3 — PostgreSQL (when approved)

- `entities` table with UUID PK
- All new finance/academic tables require `entity_id` FK
- Mongo→Postgres migration reconciles counts per `entity_id`

## What Milestone 0 does NOT do

- No `entity_id` column added to MongoDB yet
- No API behavior change
- No PostgreSQL setup

## Next milestone touchpoint

**Milestone 1 (class/section)** should add `entity_id` to `academic_years`, `sections`, and `people.section_id` when those collections are created.
