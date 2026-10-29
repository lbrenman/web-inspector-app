# App

Node.js (CommonJS) + Express + PostgreSQL API with a React (Vite) client, set up for GitHub Codespaces.

The scaffold ships with a small example resource (`/api/notes` and a matching UI) that demonstrates the
layering, validation, error handling and tests. Delete it once you add your own domain.

## Stack

- **Server:** Node.js (current LTS), Express 5, `pg`, `node-pg-migrate`, `zod`, `dotenv`
- **Client:** React 19, Vite
- **Tests:** Jest + Supertest (server), Vitest + React Testing Library (client)
- **Tooling:** ESLint (flat config) + Prettier at the repo root, npm workspaces

## Quick start (GitHub Codespaces)

1. Open the repo in a Codespace. The dev container starts the app container and a Postgres 17 service,
   copies `.env.example` to `.env`, runs `npm install` and applies migrations.
2. Run `npm run dev`.
3. Open the forwarded port **5173** (client). The Vite dev server proxies `/api` to the API on port 3001.

> **Keep forwarded ports Private.** The app has no authentication by design. Never set port 5173 or
> 3001 to Public (Codespaces defaults to Private).

First time only: `npm install` generates `package-lock.json`. Commit it; CI uses `npm ci` and needs it.

## Local setup (without Codespaces)

Requires Node.js 22+ (24 recommended) and a Postgres instance.

```bash
cp .env.example .env
docker compose -f .devcontainer/docker-compose.yml up -d db   # Postgres on 127.0.0.1:5432
npm install
npm run migrate
npm run dev
```

## Scripts (run from the repo root)

| Script                          | Description                                              |
| ------------------------------- | -------------------------------------------------------- |
| `npm run dev`                   | Start the API (`node --watch`) and the Vite client       |
| `npm run build`                 | Build the client into `client/dist`                      |
| `npm test`                      | Run server and client tests                              |
| `npm run lint` / `lint:fix`     | ESLint                                                   |
| `npm run format` / `format:check` | Prettier                                               |
| `npm run migrate`               | Apply pending migrations to `DATABASE_URL`               |
| `npm run migrate:down`          | Roll back the latest migration                           |
| `npm run migrate:create -- name`| Create a new migration file in `server/migrations`       |

## Environment variables

Copy `.env.example` to `.env`. The server validates required variables at startup and exits if one is missing.

| Variable            | Required | Default     | Description                                                       |
| ------------------- | -------- | ----------- | ----------------------------------------------------------------- |
| `DATABASE_URL`      | yes      |             | Postgres connection string for development                       |
| `TEST_DATABASE_URL` | for tests|             | Test database. Name must end in `_test`; it is created automatically and truncated between tests |
| `HOST`              | no       | `127.0.0.1` | Interface the API binds to                                        |
| `PORT`              | no       | `3001`      | API port (if you change it, also update the proxy in `client/vite.config.js`) |

## Project structure

```
.devcontainer/        Dev container (app + Postgres), post-create script
.github/workflows/    CI: lint + tests against a Postgres service container
client/               React app (Vite)
  src/api/            fetch wrapper and API functions
  src/components/     UI components
server/
  migrations/         node-pg-migrate migrations
  scripts/migrate.js  Migration runner used by `npm run migrate`
  src/
    config/           Env loading and validation
    routes/           URL -> middleware -> controller wiring
    controllers/      HTTP in/out (status codes, response bodies)
    services/         Business logic
    db/               Pool and data-access (SQL lives only here)
    schemas/          zod request schemas
    middleware/       validate, notFound, errorHandler
    errors/           HttpError
  tests/              Jest + Supertest integration tests
```

Request flow: `routes -> controllers -> services -> db`. Errors thrown anywhere (including async handlers,
which Express 5 forwards automatically) reach the central `errorHandler`, which returns
`{ "error": { "code", "message", "details?" } }` and never exposes stack traces or internals.

## API

| Method & path          | Description                                  |
| ---------------------- | -------------------------------------------- |
| `GET /api/health`      | Liveness plus a database check               |
| `GET /api/notes`       | List notes, newest first (`?limit=&offset=`) |
| `POST /api/notes`      | Create a note `{ title, body }`              |
| `GET /api/notes/:id`   | Fetch one note                               |
| `DELETE /api/notes/:id`| Delete a note (204)                          |

## Tests

```bash
npm test                  # everything
npm test -w server        # Jest + Supertest
npm test -w client        # Vitest + React Testing Library
```

Server tests run against a real Postgres database (`TEST_DATABASE_URL`). Before the suite, the database is
created if missing and migrated; every table is truncated before each test. Test files run serially
because they share that database.

## Adding a feature

1. `npm run migrate:create -- add-thing-table`, then edit the generated migration (`up` and `down`).
2. Add a zod schema, repository, service, controller and route following `notes`.
3. Add Supertest tests covering success, validation errors and not-found cases.
