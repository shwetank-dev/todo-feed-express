# Todo Feed Backend — Teaching Guide

You are acting as an instructor, not an autocomplete. Before doing anything in
this project, read `~/.claude/skills/instructor-skill/SKILL.md` (or invoke the
`instructor-skill` skill) and follow its teaching philosophy, per-phase
instruction pattern, pacing rules, and error-handling rules for every single
interaction in this repo. This file is the roadmap that skill walks the user
through — it does not repeat the teaching rules, only the content.

The user is building a todo-list app with a social activity feed
(follow lists, see completions, like/comment) on:

**Express + Drizzle (ORM) + Zod (validation) + Vitest (tests) + TypeScript.**

No auth for now — a hardcoded `userId` stands in for it everywhere. Dependency
injection (DI) is the spine of this whole roadmap: Postgres, and later the
realtime layer, must stay swappable and mockable. Every stage below has at
least one "DI checkpoint" — treat those as first-class teaching moments, not
asides.

Start at **Stage 0, Phase 0.1**. Never assume the user has read ahead in this
file. Never skip a phase because it looks small.

---

## Suggested folder shape (introduce as it becomes relevant, not upfront)

User's explicit call: organize by **feature module**, not by technical layer
(no MVC-style global `services/`/`routes/`/`schemas/` folders holding every
domain's files mixed together). Each domain owns one folder containing its
own schema, service, routes, and Zod validation together:

```
src/
  app.ts         # composition root: builds the Express app (no .listen())
  server.ts      # real entry point: builds app.ts with real deps, calls .listen()
  infra/         # external-system wiring, app-specific (not generic/reusable) —
    config.ts    # config.ts/db-client.ts/logger.ts/sentry.ts grouped here since
    db-client.ts # they all connect *this app* to something outside it (env,
    logger.ts    # postgres, pino, sentry). db-client.ts and logger.ts are
    sentry.ts    # factory-only + one singleton each, not DI'd — see Stage 1.6.
  errors/        # internal error-handling convention, not external wiring —
    app-error.ts     # AppError base + NotFoundError/UnauthenticatedError/
    error-handler.ts # ConflictError/ValidationError; error-handler.ts is the
                     # one central Express error middleware, depends on
                     # app-error.ts and nothing else uses either file directly.
  lib/           # generic, reusable helpers with zero domain knowledge and
    pagination.ts # zero external I/O (not infra, not a domain module) —
                  # three exports (Stage 2.1b): createPaginatedResponseSchema
                  # (item) → { items, nextCursor } (cursor-based, not
                  # page/pageSize/total — cheaper, no count query needed);
                  # createPaginationQuerySchema(defaultLimit?) → validates the
                  # { cursor?, limit } query params a paginated GET route
                  # accepts; and paginateRows(rows, limit) → the shared
                  # "fetch limit+1, slice, take the last row's id as
                  # nextCursor" logic every cursor-paginated service query
                  # needs (first used by todos.service.ts's
                  # getListsByOwner, added when GET /api/lists was wired up
                  # — the query construction itself stays in each service,
                  # since that part IS DB/table-specific, only the generic
                  # post-processing moved here). Used by any module's
                  # validation.ts/service.ts. Deliberately NOT a place for
                  # domain-specific schemas — that's still the "no global
                  # schemas folder" rule from above; lib/ only
                  # holds helpers with no knowledge of any specific entity.
    validate-request.ts # getValidatedBody(req, schema) / getValidatedQuery
                  # (req, schema) (Phase 2.2) — NOT middleware. Each does
                  # runtime validation (schema.safeParse, throws
                  # ValidationError on failure) AND returns the compile-time
                  # `z.infer<T>`-typed result in one call — called directly
                  # at the top of a handler, e.g.
                  # `const { name } = getValidatedBody(req, createListSchema);`.
                  # User's explicit call, after weighing a middleware-based
                  # `validateBody`/`validateQuery` approach (rejected):
                  # middleware can validate `req.body`/`req.query` at
                  # runtime, but can't propagate a narrowed TYPE into a
                  # separately-defined handler function — Express's own
                  # `req.body`/`req.query` types don't know a validator ran
                  # earlier in the chain (this is *not* a problem for
                  # `req.body` specifically, only because Express types it
                  # as bare `any` — an absence of type-checking, not real
                  # propagated safety). Doing both steps in one function
                  # call sidesteps that entirely: `schema` is used at
                  # runtime (`schema.safeParse(...)`) and also drives the
                  # generic `T`, so `z.infer<T>` gives back the real
                  # inferred type directly — no assertion function or
                  # explicit `Request<...>` annotation needed on the
                  # handler's signature.
    assert-param.ts # assertParam(req, name) — a TypeScript assertion
                  # function (`asserts req is Request<Record<K, string>>`,
                  # generic over the literal param name K so calling
                  # `assertParam(req, "id")` narrows specifically
                  # `req.params.id`, not just some arbitrary string key) —
                  # throws a plain Error (not an AppError) if the param is
                  # missing, since that means the route pattern itself is
                  # wrong (a programmer bug caught at the trust boundary, not
                  # a user-facing 4xx) — replaces `req.params.id as string`
                  # casts; call once at the top of a handler
                  # (`assertParam(req, "id");`), then every `req.params.id`
                  # reference after that is narrowed to plain `string`.
                  # Deliberately does NOT validate the param is a
                  # well-formed UUID (e.g. reject `/lists/foo`) — user's
                  # explicit call: a malformed ID should 404 like any other
                  # nonexistent resource, not 400, matching the existing
                  # rule that this app never distinguishes "doesn't exist"
                  # from "malformed" to avoid leaking which case it is.
  modules/
    users/
      schema.ts    # Drizzle table(s) for this domain
      service.ts   # business logic, depends on db/logger via params
      routes.ts    # thin Express routes, call the service
      validation.ts # Zod input schemas for this module's routes (Stage 2+)
      dto.ts       # Zod output/response schemas (Stage 2.1b) — split out
                   # from validation.ts once it became clear input and
                   # output are different concerns (validation.ts = what do
                   # I reject, dto.ts = what do I shape for the client),
                   # user's explicit call after weighing keeping them
                   # combined. A module only gets the file it needs — users
                   # has dto.ts (userResponseSchema) but no validation.ts
                   # yet, since there's no users-owned input route.
    todos/
      schema.ts    # todo_lists + todos tables
      service.ts   # TodoService
      routes.ts
      validation.ts
      dto.ts
    feed/
      schema.ts    # follows, activities, likes, comments (Stage 3)
      service.ts
      routes.ts
      validation.ts
      dto.ts
  realtime/        # RealtimeAdapter interface + SocketAdapter + FirestoreAdapter
                    # (Stage 4) — cross-cutting infra used by multiple modules,
                    # not owned by a single domain, so it stays its own
                    # top-level folder rather than living under modules/
tests/
  modules/
    todos/
      service.test.ts
    feed/
      service.test.ts
```

Don't dump this tree on the user in Stage 0. Reveal each directory (and each
module folder) the phase that first needs it — e.g. `modules/todos/` gets
created in Phase 1.1, `modules/todos/validation.ts` in Phase 2.1,
`modules/feed/` in Phase 3.1.

---

## Stage 0 — Hello world + DB connection ✅ DONE

Motivation: prove the whole pipeline (code → deployed URL → real DB) works
before any real logic exists. Skipping this means debugging deploy issues and
business-logic bugs at the same time later — worse for learning either one.

Actual state (deviations from the plan below, for context in future
sessions): the DB composition root ended up at `src/db-client.ts` (flat at
`src/` root, not `src/db/db.ts` — singular composition-root files like
`db-client.ts`/`config.ts`/`logger.ts` stay flat; folders are reserved for
things expected to multiply, like feature modules). `/health` and
`/health/db` were deliberately merged into one `GET /health` route
returning `{ server, db }` (user's call, understood the diagnostic
trade-off of not being able to isolate HTTP-layer-vs-DB failures). Deploy
target used: **Render** (Postgres + web service both on Render). Extra
tooling added beyond the base roadmap, not roadmap-required but now part of
the project: **Biome** (lint/format, `biome.json`), **Husky** pre-commit hook
(`lint:fix` + `git add -A` + `typecheck`), **Zod-validated `config.ts`**
(fails fast via `logger.fatal` + `process.exit(1)` on bad env vars — built
deliberately as a plain factory, no interface wrapper, since nothing needs to
substitute it yet), **Pino logger** (`src/logger.ts`, plain factory export,
no `Logger` interface — same reasoning, add the abstraction when a real
call site needs it), and a compiled-JS deploy path (`tsc && tsc-alias` for
build, `node dist/server.js` for start — chosen over running `tsx` directly
in production).

Dev/prod DB split: two separate databases on the **same** Render Postgres
instance (not two instances) — `todolist_feed` (prod, used by the deployed
Render web service) and `todolist_feed_dev` (local dev, used by `.env`).
Created via `CREATE DATABASE todolist_feed_dev;` in `psql`. Local schema
work/migrations should always run against `_dev`, never prod, until a
change is deliberately ready to ship.

### Phase 0.1 — Project scaffold ✅ DONE
- Problem: nothing exists yet; TypeScript + Express need wiring before any
  route can run.
- Task: `npm init`, TypeScript config, a minimal Express app that starts and
  listens on a port.
- Completion: `npm run dev` (or equivalent) starts the server with no errors.

### Phase 0.2 — `GET /health` ✅ DONE (merged with 0.5, see note above)
- Problem: need the smallest possible proof the HTTP layer works.
- Task: one route, `GET /health` → `{ status: "ok" }`.
- Completion: hitting the route locally (curl/browser) returns that JSON.

### Phase 0.3 — Drizzle + Postgres ✅ DONE
- Problem: need a real database, not a toy — but standing up Postgres
  yourself is a distraction from the actual lesson.
- Concept: point the user at **Neon** or **Supabase** (free Postgres,
  connection string in minutes) so they avoid managing a DB server.
- Task: install Drizzle, configure it against the connection string, define
  one trivial table just to prove connectivity (a `SELECT 1` style check).
- Completion: Drizzle can connect and run a query against the real DB.

### Phase 0.4 — `db.ts` composition root (DI checkpoint) ✅ DONE
- Problem: if every file that needs the DB creates its own client, tests
  can't substitute a fake one, and you get connection-pool sprawl.
- Concept: the Drizzle instance is created **once**, in `src/db/db.ts`, and
  passed into anything that needs it as a parameter — never imported and
  instantiated fresh inside a handler. This is the first composition root.
- Task: create `src/db/db.ts` exporting a single configured Drizzle client.
- Check question: "if two different route handlers both `import { db }` from
  this file, are they sharing one client or creating two?" — make sure the
  answer is "sharing," and that the user can explain why that matters for
  testing later.
- Completion: exactly one place in the codebase constructs the Drizzle
  client.

### Phase 0.5 — `GET /health/db` ✅ DONE (merged into single `/health` route)
- Task: a route that takes the `db` from Phase 0.4 as a dependency and runs
  a real query, returning success/failure.
- Completion: `/health/db` returns success against the live DB.

### Phase 0.6 — Deploy ✅ DONE (deployed to Render)
- Concept: point the user at **Railway** or **Render** — push a Node repo,
  get a URL, minimal config. The DB connection string becomes an environment
  variable there, not a hardcoded value.
- Completion (Stage 0 done when): the user hits their **deployed** URL —
  not localhost — from their phone browser, and both `/health` and
  `/health/db` return success.

Offer a Stage 0 summary (per the instructor skill's summary format) before
moving to Stage 1. Ask first; don't assume.

---

## Stage 1 — Core schema + CRUD API endpoints

Motivation: this is the first real business logic, and the first place the
DI discipline from Stage 0 gets tested against actual services and actual
tests.

### Phase 1.1 — Schema ✅ DONE
- Task: Drizzle schema for `users` (id, name — no password) in
  `src/modules/users/schema.ts`, and `todo_lists` (id, owner_id, name) +
  `todos` (id, list_id, text, done) in `src/modules/todos/schema.ts`.
- Completion: schema migrates cleanly against the DB from Stage 0.
- Actual state: filenames are `<module>.db-schema.ts` (not `schema.ts` —
  see folder shape at top of file). All `id` columns are
  `uuid().defaultRandom()`, not integer identity (deliberate — user-facing
  IDs like `GET /users/:id/feed` shouldn't be sequential/guessable).
  `todo_lists.owner_id` and `todos.list_id` both have explicit indexes
  (Drizzle/Postgres don't auto-index FK columns, unlike Prisma — had to add
  `index(...)` manually). Client-wide `casing: "snake_case"` is set in both
  `db-client.ts` and `drizzle.config.ts`, so schema files use bare
  `uuid()`/`text()`/`boolean()` with no explicit column-name strings —
  Drizzle derives `owner_id`/`list_id`/etc. from the camelCase JS property
  names automatically. Cross-module FK: `todos.db-schema.ts` imports
  `users` from `modules/users/` (one-directional — `users` never imports
  from `todos`; that direction is a deliberate rule, not accidental).
  Migrations applied and confirmed against the dev DB
  (`todolist_feed_dev`). Old throwaway `ping` table and `src/db/schema.ts`
  removed.

### Phase 1.2 — Services with DI ✅ DONE
- Problem: if route handlers talk to Drizzle directly, business logic and
  HTTP concerns tangle together, and nothing is mockable in tests.
- Concept: each route handler depends on a `service` (e.g. `TodoService`),
  and each service depends on the `db` client via constructor/function
  parameter — never a bare import of the Drizzle instance inside business
  logic.
- Task: build `TodoService` (and similar) in `src/modules/todos/service.ts`
  (and `src/modules/users/service.ts` if needed), taking `db` as a
  parameter.
- Completion: no service file imports `db` directly from `db.ts` — it's
  always passed in.
- Actual state: `createTodoService(dbClient)` in
  `src/modules/todos/todos.service.ts`, `DbClient` type exported from
  `db-client.ts` itself (`ReturnType<typeof createDbClient>`) — single
  source of truth for the type, not re-derived per service file. Six
  operations built: `createList`, `getListById`, `getListsByOwner`,
  `addTodo`, `toggleTodo`, `deleteTodo`. `toggleTodo` flips `done` inside
  the SQL itself (`sql\`not ${todos.done}\``) rather than reading then
  writing back — avoids a race condition between concurrent toggles. No
  `users.service.ts` yet — not needed until routes actually require it.

### Phase 1.3 — Vitest starts here
- Concept: this is the payoff of the DI discipline — because services take
  `db` as a parameter, Vitest can inject an in-memory or test-DB instance and
  assert on behavior, with no HTTP layer involved.
- Task: write service-layer tests first, in `tests/modules/todos/`, before
  writing route tests (or instead of them, for now).
- Completion: a handful of passing Vitest tests exercise `TodoService`
  directly, with a test DB injected — not the production one.
- **User's explicit call: route-level integration tests via `supertest`
  instead of (not in addition to, for now) direct service-layer unit
  tests.** Real HTTP requests hit real Express routes, which hit real
  services, which hit a real test database — no mocking of Drizzle or the
  service layer. This is still exercising the same DI wiring (the test DB
  is injected via the same `createDbClient` factory as prod/dev), just
  proven through the HTTP layer rather than by calling service functions
  directly.
- **Consequence of that choice**: routes must exist before they can be
  tested, so build Stage 1.4 (and Stage 1.5's auth) *before* writing these
  tests — the actual execution order deviates from this file's phase
  numbering here, and that's fine, don't force strict numeric order over
  what the user's testing strategy actually requires.
- **Consequence of that choice, part 2**: `server.ts` needs restructuring
  so the Express `app` is buildable/exportable separately from the
  `.listen()` call — `supertest` makes in-memory requests directly against
  an `app` object, no real port needed. Only the real entry point should
  call `.listen()`; tests import the app-building function directly.
- **Test data strategy — decide and document this, don't wing it per
  test file:**
  - **Separate test database**, same pattern as the existing dev/prod
    split (e.g. `todolist_feed_test` on the same Render instance),
    migrated the same way. Tests must never run against `_dev` or prod.
  - **Isolation between tests** — pick one deliberately, don't let it be
    accidental:
    - *Truncate all tables in `beforeEach`/`afterEach`* — simplest to wire
      for route-level tests going through the full app stack (the app's
      `dbClient` is built once at module load, not per-test, so a
      per-test-transaction approach is awkward here unless the whole
      request pipeline is made to run inside one transaction per test).
    - *Transaction-per-test with rollback* — cleaner/more robust in
      principle (nothing ever actually commits), but harder to wire
      through a full HTTP-request stack than through direct service calls,
      since every layer (route → service → dbClient) needs to share the
      same transaction for the duration of one test. Worth attempting only
      if truncate-based isolation becomes a real pain point later — don't
      reach for this upfront.
  - **Seeding strategy** — how does a test get a real user to own a list?
    - *Through the real API* (register via `POST /auth/register`, use the
      returned token) — more genuinely "integration," couples every test's
      setup to auth/registration working correctly, slower.
    - *Direct DB insert bypassing the API* — faster, more isolated from
      unrelated auth bugs, but not exercising real registration behavior
      as part of setup.
    - Pick one per test file based on what that file is actually trying to
      prove — a test *of* `/auth/register` itself obviously must go
      through the real API; a test of `POST /lists` probably shouldn't
      also be silently testing registration as a side effect.

### Phase 1.4 — Routes
- Task: thin routes in `src/modules/todos/routes.ts` and
  `src/modules/users/routes.ts` that call into services — `POST /lists`,
  `GET /lists/:id`, `GET /users/:id/lists`, `POST /lists/:id/todos`,
  `PATCH /todos/:id` (toggle done), `DELETE /todos/:id`. Auth doesn't exist
  yet at this point (that's Stage 1.5, next) — `userId` comes from a request
  field/header for now, same as the rest of this roadmap until 1.5 lands.
  `server.ts` (the composition root) mounts each module's router.
- Note: all of the routes listed above are todos-domain operations (even
  `GET /users/:id/lists` — it calls `todoService.getListsByOwner`, not
  anything user-specific), so `users.routes.ts` is minimal at this point:
  just whatever plain user-data endpoints are needed (e.g. `GET /users/:id`)
  — user *creation* happens via Stage 1.5's `POST /auth/register`, not a
  bare `POST /users`, since auth is being built immediately after this
  phase rather than deferred.
- Completion (Stage 1 done when): you can create a list, add todos, toggle
  them, and see it persist across server restarts — verified both by manual
  requests and by the Vitest service tests from 1.3.
- Extra hardening added beyond the base roadmap, not roadmap-required but
  now part of the project: **`helmet`** (sets standard security-related
  response headers — HSTS, `X-Content-Type-Options`, clickjacking
  protection, removes the `X-Powered-By` header — wired into the
  composition root in `app.ts`, ahead of all routes) and a catch-all
  **404 handler** (`app.use((_req, res) => res.status(404).json(...))`,
  the very last middleware in `app.ts`, so it only fires for requests
  nothing else matched).
- Actual state (routes were reshaped after this phase, during Stage 1.6's
  work — documented here since this is where routes live conceptually):
  routes moved under `/api/*` prefixes, each router owning its own path
  space so `requireAuth` (applied via `router.use(requireAuth)` per router)
  can never leak onto a route it wasn't meant for regardless of mount
  order — this replaced an earlier version where `/health` briefly got
  shadowed by `requireAuth` because everything was mounted at bare `/`.
  Final shape: `/api/auth/*` (register, login, `/me`), `/api/lists`
  (`POST /`, `GET /` — the caller's own lists, no `:id` needed since it can
  only ever be the caller's own `userId`, `GET /:id`, `POST /:id/todos`),
  `/api/todos/:id` (`PATCH` toggle, `DELETE`) — todos addressed flatly by
  their own ID, not nested under their list. The originally-planned
  `GET /users/:id/lists` was dropped entirely in favor of `GET /api/lists`
  for this reason. `/health` stays unprefixed, outside `/api`.

Offer a Stage 1 summary before moving on.

---

## Stage 1.5 — Lightweight auth (access token only, user opt-in)

User's explicit call, against the roadmap's original default: real auth is
being added now, right after Stage 1, rather than deferred to the end.
Scope is deliberately minimal — **access token only, no refresh token, no
token rotation, no revocation list**. When a token expires, the user just
logs in again. If implementation starts reaching for refresh-token
machinery, that's scope creep — stop and flag it, don't build it.

### Phase 1.5.1 — Password on the users schema
- Task: add a `passwordHash` column to `users` (`src/modules/users/schema.ts`).
- Concept: never store plaintext passwords — hash at write time (e.g.
  bcrypt/argon2), compare hashes at login time, never compare raw strings.
- Completion: schema migrates cleanly; a user can be created with a hashed
  password, and the plaintext password is never persisted anywhere.

### Phase 1.5.2 — `auth` module
- Task: new `src/modules/auth/service.ts` (register: hash + create user;
  login: look up user, compare password hash) and
  `src/modules/auth/routes.ts` (`POST /auth/register`, `POST /auth/login`,
  and `GET /auth/me` — returns the authenticated user for the current
  token; lives in `auth`, not `users`, because resolving identity from a
  token is an auth concern, not a user-data concern, and it avoids the
  Express routing-order gotcha `GET /users/me` would have against
  `GET /users/:id`).
- Concept: `auth` depends on `users` (to create/look up user records) —
  one-directional, same cross-module rule as `todos` depending on `users`.
  `users` never imports from `auth`. No `POST /auth/logout` — with
  access-token-only, no-refresh, no-revocation-list auth, there's no
  server-side session to invalidate; "logout" is just the client
  discarding the token.
- Completion: `POST /auth/register` creates a user with a hashed password;
  `POST /auth/login` with correct credentials succeeds, wrong credentials
  return 401; `GET /auth/me` with a valid token returns that user, with no
  token returns 401.

### Phase 1.5.3 — Issue a signed access token
- Concept: on successful login, issue one signed access token (e.g. JWT)
  with an expiry, and nothing else — no refresh token, no rotation. The
  signing secret is a new Zod-validated env var in `config.ts`
  (e.g. `JWT_SECRET`), same fail-fast pattern as `DATABASE_URL`.
- Task: sign the token in `auth/service.ts` on login; set a reasonable
  expiry (e.g. 1h–24h).
- Completion: a valid token round-trips (sign → verify) correctly; a
  tampered or expired token fails verification.

### Phase 1.5.4 — `requireAuth` middleware (DI checkpoint)
- Problem: without shared middleware, every route re-implements token
  verification by hand.
- Concept: `requireAuth` middleware verifies the token from the
  `Authorization` header, attaches the resolved `userId` to `req`, and
  rejects with 401 if the token is missing/invalid/expired — same
  "shared, parameterized behavior" principle as Stage 2's `validateBody`.
- Task: implement `requireAuth` (likely living alongside `auth/`, e.g.
  `src/modules/auth/middleware.ts`), wire it in front of the routes from
  Stage 1 that currently take `userId` from a request field/header.
- Completion: hitting a protected route with no/bad token returns 401; with
  a valid token, the route handler gets `userId` from `req`, not from
  anything client-supplied.

### Phase 1.5.5 — Retire the manual `userId`
- Task: update every Stage 1 route to read `userId` from what `requireAuth`
  attached to `req`, instead of a request body/header field.
- Completion (Stage 1.5 done when): every mutating route from Stage 1 is
  behind `requireAuth`, and `userId` is never taken from client-supplied
  input anywhere in the codebase again.
- Actual state (added during Stage 2, revisited here since it's this
  phase's concern): route handlers originally read `req.userId as string`
  — a type-level lie, since `userId?: string` is genuinely optional in the
  `Express.Request` augmentation and TS can't know `requireAuth` ran first.
  Replaced with `assertUserId(req)`, added alongside `requireAuth` in
  `auth.middleware.ts` — a TypeScript **assertion function**
  (`asserts req is Request & { userId: string }`), not a value-returning
  helper. Called once at the top of a handler (`assertUserId(req);`), it
  throws `UnauthenticatedError` if `req.userId` is missing, and afterward
  every `req.userId` reference in that function is narrowed to plain
  `string` by TS's control-flow analysis — no `getUserId(req)` call
  needed at each use site, no cast. Same trust-boundary reasoning as
  before (fail loud instead of silently coercing `undefined`), just a
  different mechanism for surfacing the narrowed type to the rest of the
  function. See `lib/assert-param.ts` below for the equivalent treatment
  of `req.params`.

Offer a Stage 1.5 summary before moving on to Stage 2.

---

## Stage 1.6 — Error tracking (Sentry)

Motivation: once Stage 1's CRUD routes are live, there's real surface area
for production bugs beyond a health check — Sentry gives visibility into
those without hand-checking logs. Not worth adding earlier; there's nothing
meaningful to monitor before real routes exist.

### Phase 1.6.1 — Install & init ✅ DONE
- Task: install `@sentry/node`; call `Sentry.init(...)` at the very top of
  `server.ts`, before anything else — same composition-root instinct as
  `config.ts`/`logger.ts`. DSN comes from a new Zod-validated env var in
  `config.ts` (e.g. `SENTRY_DSN`), not hardcoded.
- Completion: a deliberately thrown test error shows up in the Sentry
  dashboard.
- Actual state: `Sentry.init(...)` lives in its own `src/infra/sentry.ts`
  (`initSentry(config)`), not inline in `server.ts` — kept `server.ts` from
  accumulating unrelated setup code. `SENTRY_DSN` is `.optional()` in
  `configSchema` (not required like `DATABASE_URL`/`JWT_SECRET`) — a
  missing DSN is a safe no-op (Sentry's SDK just doesn't send anything),
  unlike the other fields where a missing value means the app genuinely
  can't function; this means no Sentry account is needed to keep
  developing locally. Verified via a temporary `GET /debug-sentry` route
  that threw a test error, confirmed in the dashboard, then removed.

### Phase 1.6.2 — Environment + sampling ✅ DONE
- Task: pass `environment: config.ENVIRONMENT` into `Sentry.init(...)`, and
  set a conservative `tracesSampleRate` for production (not `1.0` — that's
  expensive/noisy at real traffic volume).
- Completion: dev errors and prod errors are distinguishable in Sentry via
  the environment tag.
- Actual state: `tracesSampleRate` is `0.1` in production, `1.0` everywhere
  else (no real traffic to worry about outside prod).

### Phase 1.6.3 — Scrub sensitive data ✅ DONE
- Task: use Sentry's `beforeSend` hook to strip passwords, tokens, and the
  DB connection string out of captured request/error data before it's sent.
- Completion: a manually triggered error containing a fake secret in its
  payload does not show that secret in the Sentry dashboard.
- Actual state: `beforeSend` redacts a `password` field on `event.request.data`,
  the `Authorization` header, and does a literal string-replace of
  `config.DATABASE_URL` across the whole serialized event (catches the
  connection string if it ever surfaces inside an error message, e.g. a
  raw Postgres connection error).

### Phase 1.6.4 — Operational vs unexpected errors (design checkpoint) ✅ DONE
- Concept: not every error is a bug. A 400 from bad input (Stage 2's
  `validateBody`) or a 401 from `requireAuth` is expected, user-facing
  behavior — reporting those to Sentry as "errors" is just noise. This is
  the concrete motivating case for a small `AppError`/`OperationalError`
  class hierarchy (deferred earlier in the roadmap for being premature —
  it's not premature anymore once Sentry exists to feed).
- Task: distinguish operational errors from unexpected exceptions in the
  app's error-handling middleware; only call `Sentry.captureException` for
  the unexpected ones.
- Completion: a validation 400 does not create a Sentry event; a genuinely
  unhandled exception does.
- Actual state, built out further than the roadmap's original sketch:
  `src/errors/app-error.ts` has `AppError` (base: `statusCode`, `code`,
  `message` — `code` is a stable, language-agnostic string a frontend can
  switch on for i18n, distinct from `message`, which is a human-readable
  fallback/log detail only) plus `NotFoundError` (404),
  `UnauthenticatedError` (401 — named for what it actually means per HTTP
  semantics, not "Unauthorized"; there's no `ForbiddenError`/403 in this
  app since the one case that would map to it — hitting another user's
  list/todo — deliberately returns 404 instead, to avoid leaking existence
  to an unauthorized caller), `ConflictError` (409, `code` passed in
  per-instance since many distinct conflicts can share one status),
  and `ValidationError` (400, fixed `code: "VALIDATION_ERROR"`, required
  `issues: {path, message}[]` — shaped to closely match Zod's own issue
  format, for Stage 2). `src/errors/error-handler.ts` is the one central
  Express error-handling middleware (last in the chain in `app.ts`):
  `AppError` → its own status/code/message (+ `issues` if present);
  anything else → `logger.error(...)` + generic `500`.
  All call sites migrated to throw these instead of building responses
  inline (`auth.service.ts`, `requireAuth`, `auth.routes.ts`,
  `todos.routes.ts`).
- Further deviation: Sentry reporting is routed **through the logger**,
  not via `Sentry.setupExpressErrorHandler(app)` (which was removed after
  adding this, to avoid double-reporting the same error via two paths).
  `src/infra/logger.ts` exposes only `info`/`warn`/`error`/`fatal` (hides
  Pino's full API — no child loggers, no `trace`/`debug`, no string-only
  overload; `payload` and `message` both required), and its `error`/
  `fatal` internally call `reportError` from `src/infra/sentry.ts`
  (`Sentry.captureException` if `payload.error instanceof Error`, else
  `Sentry.captureMessage`). This is the one, single path anything takes to
  reach Sentry now. `logger.ts` and `db-client.ts` are deliberately
  **not** DI'd (unlike `dbClient`, which genuinely needs swapping between
  dev/test/prod) — `logger` is a conventional bare-imported singleton,
  matching how most plain-Express (non-DI-framework) codebases treat
  logging; `db-client.ts` lost its own singleton export and is
  factory-only now (`createDbClient`), since nothing bare-imports a
  pre-built `dbClient` anymore — `server.ts` and `tests/setup.ts` each
  construct their own.
  Fixed a circular import this created (`config.ts` → `logger.ts` →
  `sentry.ts` → `config.ts`): `config.ts`'s own bootstrap-failure path
  uses plain `console.error` instead of the logger (a config validator
  shouldn't depend on infra that itself depends on that same config), and
  `initSentry` takes `config` as a parameter instead of importing it.

### Phase 1.6.5 — Middleware ordering, releases, source maps — DEFERRED
- Task: wire Sentry's request handler early in the Express middleware
  chain, and its error handler after all routes but before your own final
  error-handling middleware. Tag each deploy with a release
  version/commit SHA. Upload source maps as part of the `tsc`/`tsc-alias`
  build step so stack traces show original TypeScript lines, not compiled
  JS.
- Completion (Stage 1.6 done when): a deployed error shows the correct
  original TypeScript file/line in Sentry, tagged with the correct release.
- **Deliberately skipped, not an oversight**: user's explicit call — this
  build is a straightforward `tsc` transpile, not a minified/bundled
  frontend build, so compiled `dist/*.js` stays close in structure to the
  source; the readability payoff of source maps is much smaller here than
  the setup cost (Sentry CLI, auth tokens, a build-step integration).
  Revisit only if Sentry stack traces become genuinely hard to read in
  practice. Release/commit-SHA tagging also not done. The middleware-
  ordering part is moot — there's no `Sentry.setupExpressErrorHandler`
  anymore (see 1.6.4's note on routing Sentry through the logger instead).

Stage 1.6 considered done (1.6.1–1.6.4 complete, 1.6.5 deliberately
deferred). Move on to Stage 2.

---

## Stage 2 — Shared schemas (Zod)

Motivation: this is the glue layer between the DB shape, API validation, and
(eventually) a client's expectations — one contract instead of three
independently-drifting definitions.

User's explicit call: **both input and output schemas are part of the
contract**, not just request-body validation. A route's response shape is
just as much a source of drift (service returns an extra field, or drops
one, and nothing catches it) as its input. This also means Stage 2.5's
generated OpenAPI docs describe both directions, not just request bodies.

Further deviation, decided once output schemas were actually being built
(not upfront): input and output schemas live in **separate files per
module** — `validation.ts` (input + query schemas, what a route rejects)
and `dto.ts` (output/response schemas, what a route shapes for the
client) — rather than both in `validation.ts` as originally sketched
below. Reasoning: they're different concerns even though both are Zod,
and combining them risked `validation.ts` becoming a junk drawer as
modules grow (Stage 3's `feed` module especially). A module only gets the
file it actually needs — e.g. `users` has `dto.ts` (`userResponseSchema`)
but no `validation.ts`, since there's no users-owned input route yet.

### Phase 2.1 — Input schemas
- Task: Zod schemas for each entity's input shape (e.g. `CreateTodoInput`,
  `UpdateTodoInput`) in that module's `validation.ts` (e.g.
  `src/modules/todos/validation.ts`) — colocated with the module, not in a
  global schemas folder — that validate incoming request bodies.
- Completion: a schema exists for every mutating route from Stage 1.

### Phase 2.1b — Output schemas
- Problem: without a schema for what a route *returns*, the response shape
  can silently drift from what the DB/service actually produces (an extra
  internal field leaks out, a renamed column breaks a client silently) —
  nothing catches it the way input validation catches bad requests.
- Task: Zod schemas for each entity's output shape (e.g. `TodoResponse`,
  `ListResponse`) in that module's `dto.ts` (see file-split note above),
  for every route that returns a body (not just mutating ones — `GET`
  routes need these too).
- Check question: "should the output schema ever be the exact same object
  as the input schema? what fields typically differ (e.g. server-generated
  `id`, `createdAt`) and why shouldn't a client be able to send those in a
  request body?"
- Completion: a schema exists describing the response shape of every route
  that returns JSON, including `GET` routes.
- Actual state: enforced at runtime, not just typed — every route calls
  `theResponseSchema.parse(data)` immediately before `res.json(...)`, e.g.
  `res.json(userResponseSchema.parse(user))` in `auth.routes.ts`. This
  replaced the earlier ad hoc `const { passwordHash, ...safeUser } = user;`
  destructuring, which only worked because someone remembered to write it
  at each call site — `userResponseSchema.parse(user)` makes leaking
  `passwordHash` structurally impossible instead of dependent on memory,
  since Zod strips any key not declared in the schema. Deliberately
  *unlike* `errorResponseSchema` (Phase 1.6.4/`errors/error-response.schema.ts`)
  — that one is compile-time-only, no runtime `.parse()`, because
  `error-handler.ts` is the last line of defense with no further
  middleware to catch a thrown `ZodError`. Ordinary routes don't have that
  problem: a shape mismatch there is a genuine bug, and it correctly falls
  through to `error-handler.ts`'s existing "unhandled error → 500 + Sentry"
  path, same as any other unexpected exception.

### Phase 2.2 — `validateBody` middleware (DI checkpoint)
- Problem: without a shared middleware, every route re-implements its own
  ad hoc validation and error shape.
- Concept: `validateBody(schema)` — the schema is a parameter, not
  hardcoded inside the middleware. Same "inject what varies" principle as
  Stage 0/1.
- Task: implement the middleware, wire it in front of the relevant routes
  (e.g. `validateBody(createTodoSchema)`).
- Completion: sending a malformed request (missing field, wrong type) to any
  route returns a clean 400 with a useful message.

### Phase 2.3 — Types from schemas
- Concept: infer TypeScript types **from** the Zod schemas
  (`z.infer<typeof X>`) rather than writing separate interfaces.
- Check question: "what happens to your TS types if you change a Zod
  schema's field, versus if you'd written a separate interface by hand?"
- Completion: service-layer types come from the same Zod schemas the
  validation uses — no parallel interface definitions.

### Phase 2.4 — Keep validation schemas import-friendly
- Concept: per the user's modules-based structure, `validation.ts` schemas
  live colocated inside each module (`src/modules/todos/validation.ts`), not
  in a global `schemas/`/`shared/` folder — but they should still be
  self-contained exports with no server-only dependencies, so a client app
  could eventually import them directly (same validation rules on both
  sides, no duplication). Not required to build a client now, just don't
  paint yourself into a server-only corner.
- Completion (Stage 2 done when): both 2.2's and 2.3's completion criteria
  hold, and every module's `validation.ts` has zero imports from that
  module's `service.ts`/`routes.ts`/`schema.ts` (DB-specific code) — so it
  could be lifted out and shared with a client untouched.

Offer a Stage 2 summary before moving on.

---

## Stage 2.5 — API docs (Swagger/OpenAPI)

Motivation: Stage 2 already produced a single source of truth (Zod schemas)
for validation and types — generating API docs from those same schemas
avoids a third, independently-drifting definition (hand-written docs rot
the moment someone changes a schema and forgets to update them).

### Phase 2.5.1 — Generate an OpenAPI spec from Zod
- Task: derive an OpenAPI document from each module's `validation.ts`
  schemas — don't hand-write a separate spec. Use a Zod-to-OpenAPI tool
  (e.g. `zod-to-openapi`, or Zod v4's built-in `z.toJSONSchema()`) as the
  bridge.
- Completion: an OpenAPI JSON/YAML document exists, generated from the
  existing validation schemas, describing every route's input shape
  (request body) **and** output shape (response body) — both directions
  of the contract from Phase 2.1/2.1b.

### Phase 2.5.2 — Serve interactive docs
- Task: mount `swagger-ui-express` (or similar) at a route like `GET /docs`,
  serving the generated spec.
- Completion: hitting `/docs` on the deployed app shows an interactive,
  browsable API reference.

### Phase 2.5.3 — Keep it honest
- Check question: "what happens to `/docs` if you change a Zod schema's
  field, versus if you'd hand-written a separate OpenAPI YAML file?" (same
  shape as Stage 2.3's check question about types — same payoff).
- Completion (Stage 2.5 done when): every mutating route from Stage 1/1.5
  appears in `/docs`, generated — not hand-written — from the same Zod
  schemas used for real request validation.

Offer a Stage 2.5 summary before moving on.

---

## Stage 3 — Follows, activities, and the feed

Motivation: this is the actual "social" feature — but deliberately without
realtime yet, so the feed's correctness can be verified independently of any
push mechanism.

### Phase 3.1 — Schema
- Task: new `src/modules/feed/schema.ts` with `follows` (user_id → list_id),
  `activities` (what happened: todo completed, list created, etc.), `likes`,
  `comments`.

### Phase 3.2 — Follow/unfollow
- Task: `POST /lists/:id/follow`, `DELETE /lists/:id/follow`.

### Phase 3.3 — Activity generation
- Concept: when a todo is marked complete, insert an `activity` row in the
  *same service call* — no realtime push yet, just the DB record. This
  keeps "did the right thing happen" separable from "did it get pushed live."
- Completion: completing a todo produces a corresponding `activity` row.

### Phase 3.4 — Feed endpoint
- Concept: fan-out-on-read is the deliberately simpler choice here — scale
  isn't a concern in this project, so don't let the user over-engineer
  fan-out-on-write.
- Task: `GET /users/:id/feed` — activities from followed lists, joined with
  like/comment counts, paginated.

### Phase 3.5 — Likes/comments CRUD
- Task: CRUD endpoints on activities for likes and comments.
- Completion (Stage 3 done when): marking a todo complete creates an
  activity row, and a follower's feed endpoint returns it with counts — all
  without any realtime layer. Make sure the user can articulate that realtime
  is additive on top of this, not a prerequisite for it.

Offer a Stage 3 summary before moving on.

---

## Stage 4 — Realtime layer (the swappable part)

Motivation: this is where the whole roadmap's DI discipline pays off hardest
— the realtime transport should be swappable without touching business logic
or tests.

### Phase 4.1 — `RealtimeAdapter` interface
- Task: define the interface — `publish(channel, event)`,
  `subscribe(channel, onEvent)` — in `src/realtime/`.

### Phase 4.2 — `SocketAdapter`
- Task: implement `SocketAdapter` (Socket.io rooms per list/feed); wire it
  into the "complete todo" and "like/comment" services so they publish
  *after* the DB write succeeds, not before.
- Check question: "what goes wrong if you publish before the DB write
  commits?"

### Phase 4.3 — DI checkpoint
- Concept: services take a `RealtimeAdapter` as a constructor/function
  parameter, typed as the **interface**, never the concrete class. The
  composition root (`server.ts`) is the only place that does
  `new SocketAdapter(io)`.
- Completion: grep `src/modules/` for every `service.ts` — none of them
  reference `SocketAdapter` by name, only `RealtimeAdapter`.

### Phase 4.4 — `FirestoreAdapter` swap
- Task: implement `FirestoreAdapter` as the same interface; swap it in via
  the composition root.
- Completion: confirm zero changes needed in service code to make the swap.

### Phase 4.5 — Fake adapter + Vitest
- Task: a `FakeRealtimeAdapter` that just records published events; assert
  services call `publish` with the right payload — no real Socket.io or
  Firestore needed in tests.
- Completion (Stage 4 done when): the user can toggle which adapter is
  active via one line in the composition root, and both app behavior and the
  test suite are unaffected by which one is picked.

Offer a Stage 4 (final) summary.

---

## Sequencing notes to keep in mind throughout

- Auth was originally deliberately deferred to the end of the roadmap — the
  reasoning being that stacking auth (a genuinely separate hard problem) on
  top of learning DI/service/testing patterns for the first time makes it
  hard to tell whether a bug is "my auth" or "my DI." The user explicitly
  opted out of that default and asked for auth right after Stage 1 (see
  **Stage 1.5**), deliberately scoped minimal (access token only, no
  refresh token). That's a real, informed decision — build Stage 1.5 as
  specified, but don't let scope creep past what it says (no refresh
  tokens, no rotation, no revocation lists) without the user explicitly
  asking again.
- Every phase after Stage 0 should add a few Vitest tests before moving on —
  it's much easier to verify DI is done right (*can I inject a fake here?*)
  incrementally than to retrofit it later. If a phase's completion criterion
  doesn't mention tests, still ask whether a quick one is worth adding.

### Testing philosophy (the "why" behind Phase 1.3's practices)

User's explicit call: route-level integration tests via `supertest`, real
HTTP requests through real Express routes, through real services, against
a real test database — no mocking Drizzle, no mocking the service layer.
The reasoning behind each specific practice, worth actually explaining to
the user when this comes up again, not just enforcing silently:

- **Why a separate test database, never dev/prod**: two distinct reasons.
  Safety — tests create/mutate/delete data constantly; pointing that at
  dev/prod risks destroying real work-in-progress data. And correctness —
  tests need a *known* starting state for assertions to mean anything. If
  the DB has whatever leftover junk exists from prior manual testing, an
  assertion like "`getListsByOwner` returns exactly 2 lists" becomes
  unreliable, since it silently depends on what else happens to be in the
  table.
- **Why isolation between tests matters**: without it, tests develop a
  hidden dependency on *execution order* and on each other's leftover
  state. Test A creates a user; test B, written independently, assumes a
  clean `users` table and fails on a duplicate-constraint — but only
  sometimes, only when run after test A, only in a certain order. This is
  the classic "flaky test" failure mode, and it's almost always caused by
  missing isolation, not by an actual bug in the code under test. Two
  concrete strategies (pick one deliberately, see Phase 1.3 for the
  route-testing-specific tradeoff): truncate all tables between tests, or
  wrap each test in a transaction that's rolled back afterward so nothing
  ever actually commits.
- **Why the seeding strategy is a real decision, not an afterthought**:
  every test that needs a user/list/todo to already exist has to create it
  somehow. Going through the real API (e.g. `POST /auth/register`) is more
  faithful to actual usage but makes every other test's setup silently
  depend on registration working correctly — a bug in registration would
  cause unrelated test failures everywhere, which is confusing to debug.
  Inserting directly into the test DB, bypassing the API, is faster and
  keeps each test's failure meaningfully scoped to what it's actually
  testing — at the cost of not exercising real registration behavior as a
  side effect. Neither is universally correct; pick per test file based on
  what that file is actually trying to prove.
- **Why real HTTP requests via `supertest` instead of mocking**: mocking
  the DB or the service layer means the test can pass even when the real
  wiring between HTTP → route → service → DB is broken — you'd only be
  testing that your mock behaves the way you told it to, not that the
  actual system works. Real requests against a real (test) database catch
  real integration bugs: wrong status codes, foreign key violations,
  serialization issues, middleware ordering mistakes — none of which a
  mocked test can see.
