```markdown
# Network Service (backend/blockchain)

This module provides a live-capable, pluggable network status service for the VQC dashboard.

Key features:
- Pluggable DB adapter:
  - Default: file-backed store at backend/data/network_cache.json (no extra deps)
  - Optional: Postgres adapter when DATABASE_URL is set (requires `pg` package)
- Asynchronous initialization so DB adapter can be ready before mounting endpoints
- Optional Express router factory and encore.dev API registration
- Symbolic metadata + eccentricity-based fee scaling preserved and returned in responses
- Small caching layer for responses (configurable TTLs inside the service)

Files:
- db.ts: adapters (FileAdapter, PostgresAdapter) and DBAdapter interface
- network.ts: initNetworkService(), registerEncoreEndpoints(), and core logic
- migrations/001_init.sql: optional migration for Postgres
- data/network_cache.json (created automatically by FileAdapter on first run)

Usage examples:

1) Default file-backed service (no extra deps):

```ts
import express from "express";
import { initNetworkService } from "./backend/blockchain/network";

async function start() {
  const svc = await initNetworkService(); // initializes file adapter
  const router = await svc.createExpressRouter();
  const app = express();
  app.use("/api", router);
  app.listen(3000);
}
start();
```

2) Use Postgres (requires `pg` package and DATABASE_URL env var):

- Install `pg`:
  npm install pg

- Set env:
  export DATABASE_URL="postgres://user:pass@host:5432/dbname"

- Then init as above; the adapter will run the CREATE TABLE statement on init.

3) If you use encore.dev APIs:

```ts
import { registerEncoreEndpoints } from "./backend/blockchain/network";

// Ensure DB is ready inside registerEncoreEndpoints
registerEncoreEndpoints().then((svc) => {
  // endpoints are now registered on the encore router
});
```

Endpoints (paths preserved from original):
- GET /network/status
- GET /network/validators
- GET /network/peers
- GET /network/chain-info

Feedback / next steps:
- I can create a PR with these files if you'd like me to push them into the repository.
- If you prefer a different DB (MySQL, Mongo, or an ORM), I can add a new adapter or make PostgresAdapter use your ORM of choice.
- I can convert the router to an independent microservice (standalone server) if desired.
```