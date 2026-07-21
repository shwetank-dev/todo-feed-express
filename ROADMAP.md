# Todo feed backend — roadmap

Stack: Express + Drizzle (ORM) + Zod (validation) + Vitest (tests) + TypeScript.
No auth for now. Dependency injection used throughout so Postgres, and later the
realtime layer, stay swappable and mockable.

---

## Phase 0 — Hello world + DB connection (deploy this first)

Goal: prove the whole pipeline works end to end before writing any real logic.

- `npm init`, TypeScript config, Express app with one route: `GET /health` → `{ status: "ok" }`
- Set up Drizzle with Postgres. Recommended for a learning project: **Neon** or
  **Supabase** (free Postgres, gives you a connection string in minutes) —
  avoids you having to manage a DB server yourself.
- Drizzle config + one trivial table (`SELECT 1` style) just to prove the
  connection works — add `GET /health/db` that runs a query and returns success.
- Deploy target: **Railway** or **Render** (both do "push a Node repo, get a URL"
  with minimal config). Set the DB connection string as an environment variable.
- **DI checkpoint:** the DB client (Drizzle instance) should be created once in
  a `db.ts` file and *passed into* route handlers/services as a parameter —
  never imported and instantiated fresh inside a handler. This is your first
  composition root.

**Done when:** you hit your deployed URL, `/health` and `/health/db` both return
success, from your phone browser, not just localhost.

---

## Phase 1 — Core schema + CRUD API endpoints

- Drizzle schema for: `users` (id, name — no password), `todo_lists` (id,
  owner_id, name), `todos` (id, list_id, text, done)
- Routes (no auth — take `userId` as a request field/header for now):
  - `POST /lists`, `GET /lists/:id`, `GET /users/:id/lists`
  - `POST /lists/:id/todos`, `PATCH /todos/:id` (toggle done), `DELETE /todos/:id`
- **DI structure:** each route handler depends on a `service` (e.g.
  `TodoService`), and each service depends on the `db` client via constructor/
  function parameter — never a bare import of the Drizzle instance inside
  business logic. This is what lets Vitest inject a fake DB later.
- **Vitest starts here:** write service-layer tests first (not route tests) —
  inject an in-memory or test-DB instance, assert on behavior. This is the
  payoff of the DI discipline from Phase 0.

**Done when:** you can create a list, add todos, toggle them, and see it
persist across server restarts — verified by both manual requests and a
handful of Vitest service tests.

---

## Phase 2 — Shared schemas (Zod)

This is the "glue" layer between your DB shape, your API validation, and
(eventually) your RN client's expectations.

- Define Zod schemas for each entity's *input* shape (e.g. `CreateTodoInput`,
  `UpdateTodoInput`) — these validate incoming request bodies.
- Middleware: a small `validateBody(schema)` Express middleware that parses
  `req.body` against a Zod schema and 400s on failure, before the handler ever
  runs.
- Infer TypeScript types *from* the Zod schemas (`z.infer<typeof X>`) rather
  than writing separate interfaces — one source of truth instead of two
  definitions drifting apart.
- Put these schemas in a `shared/` package/folder — the idea is this becomes
  the contract the RN app can eventually import too (same validation rules on
  client and server, no duplication).
- **DI checkpoint:** validation middleware takes the schema as a parameter
  (`validateBody(createTodoSchema)`), not a hardcoded schema baked into the
  middleware itself — same "inject what varies" principle.

**Done when:** sending a malformed request (missing field, wrong type) to any
route returns a clean 400 with a useful message, and your service-layer
TypeScript types come from the same Zod schemas your validation uses.

---

## Phase 3 — Follows, activities, and the feed

- Add `follows` (user_id → list_id), `activities` (what happened: todo
  completed, list created, etc.), `likes`, `comments` tables
- `POST /lists/:id/follow`, `DELETE /lists/:id/follow`
- Activity generation: when a todo is marked complete, insert an `activity` row
  in the same service call (still no realtime push yet — just the DB record)
- Feed endpoint: `GET /users/:id/feed` — fan-out-on-read query (activities from
  followed lists, joined with like/comment counts), paginated
- Likes/comments CRUD on activities

**Done when:** marking a todo complete creates an activity row, and a
follower's feed endpoint returns it, with counts — all without any realtime
layer yet. Realtime is additive on top of this, not a prerequisite for it.

---

## Phase 4 — Realtime layer (the swappable part)

- Define `RealtimeAdapter` interface: `publish(channel, event)`,
  `subscribe(channel, onEvent)`
- Implement `SocketAdapter` (Socket.io rooms per list/feed) — wire it into the
  "complete todo" and "like/comment" services so they publish *after* the DB
  write succeeds
- **DI checkpoint:** services take a `RealtimeAdapter` as a constructor/
  function parameter, typed as the interface, never the concrete class. The
  composition root (server entry file) is the only place that does
  `new SocketAdapter(io)`.
- Implement `FirestoreAdapter` as the same interface, swap it in via the
  composition root, confirm zero changes needed in service code
- Vitest: inject a `FakeRealtimeAdapter` that just records published events,
  and assert services call `publish` with the right payload — no real
  Socket.io/Firestore needed in tests

**Done when:** you can toggle which adapter is active via one line in the
composition root, and both the app behavior and your test suite are unaffected
by which one you picked.

---

## Suggested folder shape (roughly, adjust as you go)

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

---

## Notes on sequencing

- Auth is deliberately skipped everywhere above — swap the hardcoded `userId`
  for real auth as a later, separate exercise once the core patterns are solid.
- Fan-out-on-read (Phase 3) is intentionally the simpler choice since scale
  isn't a concern here — the realtime layer in Phase 4 is what makes it feel
  "live," not the feed query itself.
- Every phase after Phase 0 should add a few Vitest tests before moving on —
  it's much easier to verify DI is done right (can I inject a fake here?) as
  you go than to retrofit it later.