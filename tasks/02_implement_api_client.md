# Task: Implement CAO API Client

**Objective:** Create a typed API client in the Next.js application to interact with the CAO Server.

**Requirements:**
1. Base URL: `http://localhost:9889` (or configurable via env var).
2. Implement functions to fetch:
   - List of sessions (`GET /sessions`)
   - Session details (`GET /sessions/{name}`)
   - List of terminals in a session (`GET /sessions/{name}/terminals`)
   - Terminal details (`GET /terminals/{id}`)
   - Terminal output (`GET /terminals/{id}/output`)
   - Send input to terminal (`POST /terminals/{id}/input`)
3. Use strict TypeScript types matching the backend models (see `src/cli_agent_orchestrator/models`).
4. Place code in `apps/dashboard/src/lib/api.ts` (or similar).

**Context:**
- Backend is running on port 9889.
- Use `fetch` or a lightweight library.

**Deliverables:**
- `src/lib/api-client.ts`: The client implementation.
- `src/types/cao.ts`: Type definitions.
