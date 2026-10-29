# Request Inspector

A small webhook.site-style tool. Send any HTTP request to `/hook` (from Postman, curl, a webhook
provider, ...) and the inspector shows every detail of each call live: method, path, query
parameters, all headers, and the body. When the payloads contain structure, you can view them as
tables:

- **Inside one payload:** arrays of objects (e.g. `{ "data": { "users": [ ... ] } }`) become tables.
- **Across requests:** JSON-object payloads that share the same top-level keys are grouped into a
  "pattern", shown as one table with a row per request.

Stack: Node.js (CommonJS) + Express 5 + PostgreSQL (`pg`, `node-pg-migrate`) with a React + Vite UI,
set up for GitHub Codespaces.

## Quick start (GitHub Codespaces)

1. Open the repo in a Codespace. The dev container starts the app container and a Postgres 17
   service, copies `.env.example` to `.env`, runs `npm install`, and applies migrations.
2. Run `npm run dev`.
3. Open the forwarded port **5173** (the inspector UI). The capture URL is shown at the top.
4. To let Postman (or any outside caller) reach it, make port **3001** Public: in the **Ports**
   panel, right-click 3001, then _Port Visibility_, then _Public_. Then send requests to
   `https://<codespace>-3001.app.github.dev/hook`.

First time only: `npm install` generates `package-lock.json`. Commit it; CI uses `npm ci` and needs it.

### Ports and exposure

The app has no authentication, by design. It runs two separate servers so only the write-only part
needs to be public:

| Port | What                                                          | Visibility                        |
| ---- | ------------------------------------------------------------- | --------------------------------- |
| 3001 | Capture endpoint: serves `/hook` and `/hook/*` only           | Public only if outside callers need it |
| 3002 | Inspector API: stored requests, live stream, delete           | **Keep Private**                  |
| 5173 | Inspector UI (Vite dev server, proxies `/api` to 3002)        | **Keep Private**                  |

Making 3001 Public means anyone who learns the URL can post data to it, and that data appears in
your inspector. It cannot read anything back. Mitigations built in: a request body size cap
(`MAX_BODY_BYTES`) and automatic deletion of old requests (`MAX_STORED_REQUESTS`). If you do not
need outside callers (for example Postman running on your own machine and port 3001 forwarded to
localhost), leave every port Private.

Captured data is stored as received, including headers such as `Authorization`. Treat the database
accordingly.

## Local setup (without Codespaces)

Requires Node.js 22+ (24 recommended) and a Postgres instance.

```bash
cp .env.example .env
docker compose -f .devcontainer/docker-compose.yml up -d db   # Postgres on 127.0.0.1:5432
npm install
npm run migrate
npm run dev
```

UI: http://localhost:5173. Capture URL: `http://localhost:3001/hook`.

## Sending requests

```bash
curl -X POST "$CAPTURE_URL?source=curl" \
  -H "Content-Type: application/json" \
  -d '{"event":"order.created","items":[{"sku":"A1","qty":2},{"sku":"B2","qty":1}]}'
```

- Any method and any content type are accepted, on `/hook` and any sub-path (`/hook/orders/42`).
- The response is `200 {"received": true, "id": <number>}`.
- Bodies over `MAX_BODY_BYTES` are rejected with `413` and not stored.
- JSON is detected from the content, not just the header, so a JSON body sent as `text/plain` still
  gets pretty-printing and tables. Malformed JSON is stored as plain text.
- Gzip/deflate request bodies are decompressed by Express before storing. Other
  `Content-Encoding` values (for example `br`) are rejected with 415.

## How table detection works

- **In a payload:** every array of two or more objects, at the root or under object keys, becomes a
  table. Columns are the union of keys across rows; nested objects are flattened with dotted names
  (`address.city`, three levels deep); arrays and anything deeper are shown as JSON text. Arrays
  nested inside rows are not split into further tables. Limits: 1000 rows, 50 columns, 20 tables.
- **Across requests:** a pattern is two or more requests whose body is a JSON object with the same
  set of top-level keys (order does not matter). The table has one row per request (newest first,
  up to 200), flattened the same way, with a link to the source request.

JSON bodies are also stored as `jsonb` for grouping. Numbers beyond JavaScript's safe integer range
lose precision there and in tables; the Raw tab always shows the original text.

## Scripts (run from the repo root)

| Script                           | Description                                         |
| -------------------------------- | --------------------------------------------------- |
| `npm run dev`                    | Start both servers (`node --watch`) and the Vite UI |
| `npm run build`                  | Build the client into `client/dist`                 |
| `npm test`                       | Run server and client tests                         |
| `npm run lint` / `lint:fix`      | ESLint                                              |
| `npm run format` / `format:check`| Prettier                                            |
| `npm run migrate`                | Apply pending migrations to `DATABASE_URL`          |
| `npm run migrate:down`           | Roll back the latest migration                      |
| `npm run migrate:create -- name` | Create a new migration file                         |

## Environment variables

Copy `.env.example` to `.env`. The server validates its configuration at startup and exits on error.

| Variable              | Default                  | Description                                                   |
| --------------------- | ------------------------ | ------------------------------------------------------------- |
| `DATABASE_URL`        | (required)               | Postgres connection string                                    |
| `TEST_DATABASE_URL`   | (required for tests)     | Test database; name must end in `_test`, truncated per test   |
| `HOST`                | `127.0.0.1`              | Interface both servers bind to                                |
| `CAPTURE_PORT`        | `3001`                   | Public capture endpoint                                       |
| `API_PORT`            | `3002`                   | Inspector API (update `client/vite.config.js` if changed)     |
| `MAX_BODY_BYTES`      | `1048576`                | Largest accepted request body (max 10 MiB)                    |
| `MAX_STORED_REQUESTS` | `1000`                   | Older requests are deleted beyond this count                  |
| `CAPTURE_PUBLIC_URL`  | derived                  | Override the capture URL shown in the UI                      |

## Project structure

```
.devcontainer/        Dev container (app + Postgres), post-create script
.github/workflows/    CI: lint + tests against a Postgres service container
client/
  src/api/            fetch wrapper and inspector API functions
  src/hooks/          useRequestStream: list + live updates over SSE
  src/components/     Header, RequestList, RequestDetail, BodyViewer, PatternsView, DataTable
server/
  migrations/         node-pg-migrate migrations
  src/
    captureApp.js     Public app: /hook only
    inspectorApp.js   Private app: /api (requests, patterns, stream, health, info)
    routes/           URL -> middleware -> controller wiring
    controllers/      HTTP in/out
    services/         Capture, requests, patterns logic
    db/               Pool and data access (SQL lives only here)
    lib/              Pure functions: body analysis, headers, shape hashing, table detection
    events/           In-process pub/sub feeding the SSE stream
    middleware/       validate, notFound, errorHandler
    schemas/          zod request schemas
  tests/              Jest + Supertest integration tests (real Postgres)
```

## Inspector API (private)

| Method & path                      | Description                                              |
| ---------------------------------- | -------------------------------------------------------- |
| `GET /api/info`                    | Capture URL and limits                                   |
| `GET /api/requests?limit=&before=` | Summaries, newest first, cursor-paginated by id          |
| `GET /api/requests/:id`            | Full request: headers, query, body, detected tables      |
| `DELETE /api/requests/:id`         | Delete one request                                       |
| `DELETE /api/requests`             | Delete all requests                                      |
| `GET /api/patterns`                | Groups of similarly shaped JSON payloads                 |
| `GET /api/patterns/:hash/table`    | One pattern as a table                                   |
| `GET /api/stream`                  | Server-Sent Events: `request`, `deleted`, `cleared`      |
| `GET /api/health`                  | Liveness plus a database check                           |

## Tests

```bash
npm test                  # everything
npm test -w server        # Jest + Supertest against a real Postgres database
npm test -w client        # Vitest + React Testing Library
```

Server tests use `TEST_DATABASE_URL`: the database is created if missing and migrated before the
suite, and every table is truncated before each test. The suite runs with small limits
(`MAX_BODY_BYTES=4096`, `MAX_STORED_REQUESTS=50`) so the limit behavior is testable. Test files run
serially because they share the database.

## Known limitations

- Live updates use an in-process event emitter, so the capture and API servers must run in the same
  process (they do). Running them separately would need Postgres `LISTEN/NOTIFY`.
- Every captured request is stored as received. There is no per-endpoint URL or response
  customization; `/hook` always answers `200`.
