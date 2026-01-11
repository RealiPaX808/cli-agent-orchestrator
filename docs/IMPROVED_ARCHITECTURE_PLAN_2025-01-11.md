# 🏗️ IMPROVED ARCHITECTURE PLAN
## CLI Agent Orchestrator - Complete System Design

**Datum**: 2025-01-11
**Analyse-Methode**: Hive-Mind Multi-Agent Swarm
**Status**: ✅ Detaillierte Analyse abgeschlossen

---

## 📋 Das eigentliche Problem

Der aktuelle Plan (`zesty-pondering-lemon.md`) beschreibt eine Kette:
```
PROJEKT → SESSION → WORKFLOW → AGENTS
```

Aber die **aktuelle Implementierung** hat:
- ❌ Kein Project Layer (complett fehlend)
- ⚠️ Session Lifecycle fragmentiert (nicht persistiert)
- ⚠️ Workflow doppelt implementiert (BPMN vs ReactFlow JSON)
- ❌ Kein automatisches Agent Resolution
- ❌ TASK_CREATOR/TASK_ORCHESTRATOR nodes fehlen

---

## 🎯 DER VERBESSERTE PLAN

### Die Vier-Schichten-Architektur (KLAR & EINFACH)

```
┌──────────────────────────────────────────────────────────────────────┐
│                           LAYER 1: PROJECT                        │
│  ├─ ID, Name, Beschreibung, Pfad                                  │
│  ├─ Konfiguration: default_provider, agent_mappings                 │
│  └─ Enthält: Workflows, Sessions, Tasks                             │
├──────────────────────────────────────────────────────────────────────┤
│                           LAYER 2: WORKFLOW (Definition)           │
│  ├─ BPMN 2.0 Prozess (Elements, Edges, Variables)                  │
│  ├─ Version: 1, 2, 3, ...                                           │
│  └─ Snapshot bei jeder Änderung                                     │
├──────────────────────────────────────────────────────────────────────┤
│                           LAYER 3: SESSION (Execution)              │
│  ├─ Status: INITIALIZING → RUNNING → COMPLETED/FAILED             │
│  ├─ Tokens: Aktive BPMN Tokens (persistiert!)                     │
│  ├─ Variables: Laufzeit-Variablen (persistiert!)                  │
│  └─ Enthält: Terminals mit Agents                                    │
├──────────────────────────────────────────────────────────────────────┤
│                           LAYER 4: AGENTS (Terminals)               │
│  ├─ Terminal: tmux window + Provider                                │
│  ├─ Agent: Profil (markdown) + System Prompt                        │
│  └─ MCP Servers: Pro Provider gestart                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ LAYER 1: PROJECT (Top-Level Org Unit)

### Was ein Project IST

```python
class Project(BaseModel):
    """Top-level organizational unit."""

    # Identity
    id: str                    # "proj-abc123" or user-defined
    name: str                  # "My AI Project"
    description: Optional[str]

    # Filesystem
    path: Path                  # "/home/user/projects/my-project"

    # Configuration
    status: ProjectStatus       # ACTIVE, ARCHIVED, TEMPLATE
    default_provider: str = "q_cli"

    # Agent Mappings (Task Type → Agent Profile)
    agent_mappings: Dict[str, str] = {
        "CODE": "developer",
        "REVIEW": "reviewer",
        "TEST": "tester",
        "ANALYZE": "analyst",
    }

    # Relationships
    workflows: List[str] = []   # Workflow IDs
    sessions: List[str] = []    # Active session names
```

### Database Schema

```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    path TEXT NOT NULL UNIQUE,        -- Filesystem path
    status TEXT NOT NULL DEFAULT 'active',
    default_provider TEXT DEFAULT 'q_cli',
    agent_mappings TEXT,               -- JSON: task_type → agent_profile
    metadata TEXT,                     -- JSON: extensible config
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_path ON projects(path);
```

### Project Configuration File (Optional)

```yaml
# ~/.aws/cli-agent-orchestrator/projects/my-project.yaml
name: My AI Project
description: Building an AI assistant
path: /home/user/projects/my-project

default_provider: claude_code

agent_mappings:
  CODE: developer
  REVIEW: reviewer
  TEST: tester
  ANALYZE: researcher

workflows:
  - main-development
  - testing-pipeline
```

---

## 2️⃣ LAYER 2: WORKFLOW (Definition)

### Das Dual-System Problem LÖSEN

**Aktueller Zustand**: Zwei parallele Systeme
- `workflows` Tabelle (ReactFlow JSON)
- `BPMNProcess` (in-memory)

**Lösung**: BPMN als Single Source of Truth

```python
class Workflow(BaseModel):
    """Workflow definition - BPMN as source of truth."""

    # Identity
    id: str                    # "workflow-xyz"
    project_id: str           # Belongs to project
    name: str
    version: int = 1

    # BPMN Process (Definition)
    bpmn: BPMNProcess          # Elements, edges, variables

    # Metadata
    description: Optional[str]
    tags: List[str] = []
    created_at: datetime
    updated_at: datetime
```

### Neue BPMN Node Types (Die fehlenden!)

```python
class BPMNElementType(str, Enum):
    # Existing
    START_EVENT = "startEvent"
    END_EVENT = "endEvent"
    SERVICE_TASK = "serviceTask"
    SCRIPT_TASK = "scriptTask"
    USER_TASK = "userTask"
    EXCLUSIVE_GATEWAY = "exclusiveGateway"
    PARALLEL_GATEWAY = "parallelGateway"
    INCLUSIVE_GATEWAY = "inclusiveGateway"

    # NEW - Task Orchestration Nodes
    TASK_CREATOR = "taskCreator"           # Creates tasks from workflow
    TASK_ORCHESTRATOR = "taskOrchestrator"   # Coordinates task completion
```

### TASK_CREATOR Node

```python
@dataclass
class TaskCreatorNode(BPMNTask):
    """Creates task records in the database."""

    # Task Template
    task_type: str              # "CODE", "REVIEW", "TEST"
    title_template: str         # "Implement {feature}"
    description_template: str    # Jinja2 template

    # Agent Resolution
    required_agent_profile: Optional[str] = None

    # Task Configuration
    priority: int = 0
    dependencies: List[str] = field(default_factory=list)

    # Multi-Task Creation
    split_strategy: str = "sequential"  # sequential, parallel, independent
    split_count: int = 1
```

### TASK_ORCHESTRATOR Node

```python
@dataclass
class TaskOrchestratorNode(BPMNTask):
    """Waits for tasks to complete and collects results."""

    # Which tasks to wait for
    wait_for_tasks: List[str] = field(default_factory=list)
    wait_mode: str = "all"      # all, any, quorum, none

    # Output Mapping
    output_variable: str = ""    # Store results in variable

    # Timeout
    timeout_seconds: int = 3600

    # On Failure
    on_failure: str = "fail"     # fail, continue, skip
```

### Workflow Versioning

```sql
CREATE TABLE workflow_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot TEXT NOT NULL,       -- Complete BPMN JSON
    change_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,

    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    UNIQUE(workflow_id, version)
);

-- Auto-version trigger
CREATE TRIGGER workflow_version_trigger
AFTER UPDATE ON workflows
BEGIN
    INSERT INTO workflow_versions (workflow_id, version, snapshot, change_description)
    VALUES (NEW.id, NEW.version, NEW.config, 'Auto-version');
END;
```

---

## 3️⃣ LAYER 3: SESSION (Execution)

### Session State Machine (KLAR DEFINIERT)

```python
class SessionStatus(str, Enum):
    """Session lifecycle states."""
    INITIALIZING = "initializing"   # Session created, workflow loading
    READY = "ready"                 # Workflow loaded, ready to start
    STARTING = "starting"           # Agents being spawned
    RUNNING = "running"             # At least one agent active
    WAITING = "waiting"             # Waiting for gateway/agent completion
    COMPLETED = "completed"         # All terminal nodes reached
    FAILED = "failed"               # Error occurred
    CANCELLED = "cancelled"         # User cancelled
    TIMEOUT = "timeout"             # Execution timeout
```

### Session Model (PERSISTIERT!)

```python
class Session(BaseModel):
    """A workflow execution instance - FULLY PERSISTED."""

    # Identity
    session_name: str           # "sess-abc123" (also tmux session name)
    project_id: str
    workflow_id: str
    workflow_version: int        # Which version was used

    # State Machine
    status: SessionStatus = SessionStatus.INITIALIZING

    # Execution State (IN DATABASE, not memory!)
    tokens: Dict[str, TokenData] = {}     # Active tokens
    variables: Dict[str, Any] = {}         # Runtime variables
    node_states: Dict[str, NodeState] = {}  # Node execution state

    # Lifecycle
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Error Tracking
    error: Optional[str] = None
    failed_node_id: Optional[str] = None
```

### Database Schema für Sessions

```sql
CREATE TABLE sessions (
    session_name TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    workflow_version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'initializing',

    -- Persisted Execution State
    tokens TEXT,                   -- JSON: {token_id: {element_id, state, data}}
    variables TEXT,                -- JSON: {key: value}
    node_states TEXT,              -- JSON: {node_id: {status, terminal_id}}

    -- Lifecycle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    timeout_at TIMESTAMP,

    -- Error Handling
    error TEXT,
    failed_node_id TEXT,

    -- Statistics
    terminals_spawned INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,

    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_workflow ON sessions(workflow_id);
```

### Session Orchestration Service

```python
class SessionOrchestrator:
    """Manages complete session lifecycle."""

    def __init__(self, db: Database, agent_resolver: AgentResolver):
        self.db = db
        self.agent_resolver = agent_resolver
        self.event_bus = EventBus()

    async def create_session(
        self,
        project_id: str,
        workflow_id: str
    ) -> Session:
        """Create new session from workflow."""
        # 1. Load workflow with version
        workflow = self.db.get_workflow(workflow_id)

        # 2. Generate session name
        session_name = f"sess-{generate_id()}"

        # 3. Initialize session record
        session = Session(
            session_name=session_name,
            project_id=project_id,
            workflow_id=workflow_id,
            workflow_version=workflow.version,
            status=SessionStatus.READY
        )
        self.db.create_session(session)

        # 4. Create tmux session (empty initially)
        tmux_client.create_session(session_name)

        return session

    async def start_session(self, session_name: str) -> None:
        """Start BPMN execution."""
        session = self.db.get_session(session_name)
        session.status = SessionStatus.STARTING
        session.started_at = datetime.now()
        self.db.update_session(session)

        # Load BPMN process
        workflow = self.db.get_workflow(session.workflow_id)
        bpmn = BPMNProcess.from_json(workflow.bpmn_json)

        # Create execution engine
        engine = BPMNExecutionEngine(
            process=bpmn,
            session_name=session_name,
            event_callback=self._on_bpmn_event
        )

        # Start token advancement loop
        await self._execution_loop(session_name, engine)

    async def _execution_loop(
        self,
        session_name: str,
        engine: BPMNExecutionEngine
    ) -> None:
        """Main execution loop - advances tokens until completion."""
        session = self.db.get_session(session_name)
        session.status = SessionStatus.RUNNING
        self.db.update_session(session)

        while True:
            # 1. Advance tokens
            advanced = engine.advance_tokens()

            # 2. Persist token state
            self.db.update_session_tokens(
                session_name,
                engine.get_tokens()
            )

            # 3. Check for task creator/orchestrator nodes
            for token in engine.get_active_tokens():
                element = engine.get_element(token.current_element_id)

                if isinstance(element, TaskCreatorNode):
                    await self._handle_task_creator(session_name, element, token)

                elif isinstance(element, TaskOrchestratorNode):
                    await self._handle_task_orchestrator(session_name, element, token)

            # 4. Check completion
            if engine.is_complete():
                session.status = SessionStatus.COMPLETED
                session.completed_at = datetime.now()
                self.db.update_session(session)
                break

            # 5. Check timeout
            if self._check_timeout(session):
                session.status = SessionStatus.TIMEOUT
                self.db.update_session(session)
                break

            await asyncio.sleep(0.5)

    async def _handle_task_creator(
        self,
        session_name: str,
        node: TaskCreatorNode,
        token: Token
    ) -> None:
        """Create tasks from TaskCreator node."""
        session = self.db.get_session(session_name)

        # Resolve agent for task
        agent_profile = self.agent_resolver.resolve_for_task(
            task_type=node.task_type,
            project_id=session.project_id
        )

        # Create task record
        task = Task(
            id=f"task-{generate_id()}",
            session_name=session_name,
            task_type=node.task_type,
            title=self._render_template(node.title_template, token.data),
            description=self._render_template(node.description_template, token.data),
            required_agent_profile=agent_profile,
            priority=node.priority,
            status=TaskStatus.PENDING
        )
        self.db.create_task(task)

        # Spawn terminal for agent
        terminal = await self._spawn_agent(
            session_name=session_name,
            agent_profile=agent_profile,
            task_id=task.id
        )

        # Update token
        token.data['task_id'] = task.id
        token.data['terminal_id'] = terminal.id

    async def _handle_task_orchestrator(
        self,
        session_name: str,
        node: TaskOrchestratorNode,
        token: Token
    ) -> None:
        """Wait for tasks to complete."""
        session = self.db.get_session(session_name)

        # Get tasks we're waiting for
        tasks = self.db.get_tasks_by_ids(node.wait_for_tasks)

        # Wait for completion
        while True:
            pending = [t for t in tasks if t.status != TaskStatus.COMPLETED]

            if not pending:
                # All done - collect results
                results = {t.id: t.get_result() for t in tasks}
                token.data[node.output_variable] = results
                token.status = TokenStatus.CONSUMED
                break

            if node.timeout_seconds:
                # Check timeout
                elapsed = (datetime.now() - session.started_at).total_seconds()
                if elapsed > node.timeout_seconds:
                    raise TimeoutError(f"TaskOrchestrator timeout")

            await asyncio.sleep(1)
```

---

## 4️⃣ LAYER 4: AGENTS (Terminals)

### Agent Resolution Chain (KLAR & EINFACH)

```python
class AgentResolver:
    """Centralized agent resolution with clear fallback chain."""

    def resolve_for_task(
        self,
        task_type: str,
        project_id: str,
        explicit_agent: Optional[str] = None
    ) -> str:
        """
        Resolve agent profile for task.

        Priority Chain:
        1. Explicit agent in workflow/task
        2. Project-level agent_mappings
        3. Global default mappings
        4. Provider default agent
        """

        # 1. Explicit override
        if explicit_agent:
            if self._agent_exists(explicit_agent):
                return explicit_agent
            raise ValueError(f"Explicit agent '{explicit_agent}' not found")

        # 2. Project mappings
        project = self.db.get_project(project_id)
        mapped = project.agent_mappings.get(task_type)
        if mapped and self._agent_exists(mapped):
            return mapped

        # 3. Global defaults
        mapped = self.DEFAULT_MAPPINGS.get(task_type)
        if mapped and self._agent_exists(mapped):
            return mapped

        # 4. Provider default (last resort)
        return self._get_default_agent_for_provider()
```

### Terminal Lifecycle

```python
class TerminalLifecycle:
    """Manages terminal creation, monitoring, and cleanup."""

    async def spawn_terminal(
        self,
        session_name: str,
        agent_profile: str,
        task_id: str
    ) -> Terminal:
        """Spawn new terminal for agent."""

        # 1. Load agent profile
        profile = load_agent_profile(agent_profile)

        # 2. Check for existing terminal in session
        existing = self.db.get_terminal_by_session_and_agent(
            session_name, agent_profile
        )
        if existing and self._is_terminal_healthy(existing):
            return existing

        # 3. Create new terminal
        terminal_id = f"term-{generate_id()}"

        # 4. Create tmux window
        tmux_client.create_window(
            session_name=session_name,
            window_name=terminal_id,
            terminal_id=terminal_id
        )

        # 5. Create provider
        provider = provider_manager.create_provider(
            provider_type=profile.default_provider,
            terminal_id=terminal_id,
            session_name=session_name,
            agent_profile=agent_profile
        )

        # 6. Start health monitor
        asyncio.create_task(self._monitor_terminal_health(terminal_id))

        return terminal

    async def _monitor_terminal_health(self, terminal_id: str):
        """Monitor terminal and detect crashes."""
        while True:
            try:
                # Check if tmux pane exists
                if not tmux_client.pane_exists(terminal_id):
                    await self._handle_terminal_death(terminal_id)
                    break

                # Check provider status
                provider = provider_manager.get_provider(terminal_id)
                if provider.get_status() == TerminalStatus.ERROR:
                    await self._handle_terminal_error(terminal_id)
                    break

                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Health check failed for {terminal_id}: {e}")
```

---

## 🔄 DER GANZE ABLAUF (Step-by-Step)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Select Project + Workflow                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. SESSION CREATION                                               │
│    POST /sessions {project_id, workflow_id}                       │
│    ├─ Load workflow (BPMN)                                         │
│    ├─ Generate session_name                                        │
│    ├─ Create session record (DB)                                    │
│    └─ Create empty tmux session                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SESSION START                                                   │
│    POST /sessions/{session_name}/start                              │
│    ├─ Initialize BPMNExecutionEngine                                │
│    ├─ Create initial token at StartEvent                            │
│    └─ Start execution loop                                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. TOKEN EXECUTION LOOP                                           │
│    while not complete:                                              │
│    ├─ advance_tokens()                                             │
│    ├─ persist token state to DB                                    │
│    ├─ For each active token:                                       │
│    │   ├─ If TASK_CREATOR: Create tasks, spawn agents          │
│    │   ├─ If TASK_ORCHESTRATOR: Wait for task completion         │
│    │   └─ If SERVICE_TASK: Spawn agent directly                  │
│    ├─ Check completion                                              │
│    └─ sleep 0.5s                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. AGENT EXECUTION (Parallel)                                      │
│    For each spawned terminal:                                       │
│    ├─ Provider.initialize(agent_profile)                            │
│    ├─ Agent processes task                                          │
│    ├─ Provider sends completion signal                              │
│    ├─ Task status updated to COMPLETED                              │
│    └─ Event published to session                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. COMPLETION                                                     │
│    All tokens consumed → EndEvent reached                           │
│    ├─ Session status = COMPLETED                                    │
│    ├─ Collect results from variables                                │
│    └─ Cleanup terminals (optional - keep for debugging)            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚨 KRITISCHE PROBLEME & LÖSUNGEN

### Problem 1: In-Memory Workflow State
**Aktuell**: `WorkflowExecutionState` ist nur im Memory
**Problem**: Server Restart = Alles verloren
**Lösung**: Token-Execution State in DB persistieren

### Problem 2: Keine Session State Machine
**Aktuell**: Session hat nur `session_name` (String)
**Problem**: Kein Lifecycle-Tracking
**Lösung**: `SessionStatus` Enum mit klaren Transitions

### Problem 3: Kein BPMN Token Execution
**Aktuell**: `BPMNExecutionEngine` existiert aber wird nicht genutzt
**Problem**: Keine Gateway-Semantik, keine Parallel-Koordination
**Lösung**: Engine in Session Orchestrator integrieren

### Problem 4: Kein Automatisches Agent Resolution
**Aktuell**: Agent muss immer explizit angegeben werden
**Problem**: Keine Task-Type → Agent Mapping
**Lösung**: `AgentResolver` Service mit Fallback-Chain

### Problem 5: Orphaned Terminals
**Aktuell**: Provider nicht persistiert
**Problem**: Server Restart = Zombies
**Lösung**: Provider-Zustand in DB oder Recovery-Mechanismus

---

## 📁 IMPLEMENTIERUNGS-REIHENFOLGE

### Phase 1: Foundation (1-2 Tage)
- [ ] `projects` Tabelle erstellen
- [ ] `Project` Model implementieren
- [ ] `sessions` Tabelle restructure (mit Status)
- [ ] Alembic für Migrations setup

### Phase 2: Agent Resolution (2-3 Tage)
- [ ] `AgentResolver` Service
- [ ] Project-level agent_mappings
- [ ] Global default mappings
- [ ] Unit Tests für Resolution Chain

### Phase 3: Workflow Enhancements (2-3 Tage)
- [ ] `TASK_CREATOR` Node Type
- [ ] `TASK_ORCHESTRATOR` Node Type
- [ ] Workflow Versioning Table
- [ ] BPMN Converter Updates

### Phase 4: Session Orchestration (3-4 Tage)
- [ ] `SessionOrchestrator` Service
- [ ] Token Execution Loop
- [ ] Event Bus für Completion
- [ ] Health Monitoring

### Phase 5: Terminal Management (2-3 Tage)
- [ ] `TerminalLifecycle` Service
- [ ] Health Monitoring
- [ ] Crash Recovery
- [ ] Graceful Cleanup

### Phase 6: API & Frontend (2-3 Tage)
- [ ] Project Endpoints
- [ ] Enhanced Session Endpoints
- [ ] Frontend Types Update
- [ ] UI für Status Monitoring

**Gesamt: 14-20 Tage**

---

## 🎨 VORGESCHLAGEN FÜR EINEN SAUBEREN AUFBAU

### Simplification 1: Single Session Table

Statt `session_workflows` + `sessions` Trennung:

```sql
CREATE TABLE sessions (
    session_name TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,

    -- Execution state (persisted)
    tokens JSON,
    variables JSON,
    node_states JSON,

    -- Lifecycle
    created_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

### Simplification 2: Unified Task Model

Statt Tasks und Terminals separat zu tracken:

```python
class Task(BaseModel):
    """A task is the unit of work."""

    # Identity
    id: str
    session_name: str
    workflow_node_id: str  # Which node created this

    # Agent Assignment
    agent_profile: str
    terminal_id: Optional[str]  # Assigned terminal

    # State
    status: TaskStatus  # PENDING, ASSIGNED, RUNNING, COMPLETED, FAILED
    test_state: TestState  # none, pending, red, green

    # Results
    result: Optional[Dict[str, Any]]
    error: Optional[str]
```

### Simplification 3: Event-Driven Coordination

Statt Polling:

```python
class EventBus:
    """Simple pub/sub for session events."""

    async def publish(self, session_name: str, event: SessionEvent):
        """Publish to all subscribers."""
        subscribers = self._subscribers.get(session_name, [])
        for sub in subscribers:
            await sub.handle_event(event)

    async def subscribe(self, session_name: str, handler: EventHandler):
        """Subscribe to session events."""
        self._subscribers[session_name].append(handler)
```

---

## 📊 SUMMARY

| Layer | Status | Action Required |
|-------|--------|-----------------|
| **PROJECT** | ❌ Fehlt | Neu implementieren |
| **WORKFLOW** | ⚠️ Fragmentiert | BPMN als Single Source, Versioning hinzu |
| **SESSION** | ❌ Fragmentiert | State Machine + Persistenz |
| **AGENTS** | ⚠️ Manuell | Auto-Resolution + Lifecycle |

Der verbesserte Plan reduziert Komplexität durch:
1. **Klare Verantwortlichkeiten** pro Layer
2. **Persistenz überall** (kein In-Memory State)
3. **Event-Driven** statt Polling
4. **Single Source of Truth** pro Layer
