# Database — Postgres, Prisma and pgAdmin

TechVerse uses **PostgreSQL 16** in Docker. The database is never stored in the
repository. You inspect and query it through **pgAdmin** at
<http://localhost:5050>.

## Start it

```bash
docker compose up -d postgres pgadmin
```

| Service | URL / port | Credentials |
| --- | --- | --- |
| Postgres | `localhost:5432` | db `techverse`, user `techverse`, password `techverse_dev` |
| pgAdmin | <http://localhost:5050> | `admin@techverse.dev` / `admin` |
| Prisma Studio | <http://localhost:5555> | `make db-studio` |

The pgAdmin server is pre-registered as **TechVerse (local)**. Log in to pgAdmin
with `admin@techverse.dev` / `admin`, then the first time you expand the server
enter the database password `techverse_dev` and tick *Save password*.

## Demo accounts

`make db-seed` creates one organization (**TechVerse Studio**) and six users:
`owner@`, `admin@`, `manager@`, `member@`, `viewer@` and `contractor@techverse.dev`,
all with the password `DemoPass123!`.

## Connection string

```text
postgresql://techverse:techverse_dev@localhost:5432/techverse
```

Override any value in `.env` (see `.env.example`). Inside Docker the API uses the
service hostname `postgres` instead of `localhost`; compose wires that up for
you.

## Schema and migrations

The API owns the schema through Prisma. The commands below run inside the `api`
container, so they work on a fresh clone with no host `npm install`:

```bash
# Apply pending migrations (the api container also does this on boot)
make db-migrate

# Seed demo data
make db-seed

# Optional: service-desk demo data
docker compose exec -T api npx ts-node prisma/seed-service-desk.ts
```

The API container runs `prisma migrate deploy` automatically on boot, so
`docker compose up -d` is enough for a fresh stack. `make db-migrate` is for
running the API outside Docker.

Migration files live in `services/api/prisma/migrations/` and are committed.
Never edit an applied migration; add a new one.

## Inspect with pgAdmin

1. Open <http://localhost:5050> and log in.
2. Expand **Servers → TechVerse (local) → Databases → techverse → Schemas →
   public → Tables**.
3. Right-click a table → **View/Edit Data → First 100 Rows**.
4. Use **Tools → Query Tool** for ad-hoc SQL.

Useful queries:

```sql
-- table sizes
select relname, pg_size_pretty(pg_total_relation_size(relid)) as size
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc;

-- active connections
select pid, usename, application_name, state, query
from pg_stat_activity
where datname = 'techverse';
```

## Reset the database

Destroys local data only; the repository is untouched.

```bash
docker compose down -v          # removes the postgres_data volume
docker compose up -d --build    # api re-applies migrations on boot
make db-seed
```

## Why there is no `.pgdata/`

An earlier version ran a local `initdb` cluster inside the repo (`.pgdata/`,
port 5433, trust auth). That is gone: it was 90 MB of machine-specific binaries,
it leaked credentials, and it made the repo non-portable.

If you still have an old cluster on disk, stop it and delete the folder; the
Docker service is the only supported local database now.

## Troubleshooting

**Port 5432 already in use** — a native PostgreSQL install is running. On Windows
that is usually the `postgresql-x64-18` service; check with
`Get-NetTCPConnection -LocalPort 5432` and look at the owning process. Stop and
disable it from an **elevated** shell so Docker can own the port:

```powershell
Stop-Service postgresql-x64-18 -Force
Set-Service postgresql-x64-18 -StartupType Disabled
```

Re-enable it later with `Set-Service postgresql-x64-18 -StartupType Automatic`.
Alternatively change the host port in `docker-compose.yml` (`"5434:5432"`) and
update `DATABASE_URL`.

**`P1001: Can't reach database server`** — wait for the healthcheck:
`docker compose ps` should show `healthy`. Then retry.

**pgAdmin shows "connection refused"** — inside pgAdmin the host must be
`postgres` (the compose service name), not `localhost`. The pre-registered
server already uses `postgres`.

**Password authentication failed** — the volume was created with different
credentials. Reset with `docker compose down -v` and bring it up again.
