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
  config.ts      # singular composition-root files stay flat at src/ root —
  db.ts          # cardinality rule: one-of-a-kind infra (db, config, logger)
  logger.ts      # doesn't multiply, so no folder needed for it
  server.ts      # composition root: builds db, realtime adapter, wires modules
  modules/
    users/
      schema.ts    # Drizzle table(s) for this domain
      service.ts   # business logic, depends on db/logger via params
      routes.ts    # thin Express routes, call the service
      validation.ts # Zod input schemas for this module's routes (Stage 2+)
    todos/
      schema.ts    # todo_lists + todos tables
      service.ts   # TodoService
      routes.ts
      validation.ts
    feed/
      schema.ts    # follows, activities, likes, comments (Stage 3)
      service.ts
      routes.ts
      validation.ts
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
sessions): `db.ts` ended up living flat at `src/db.ts`, not `src/db/db.ts`
(only `schema.ts` stayed under `src/db/` — singular composition-root files
like `db.ts`/`config.ts`/`logger.ts` stay flat at `src/` root; folders are
reserved for things expected to multiply, like `schemas/`/`services/`).
`/health` and `/health/db` were deliberately merged into one `GET /health`
route returning `{ server, db }` (user's call, understood the diagnostic
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

### Phase 1.1 — Schema
- Task: Drizzle schema for `users` (id, name — no password) in
  `src/modules/users/schema.ts`, and `todo_lists` (id, owner_id, name) +
  `todos` (id, list_id, text, done) in `src/modules/todos/schema.ts`.
- Completion: schema migrates cleanly against the DB from Stage 0.

### Phase 1.2 — Services with DI
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

### Phase 1.3 — Vitest starts here
- Concept: this is the payoff of the DI discipline — because services take
  `db` as a parameter, Vitest can inject an in-memory or test-DB instance and
  assert on behavior, with no HTTP layer involved.
- Task: write service-layer tests first, in `tests/modules/todos/`, before
  writing route tests (or instead of them, for now).
- Completion: a handful of passing Vitest tests exercise `TodoService`
  directly, with a test DB injected — not the production one.

### Phase 1.4 — Routes
- Task: thin routes in `src/modules/todos/routes.ts` and
  `src/modules/users/routes.ts` that call into services — `POST /lists`,
  `GET /lists/:id`, `GET /users/:id/lists`, `POST /lists/:id/todos`,
  `PATCH /todos/:id` (toggle done), `DELETE /todos/:id`. Auth doesn't exist
  yet at this point (that's Stage 1.5, next) — `userId` comes from a request
  field/header for now, same as the rest of this roadmap until 1.5 lands.
  `server.ts` (the composition root) mounts each module's router.
- Completion (Stage 1 done when): you can create a list, add todos, toggle
  them, and see it persist across server restarts — verified both by manual
  requests and by the Vitest service tests from 1.3.

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
  `src/modules/auth/routes.ts` (`POST /auth/register`, `POST /auth/login`).
- Concept: `auth` depends on `users` (to create/look up user records) —
  one-directional, same cross-module rule as `todos` depending on `users`.
  `users` never imports from `auth`.
- Completion: `POST /auth/register` creates a user with a hashed password;
  `POST /auth/login` with correct credentials succeeds, wrong credentials
  return 401.

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

Offer a Stage 1.5 summary before moving on to Stage 2.

---

## Stage 2 — Shared schemas (Zod)

Motivation: this is the glue layer between the DB shape, API validation, and
(eventually) a client's expectations — one contract instead of three
independently-drifting definitions.

### Phase 2.1 — Input schemas
- Task: Zod schemas for each entity's input shape (e.g. `CreateTodoInput`,
  `UpdateTodoInput`) in that module's `validation.ts` (e.g.
  `src/modules/todos/validation.ts`) — colocated with the module, not in a
  global schemas folder — that validate incoming request bodies.
- Completion: a schema exists for every mutating route from Stage 1.

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
