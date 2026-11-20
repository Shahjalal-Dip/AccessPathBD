# AccessPath BD: Backend

REST API for AccessPath BD. Built with **NestJS 11**, **TypeScript**, **PostgreSQL** (TypeORM + migrations) and **Redis**.

Base URL (local): `http://localhost:5001/api/v1`  
Interactive docs (Swagger): `http://localhost:5001/api/docs`  
Health check: `GET http://localhost:5001/health`

This project was started from the faculty NestJS boilerplate and keeps its structure (TypeORM, `@/` import aliases, Redis, Swagger).

---

## 1. Requirements

| Tool | Version |
|---|---|
| Node.js | 22 (NestJS 11 needs 20 or newer) |
| pnpm | 10 (`npm i -g pnpm@10`) |
| PostgreSQL | 14 or newer (16 used in development) |
| Redis | 6 or newer (required: used to invalidate tokens on logout) |
| Docker | optional, for the included PostgreSQL + Redis compose file |

## 2. Setup

```bash
cd backend
pnpm install

# environment file
cp .env.example .env            # Windows PowerShell: copy .env.example .env
```

Open `.env` and set `JWT_BEARER_SECRET` to a long random value. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The app **refuses to start** if the secret is missing, shorter than 16 characters, or still the placeholder.

Start PostgreSQL and Redis (Docker):

```bash
docker compose -f docker-compose.dev.yml up -d
```

This creates PostgreSQL on `localhost:5432` (user `postgres`, password `postgres`, database `accesspath_dev`) and Redis on `localhost:6379`. These match `.env.example`. If you already run PostgreSQL locally on port 5432, stop it or change the port in the compose file and `.env`.

Create the tables, add demo data, and run:

```bash
pnpm migration:run              # creates all tables
pnpm seeder:run:dev             # demo users, 10 sample buildings, reports, reviews
pnpm start:dev                  # http://localhost:5001 (auto-reloads)
```

> `pnpm` 10 may print "Ignored build scripts". `argon2` ships prebuilt binaries and works as is. If it ever fails to load, run `pnpm approve-builds` and select `argon2`.

### Demo accounts (created by the seeder)

Password for all: `Passw0rd!demo` (override with `SEED_PASSWORD` in `.env`).

| Role | Email |
|---|---|
| Administrator | `admin@accesspath.test` |
| Moderator | `moderator@accesspath.test` |
| Contributor | `contributor@accesspath.test` |

The seeder also creates two extra contributors (`rafiq@accesspath.test`, `tanvir@accesspath.test`) who wrote the demo reviews. The seed data deliberately includes examples of every trust label (Current, Outdated, Disputed, Unknown) and a few pending reports so the moderation queue is not empty. Replace the placeholder buildings with your real campus data.

## 3. Scripts

| Command | What it does |
|---|---|
| `pnpm start:dev` | Run with hot reload |
| `pnpm build` | Compile to `dist/` |
| `pnpm start:prod` | Run the compiled app (`node dist/main`) |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:rollback` | Undo the last migration |
| `pnpm migration:generate src/database/migrations/Name` | Create a migration from entity changes. **Review the SQL before running it** |
| `pnpm migration:run:prod` | Apply migrations using the compiled JavaScript (for production) |
| `pnpm seeder:run:dev` | Add demo data (skips if users already exist) |
| `pnpm seeder:refresh:dev` | Wipe all tables and re-seed (refuses to run in production) |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests against a real database (see section 9) |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |

## 4. Environment variables

Defined and validated in `src/config/app.config.ts`. Copy `.env.example` to `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `5001` | API port |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend address. Used in email links and as the default CORS origin |
| `CORS_ORIGINS` | (FRONTEND_URL) | Comma-separated allowed origins |
| `COOKIE_SECRET` | dev value | Secret for signed cookies. Change in production |
| `JWT_BEARER_SECRET` | **required** | Signs login tokens (minimum 16 characters) |
| `JWT_TTL` | `86400` | Token lifetime in seconds (1 day) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` | see `.env.example` | PostgreSQL connection |
| `DB_SSL` | off | Set `true` for most hosted databases (Neon, Supabase, Render) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | `localhost`, `6379` | Redis connection |
| `FRESHNESS_DAYS` | `90` | Verified information older than this is shown as **Outdated** |
| `CONFLICT_WINDOW_DAYS` | `30` | Approved reports this close in time must agree, otherwise **Disputed** |
| `UPLOAD_DIR` | `storage/evidence` | Where report photos are stored |
| `COVER_DIR` | `storage/covers` | Where building cover photos are stored |
| `UPLOAD_MAX_FILE_MB` | `5` | Maximum size of one image |
| `UPLOAD_MAX_FILES_PER_REPORT` | `5` | Maximum photos per report |
| `THROTTLE_TTL_SECONDS`, `THROTTLE_LIMIT`, `AUTH_THROTTLE_LIMIT` | `60`, `100`, `10` | Rate limits (general and for sign-in, registration, password reset) |
| `MAILER_HOST`, `MAILER_PORT`, `MAILER_USER`, `MAILER_PASSWORD`, `MAILER_FROM` | unset | Optional SMTP. If unset, reset and verification links are printed in the server console |
| `SEED_PASSWORD` | `Passw0rd!demo` | Password for seeded demo accounts |

## 5. Roles

| Role | Can do |
|---|---|
| **Visitor** (no login) | Browse, search and filter buildings; see features, dates, trust labels, public history, approved photos and published reviews |
| **CONTRIBUTOR** (default after sign-up) | Visitor + submit reports and photos, edit or withdraw own open reports, write reviews, save buildings, manage own account |
| **MODERATOR** | Contributor + review queue, decide reports, resolve disputes, moderate reviews |
| **ADMIN** | Moderator + manage buildings and cover photos, users and roles, audit log, analytics |

Public registration can only create contributors. An administrator promotes users. The role is **read from the database on every request**, never from the token or the client.

## 6. API reference

All paths start with `/api/v1`. Endpoints marked "user" need `Authorization: Bearer <token>`. Full request and response shapes are in Swagger.

### Auth and account

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Create a contributor account |
| POST | `/auth/login` | public | Sign in, returns an access token |
| POST | `/auth/logout` | user | Invalidate the current token |
| GET | `/auth/me` | user | Current profile |
| PATCH | `/auth/profile` | user | Name, affiliation, phone, language, text size, contrast, reduced motion |
| POST | `/auth/change-password` | user | Needs the current password |
| POST | `/auth/forgot-password` | public | Always gives the same answer (no account guessing); emails a 1-hour link |
| POST | `/auth/reset-password` | public | Single-use token |
| POST | `/auth/resend-verification` | user | Send a new email-verification link |
| POST | `/auth/verify-email` | public | Confirm an email address (single-use token) |

### Buildings

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/buildings` | public | List with search, filters and pagination (see below) |
| GET | `/buildings/:id` | public | Building with all features, effective trust labels, rating and cover URL |
| GET | `/buildings/:id/features` | public | Features only |
| GET | `/buildings/:id/history` | public | Approved and superseded reports (no personal data). `?featureType=` |
| GET | `/buildings/:id/reviews` | public | Published reviews and rating summary. `?sort=recent|high|low` |
| GET | `/buildings/:id/cover` | public | Cover photo (404 if none) |
| POST | `/buildings` | admin | Create a building |
| PATCH | `/buildings/:id` | admin | Update a building |
| POST | `/buildings/:id/cover` | admin | Upload a cover photo (multipart field `file`) |
| DELETE | `/buildings/:id/cover` | admin | Remove the cover photo |

**List filters:** `search`, `category`, `features` (comma-separated, the building must have all of them), `featureStatus` (default `AVAILABLE`), `verification` (`VERIFIED`, `STALE`, `DISPUTED`, `UNVERIFIED`), `sortBy` (`name`, `createdAt`, `updatedAt`), `order`, `page`, `limit` (maximum 100).  
Example: `GET /buildings?features=LIFT,STEP_FREE_ENTRANCE&verification=VERIFIED`

### Reports and evidence

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/reports` | user | Submit an observation (starts as PENDING) |
| GET | `/reports/mine` | user | My reports with the latest decision. `?status=` |
| GET | `/reports/:id` | owner or staff | Report with its verification history |
| PATCH | `/reports/:id` | owner | Edit while PENDING or NEEDS_CLARIFICATION |
| POST | `/reports/:id/withdraw` | owner | Withdraw an open report |
| POST | `/reports/:id/evidence` | owner | Upload photos (multipart field `files`) |
| GET | `/reports/:id/evidence/:evidenceId/file` | public if approved, otherwise owner or staff | Download a photo |

### Reviews and saved buildings

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/buildings/:id/reviews` | user | Write a review (goes to moderation) |
| GET | `/reviews/mine` | user | My reviews. `?status=` |
| PATCH | `/reviews/:id` | owner | Revise a pending or refused review |
| DELETE | `/reviews/:id` | owner | Delete my review |
| GET | `/saved` | user | Saved buildings with details |
| GET | `/saved/ids` | user | Just the ids (to show which Save buttons are on) |
| PUT | `/saved/:buildingId` | user | Save a building (safe to repeat) |
| DELETE | `/saved/:buildingId` | user | Remove from saved |

### Moderation and administration

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/reports` | moderator, admin | Queue. `?status=` (`PENDING` by default, `ALL` for everything) |
| PATCH | `/admin/reports/:id/decision` | moderator, admin | `APPROVED`, `REJECTED` or `NEEDS_CLARIFICATION` (reason required for the last two) |
| GET | `/admin/disputes` | moderator, admin | Features whose approved reports disagree |
| POST | `/admin/features/:id/resolve-dispute` | moderator, admin | Choose the winning report |
| GET | `/admin/reviews` | moderator, admin | Review queue |
| PATCH | `/admin/reviews/:id/decision` | moderator, admin | Publish, or refuse with a note |
| GET | `/admin/analytics` | admin | Data-quality figures |
| GET | `/admin/users` | admin | List users. `?search=&role=` |
| PATCH | `/admin/users/:id/role` | admin | Change a role (not your own) |
| PATCH | `/admin/users/:id/status` | admin | Activate or deactivate (not your own) |
| GET | `/admin/audit-logs` | admin | Append-only audit trail |

### Response formats

- **Lists:** `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`
- **Errors:** `{ "statusCode", "error", "message", "path", "timestamp" }`

## 7. Business rules

- **A feature's status is never edited directly.** It is derived from moderator-approved reports.
- **Report states:** `PENDING` → `APPROVED`, `REJECTED` or `NEEDS_CLARIFICATION`. After the contributor edits, `NEEDS_CLARIFICATION` returns to `PENDING`. Open reports can be `WITHDRAWN`. An approved report that loses a dispute becomes `SUPERSEDED`. Approved reports can never be edited.
- **Trust label:** `Current` (approved and observed within `FRESHNESS_DAYS`), `Outdated` (approved but older, worked out when read), `Disputed` (approved reports within `CONFLICT_WINDOW_DAYS` of the newest one disagree), `Unknown` (no approved report).
- **Disputes:** a moderator picks the winning report. Conflicting reports with a different status become `SUPERSEDED` and stay in history.
- **Nobody moderates their own** report or review.
- **Moderation decisions** run inside one database transaction with row locks, so two moderators cannot decide the same report or overwrite each other.
- **History is append-only:** reports, verification decisions and audit entries are never silently overwritten.
- **Reviews are opinions.** They are moderated separately and never change a building's verified accessibility facts.

## 8. Security

- Passwords are hashed with **argon2id**. The hash is never returned by any endpoint. Sign-in gives the same error for an unknown email and a wrong password.
- **JWT** (HS256) with a unique id per token. Logging out blacklists the token in Redis until it expires. Deactivated accounts are rejected immediately.
- **Validation:** every body, query and path parameter is validated. Unknown fields are rejected, so a client cannot send `role: "ADMIN"` at registration.
- **Authorization** is enforced in the API with guards, plus ownership checks in services. Other people's reports return 404.
- **Rate limiting** with stricter limits on sign-in, registration and password reset.
- **Uploads:** JPEG, PNG and WebP only, size and count limits, the real file content is checked (not only the declared type), server-generated file names, stored outside any public folder. Photos of a pending report are private to the owner and staff.
- Reset and verification tokens are random, stored only as SHA-256 hashes, expire (1 h and 24 h) and work once.
- Security headers (helmet), CORS allow-list, request logging without bodies or headers, audit log without secrets.

## 9. Testing

```bash
pnpm test                       # unit tests (trust rules, file-type detection)
```

End-to-end tests start the real app against PostgreSQL and Redis and cover sign-up and login, roles, uploads, moderation, disputes and freshness. They use a **separate database** and refuse to run against any database whose name does not end in `_test`.

```bash
docker exec accesspath-postgres createdb -U postgres accesspath_test   # once
pnpm test:e2e
```

## 10. Project structure

```
backend/
├── src/
│   ├── main.ts, app.module.ts, app.setup.ts
│   ├── config/            environment validation, database options, CLI data source
│   ├── common/            guards, decorators, enums, error filter, pagination, utilities
│   ├── providers/         PostgreSQL and Redis (from the boilerplate)
│   ├── database/
│   │   ├── migrations/    InitSchema, AddAccountReviewsSaved, AddBuildingCover
│   │   └── seeders/       demo data
│   └── modules/
│       ├── auth/  users/  audit/  mail/
│       ├── buildings/     list, search, filters, cover photos
│       ├── features/      entity and the pure trust rules (feature-status.util.ts)
│       ├── reports/       submission, evidence upload, public history
│       ├── moderation/    queue, decisions, disputes, verification history
│       ├── reviews/  saved/  analytics/
├── test/                  end-to-end tests
├── docker-compose.dev.yml PostgreSQL + Redis for development
├── .env.example
└── package.json
```

**Database tables:** `users`, `buildings`, `accessibility_features`, `reports`, `report_evidence`, `verifications`, `reviews`, `saved_buildings`, `auth_tokens`, `audit_logs`. The schema is created only by migrations (`synchronize` is off). Use DBeaver to inspect it: host `localhost`, port `5432`, user `postgres`, password `postgres`, database `accesspath_dev`.

## 11. Deployment

1. Set the environment variables above on the host. At minimum: `NODE_ENV=production`, `JWT_BEARER_SECRET`, `COOKIE_SECRET`, `DB_*` (with `DB_SSL=true` for most hosted databases), `REDIS_*`, `FRONTEND_URL`.
2. `pnpm install --frozen-lockfile && pnpm build`
3. `pnpm migration:run:prod`
4. `pnpm start:prod`

Notes:

- **Photos are stored on disk** (`storage/evidence`, `storage/covers`). On hosts with a temporary disk they disappear on redeploy, so attach a persistent volume.
- Set `MAILER_*` to send real emails. Without it, links are only printed in the server log (never in production).
- **Rate limits and the proxy:** the web app calls this API from its own server, so all users appear to share one address. For a busy production deployment, forward the real client IP (`X-Forwarded-For`) and set `trust proxy` appropriately, or raise `THROTTLE_LIMIT` and `AUTH_THROTTLE_LIMIT`.
- The faculty `Dockerfile` and `docker-compose.yml` were left as provided (the compose file expects an external `app-network`). `docker-compose.dev.yml` is for local development only.

## 12. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| App exits at start with an `ENV` validation message | A required variable is missing or still a placeholder. Check `.env` against `.env.example` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running. Start the compose file or your local server |
| Redis connection errors | Redis is required. Start it (`docker compose -f docker-compose.dev.yml up -d`) |
| `relation "users" does not exist` | Run `pnpm migration:run` |
| `EADDRINUSE :5001` | Another process uses the port. Stop it or change `PORT` |
| Seeder says "already has users" | Use `pnpm seeder:refresh:dev` to wipe and re-seed |
| Many 429 errors during manual testing | Rate limit reached. Wait a minute or raise the limits in `.env` |
