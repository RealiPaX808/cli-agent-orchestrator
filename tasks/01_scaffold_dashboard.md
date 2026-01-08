# Task: Scaffold CAO Dashboard

**Objective:** Initialize a new Next.js application in `apps/dashboard` to serve as the web frontend for the CLI Agent Orchestrator.

**Requirements:**
1. Use `bun` as the package manager.
2. Create the application in `apps/dashboard`.
3. Stack:
   - Next.js (App Router)
   - TypeScript
   - Tailwind CSS
4. The application should be cleanly initialized and runnable.
5. Ensure `bun.lockb` is generated.

**Instructions:**
1. Navigate to the project root.
2. Run the command to create a new Next.js app using bun:
   `bun create next-app apps/dashboard --typescript --tailwind --eslint`
   (Adjust flags as necessary to avoid interactive prompts if possible, or use `bun create next-app` and handle it).
   *Note:* If `apps` directory does not exist, create it. If `apps/dashboard` needs to be created by the command, ensure the parent exists.
3. Verify the installation by running the build command: `cd apps/dashboard && bun run build`.
4. Do not modify the existing `apps/frontend` directory.

**Output:**
- A fully scaffolded Next.js application in `apps/dashboard`.
