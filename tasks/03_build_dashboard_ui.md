# Task: Build Dashboard UI

**Objective:** Create the main UI pages for the CAO Dashboard.

**Pages:**
1. **Home (`apps/dashboard/src/app/page.tsx`):**
   - Fetch and display a list of all sessions using `caoClient.listSessions()`.
   - Show session name, status, and a link to view details.
   - Add a "Refresh" button.

2. **Session Details (`apps/dashboard/src/app/sessions/[name]/page.tsx`):**
   - Route parameter: `name` (session name).
   - Fetch session details and list of terminals.
   - Display a table/grid of terminals (ID, Name, Provider, Status, Agent Profile).
   - Link to Terminal Details.

3. **Terminal Details (`apps/dashboard/src/app/terminals/[id]/page.tsx`):**
   - Route parameter: `id` (terminal ID).
   - Display terminal metadata (status, provider, etc.).
   - **Output Window:** Display the terminal output (`getTerminalOutput`). Use a preformatted text block (`<pre>`) with scroll.
   - **Input Control:** A text input and "Send" button to call `sendTerminalInput`.
   - **Auto-refresh:** Poll for output updates every few seconds.

**Styling:**
- Use Tailwind CSS.
- Dark theme styling (bg-slate-900, text-slate-100).
- Simple, functional layout.

**Instructions:**
- Create necessary folder structure for routes.
- Use React `useEffect` for fetching data (client-side rendering is fine for this dashboard).
- Handle loading and error states.
