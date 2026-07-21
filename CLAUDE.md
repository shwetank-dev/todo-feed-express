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

```
src/
  db/            # Drizzle schema + client factory (db.ts)
  schemas/       # Zod schemas (shared contract)
  services/      # business logic, depends on interfaces via params
  realtime/      # RealtimeAdapter interface + SocketAdapter + FirestoreAdapter
  routes/        # Express routes, thin — call services
  server.ts      # composition root: builds db, realtime adapter, wires services
tests/
  services/      # Vitest, inject fakes
```

Don't dump this tree on the user in Stage 0. Reveal each directory the phase
that first needs it.

---

## Stage 0 — Hello world + DB connection

Motivation: prove the whole pipeline (code → deployed URL → real DB) works
before any real logic exists. Skipping this means debugging deploy issues and
business-logic bugs at the same time later — worse for learning either one.

### Phase 0.1 — Project scaffold
- Problem: nothing exists yet; TypeScript + Express need wiring before any
  route can run.
- Task: `npm init`, TypeScript config, a minimal Express app that starts and
  listens on a port.
- Completion: `npm run dev` (or equivalent) starts the server with no errors.

### Phase 0.2 — `GET /health`
- Problem: need the smallest possible proof the HTTP layer works.
- Task: one route, `GET /health` → `{ status: "ok" }`.
- Completion: hitting the route locally (curl/browser) returns that JSON.

### Phase 0.3 — Drizzle + Postgres
- Problem: need a real database, not a toy — but standing up Postgres
  yourself is a distraction from the actual lesson.
- Concept: point the user at **Neon** or **Supabase** (free Postgres,
  connection string in minutes) so they avoid managing a DB server.
- Task: install Drizzle, configure it against the connection string, define
  one trivial table just to prove connectivity (a `SELECT 1` style check).
- Completion: Drizzle can connect and run a query against the real DB.

### Phase 0.4 — `db.ts` composition root (DI checkpoint)
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

### Phase 0.5 — `GET /health/db`
- Task: a route that takes the `db` from Phase 0.4 as a dependency and runs
  a real query, returning success/failure.
- Completion: `/health/db` returns success against the live DB.

### Phase 0.6 — Deploy
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
- Task: Drizzle schema for `users` (id, name — no password), `todo_lists`
  (id, owner_id, name), `todos` (id, list_id, text, done).
- Completion: schema migrates cleanly against the DB from Stage 0.

### Phase 1.2 — Services with DI
- Problem: if route handlers talk to Drizzle directly, business logic and
  HTTP concerns tangle together, and nothing is mockable in tests.
- Concept: each route handler depends on a `service` (e.g. `TodoService`),
  and each service depends on the `db` client via constructor/function
  parameter — never a bare import of the Drizzle instance inside business
  logic.
- Task: build `TodoService` (and similar) in `src/services/`, taking `db` as
  a parameter.
- Completion: no service file imports `db` directly from `db.ts` — it's
  always passed in.

### Phase 1.3 — Vitest starts here
- Concept: this is the payoff of the DI discipline — because services take
  `db` as a parameter, Vitest can inject an in-memory or test-DB instance and
  assert on behavior, with no HTTP layer involved.
- Task: write service-layer tests first, in `tests/services/`, before
  writing route tests (or instead of them, for now).
- Completion: a handful of passing Vitest tests exercise `TodoService`
  directly, with a test DB injected — not the production one.

### Phase 1.4 — Routes
- Task: thin routes that call into services — `POST /lists`,
  `GET /lists/:id`, `GET /users/:id/lists`, `POST /lists/:id/todos`,
  `PATCH /todos/:id` (toggle done), `DELETE /todos/:id`. No auth — `userId`
  comes from a request field/header for now.
- Completion (Stage 1 done when): you can create a list, add todos, toggle
  them, and see it persist across server restarts — verified both by manual
  requests and by the Vitest service tests from 1.3.

Offer a Stage 1 summary before moving on.

---

## Stage 2 — Shared schemas (Zod)

Motivation: this is the glue layer between the DB shape, API validation, and
(eventually) a client's expectations — one contract instead of three
independently-drifting definitions.

### Phase 2.1 — Input schemas
- Task: Zod schemas for each entity's input shape (e.g. `CreateTodoInput`,
  `UpdateTodoInput`) that validate incoming request bodies.
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

### Phase 2.4 — `shared/` folder
- Concept: these schemas live somewhere that could eventually be imported by
  a client app too (same validation rules on both sides, no duplication) —
  not required to build a client now, just don't paint yourself into a
  server-only corner.
- Completion (Stage 2 done when): both 2.2's and 2.3's completion criteria
  hold, and schemas live in a clearly separate `schemas/`/`shared/` location.

Offer a Stage 2 summary before moving on.

---

## Stage 3 — Follows, activities, and the feed

Motivation: this is the actual "social" feature — but deliberately without
realtime yet, so the feed's correctness can be verified independently of any
push mechanism.

### Phase 3.1 — Schema
- Task: `follows` (user_id → list_id), `activities` (what happened: todo
  completed, list created, etc.), `likes`, `comments`.

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
- Completion: grep the services directory — no service file references
  `SocketAdapter` by name, only `RealtimeAdapter`.

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

- Auth is deliberately skipped everywhere — swapping the hardcoded `userId`
  for real auth is a later, separate exercise once these patterns are solid.
  Don't let the user add auth mid-roadmap "just in case."
- Every phase after Stage 0 should add a few Vitest tests before moving on —
  it's much easier to verify DI is done right (*can I inject a fake here?*)
  incrementally than to retrofit it later. If a phase's completion criterion
  doesn't mention tests, still ask whether a quick one is worth adding.
