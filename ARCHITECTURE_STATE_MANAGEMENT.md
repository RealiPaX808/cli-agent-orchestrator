# State Management Architecture Design

## Problem Statement

We need a database-driven state management system that:
1. Tracks terminal states (initial_prompt, current_context, variables)
2. Manages tasks with IDs, descriptions, and assignments
3. Enables parallel coder agent execution
4. Links everything to configured workflows
5. Replaces hardcoded values (like initial_prompt in .md files) with dynamic DB lookups

## Current State (Analyzed from Codebase)

### Existing Tables
```
terminals          - Terminal metadata (id, tmux_session, tmux_window, provider, agent_profile)
inbox              - Inter-terminal messaging (sender_id, receiver_id, message, status)
flows              - Scheduled workflows (name, schedule, agent_profile, provider)
workflows          - Workflow definitions (id, name, description, config)
workflow_nodes     - BPMN workflow nodes (id, workflow_id, node_data, position)
workflow_edges     - BPMN workflow edges (id, workflow_id, source, target)
session_workflows  - Session-to-workflow mapping (session_name, workflow_id)
```

### Current Flow
1. User calls `cao launch --agents code_supervisor`
2. API creates terminal via `terminal_service.create_terminal()`
3. Provider loads `agent_profile` from `.md` file (includes system_prompt + initial_prompt)
4. Provider calls `initialize()` which sends command to tmux
5. Terminal starts and waits for user input

### Limitations
- Initial prompt is **hardcoded** in `.md` files (not dynamic)
- No concept of "task" with unique ID
- No state tracking per terminal (context, variables, history)
- No way to assign multiple tasks to multiple coder agents in parallel
- Workflow execution state not persisted

## Proposed Architecture

### 1. Terminal State Management

**Purpose:** Track dynamic state for each terminal instance

```sql
CREATE TABLE terminal_states (
    terminal_id TEXT PRIMARY KEY,                    -- Links to terminals.id
    context_data TEXT,                               -- JSON: current working context
    variables TEXT,                                  -- JSON: key-value pairs for templating
    initial_prompt TEXT,                             -- Dynamic initial prompt (overrides .md)
    last_checkpoint TEXT,                            -- JSON: last known good state
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);
```

**Use Cases:**
- Load `initial_prompt` from DB instead of `.md` file
- Store context like "currently working on task T-123"
- Track variables like `{project_path: "/home/user/proj", branch: "feature/x"}`
- Checkpoint state before risky operations

**Example:**
```json
{
  "terminal_id": "abc123",
  "context_data": {
    "current_task_id": "T-456",
    "working_directory": "/tmp/task-456",
    "assigned_by": "supervisor-xyz"
  },
  "variables": {
    "project_root": "/home/user/project",
    "test_framework": "pytest"
  },
  "initial_prompt": "You are Developer Agent #3. You will work on tasks assigned to you via the task queue. Focus on writing clean, tested code.",
  "last_checkpoint": {
    "timestamp": "2026-01-11T15:30:00Z",
    "status": "IDLE",
    "last_output": "All tests passing"
  }
}
```

### 2. Task Management

**Purpose:** Define, track, and assign units of work

```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,                             -- T-001, T-002, etc.
    workflow_id TEXT,                                -- Links to workflows.id (optional)
    title TEXT NOT NULL,                             -- "Implement user authentication"
    description TEXT NOT NULL,                       -- Full task specification
    task_type TEXT NOT NULL,                         -- "CODE", "REVIEW", "TEST", "ANALYZE"
    priority INTEGER DEFAULT 0,                      -- Higher = more urgent
    status TEXT NOT NULL,                            -- "PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED"
    dependencies TEXT,                               -- JSON: ["T-001", "T-002"] - tasks that must complete first
    metadata TEXT,                                   -- JSON: task-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
);
```

```sql
CREATE TABLE task_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,                           -- Links to tasks.id
    terminal_id TEXT NOT NULL,                       -- Links to terminals.id
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,                            -- When agent started working
    completed_at TIMESTAMP,                          -- When agent finished
    status TEXT NOT NULL,                            -- "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "FAILED"
    result TEXT,                                     -- JSON: task output/artifacts
    error_message TEXT,                              -- If failed, why?
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE,
    UNIQUE(task_id, terminal_id)                     -- One assignment per terminal per task
);
```

**Use Cases:**
- Supervisor creates tasks: `create_task("CODE", "Implement login API", {...})`
- Task creator assigns to agents: `assign_task("T-123", "terminal-abc")`
- Parallel execution: Assign T-001 to dev1, T-002 to dev2, T-003 to dev3 simultaneously
- Dependency tracking: T-004 can't start until T-001 and T-002 are COMPLETED
- Workflow integration: All tasks link to a workflow_id for traceability

**Example:**
```json
{
  "id": "T-123",
  "workflow_id": "WF-001",
  "title": "Implement factorial function",
  "description": "Create a recursive factorial function in Python with proper error handling for negative numbers",
  "task_type": "CODE",
  "priority": 5,
  "status": "IN_PROGRESS",
  "dependencies": [],
  "metadata": {
    "language": "python",
    "file_path": "/tmp/factorial.py",
    "test_required": true,
    "estimated_time_minutes": 15
  }
}
```

### 3. Workflow Execution State

**Purpose:** Track workflow execution progress

```sql
CREATE TABLE workflow_executions (
    id TEXT PRIMARY KEY,                             -- exec-uuid
    workflow_id TEXT NOT NULL,                       -- Links to workflows.id
    session_name TEXT NOT NULL,                      -- Links to session_workflows.session_name
    status TEXT NOT NULL,                            -- "RUNNING", "PAUSED", "COMPLETED", "FAILED"
    current_node_id TEXT,                            -- Which BPMN node is active
    execution_data TEXT,                             -- JSON: runtime variables, token positions
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
```

**Use Cases:**
- Resume interrupted workflows
- Track which BPMN node is currently executing
- Store runtime variables across workflow execution
- Audit trail of workflow runs

### 4. Task Results & Artifacts

**Purpose:** Store outputs from completed tasks

```sql
CREATE TABLE task_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,                           -- Links to tasks.id
    artifact_type TEXT NOT NULL,                     -- "CODE", "LOG", "TEST_RESULT", "ERROR"
    file_path TEXT,                                  -- Where artifact is stored
    content TEXT,                                    -- Artifact content (if small)
    content_hash TEXT,                               -- SHA256 for integrity
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**Use Cases:**
- Retrieve code written by coder agent for task T-123
- Get test results for verification
- Audit what was produced

## Integration Points

### A. Provider Initialization (claude_code.py, q_cli.py, etc.)

**Current:**
```python
def initialize(self):
    profile = load_agent_profile(self._agent_profile)
    initial_prompt = profile.initial_prompt  # From .md file
    # Send to terminal...
```

**Proposed:**
```python
def initialize(self):
    # 1. Load profile for system_prompt (still from .md)
    profile = load_agent_profile(self._agent_profile)
    
    # 2. Check if terminal has custom initial_prompt in DB
    state = get_terminal_state(self.terminal_id)
    initial_prompt = state.initial_prompt if state else profile.initial_prompt
    
    # 3. If initial_prompt exists, send it
    if initial_prompt:
        command_parts.append(shlex.quote(initial_prompt))
    
    # Send command...
```

### B. Task Assignment Flow

**Scenario:** Supervisor wants to assign coding task to developer

```python
# 1. Create task
task_id = create_task(
    workflow_id="WF-001",
    title="Implement factorial",
    description="...",
    task_type="CODE",
    priority=5
)

# 2. Find available developer terminal (or create new one)
dev_terminal = find_or_create_terminal(
    agent_profile="developer",
    session_name="cao-my-project"
)

# 3. Set terminal state with task context
update_terminal_state(
    terminal_id=dev_terminal.id,
    context_data={
        "current_task_id": task_id,
        "working_directory": f"/tmp/task-{task_id}"
    },
    initial_prompt=f"You have been assigned task {task_id}. Read the task description and begin implementation."
)

# 4. Assign task
assign_task(task_id, dev_terminal.id)

# 5. Send task description to terminal
send_message(dev_terminal.id, f"Please work on task {task_id}:\n{task_description}")
```

### C. Parallel Coder Execution

**Scenario:** Supervisor has 3 independent tasks

```python
tasks = [
    {"id": "T-001", "desc": "Implement login API"},
    {"id": "T-002", "desc": "Implement logout API"},
    {"id": "T-003", "desc": "Implement password reset API"}
]

# Launch 3 developer terminals in parallel
for task in tasks:
    # Create terminal
    dev = create_terminal(
        provider="claude_code",
        agent_profile="developer",
        session_name="cao-parallel-dev",
        new_session=False  # Add to existing session as windows
    )
    
    # Set state
    update_terminal_state(
        terminal_id=dev.id,
        context_data={"current_task_id": task["id"]},
        initial_prompt=f"You are developer assigned to {task['id']}. Begin when ready."
    )
    
    # Assign task
    assign_task(task["id"], dev.id)
    
    # Send task
    send_input(dev.id, f"Implement: {task['desc']}")

# All 3 developers now work in parallel
# Supervisor can poll task_assignments to check progress
```

### D. Workflow Integration

**Scenario:** BPMN workflow has "Parallel Coding" gateway

```xml
<parallelGateway id="split-tasks" gatewayDirection="Diverging" />
<serviceTask id="code-task-1" name="Developer 1" />
<serviceTask id="code-task-2" name="Developer 2" />
<serviceTask id="code-task-3" name="Developer 3" />
<parallelGateway id="join-tasks" gatewayDirection="Converging" />
```

**Execution:**
1. Workflow engine reaches `split-tasks`
2. Creates 3 tokens (one per outgoing sequence flow)
3. Each token executes a `serviceTask` which:
   - Creates a task in `tasks` table
   - Assigns to a developer terminal
   - Waits for completion
4. When all 3 tasks complete, tokens converge at `join-tasks`
5. Workflow continues

**Database tracking:**
```python
# workflow_executions.execution_data
{
  "tokens": [
    {"id": "token-1", "position": "code-task-1", "status": "IN_PROGRESS"},
    {"id": "token-2", "position": "code-task-2", "status": "COMPLETED"},
    {"id": "token-3", "position": "code-task-3", "status": "IN_PROGRESS"}
  ],
  "variables": {
    "task_1_result": "/tmp/task-1/output.py",
    "task_2_result": "/tmp/task-2/output.py"
  }
}
```

## Migration Strategy

### Phase 1: Add New Tables (Non-Breaking)
1. Add `terminal_states` table
2. Add `tasks`, `task_assignments`, `task_artifacts` tables
3. Add `workflow_executions` table
4. Existing code continues to work (no breaking changes)

### Phase 2: Update Providers (Backward Compatible)
1. Modify `initialize()` to check `terminal_states` for `initial_prompt`
2. Fallback to `.md` file if no state exists
3. Existing sessions without states work normally

### Phase 3: Task Service Implementation
1. Create `task_service.py` with CRUD operations
2. Add API endpoints: `POST /tasks`, `GET /tasks/{id}`, `PUT /tasks/{id}/assign`
3. No impact on existing terminal/session management

### Phase 4: Workflow Engine Integration
1. Update BPMN execution engine to create tasks for `serviceTask` nodes
2. Track execution state in `workflow_executions`
3. Existing workflows continue to work

## Benefits

1. **Dynamic Configuration:** Initial prompts can be customized per terminal instance
2. **Task Traceability:** Every unit of work has a unique ID and full history
3. **Parallel Execution:** Multiple coders can work on independent tasks simultaneously
4. **Workflow Integration:** Tasks link to BPMN workflows for orchestration
5. **State Persistence:** System can recover from crashes by reading DB state
6. **Audit Trail:** Full history of who did what, when, and what was produced

## Example End-to-End Flow

**User Request:** "Implement a REST API with 5 endpoints"

1. **Supervisor** creates workflow execution
2. **Task Creator** analyzes request and creates 5 tasks in DB:
   ```
   T-001: Implement GET /users
   T-002: Implement POST /users
   T-003: Implement PUT /users/:id
   T-004: Implement DELETE /users/:id
   T-005: Implement GET /users/:id
   ```
3. **Orchestrator** launches 5 developer terminals in parallel session
4. For each terminal:
   - Create `terminal_states` entry with `initial_prompt`
   - Assign one task via `task_assignments`
   - Send task description
5. **Developers** work in parallel, writing code
6. **Orchestrator** monitors `task_assignments.status`
7. When all 5 tasks reach `COMPLETED`:
   - Collect artifacts from `task_artifacts`
   - Handoff to **Reviewer** terminal for code review
8. **Reviewer** checks all 5 implementations
9. If approved, mark workflow execution as `COMPLETED`

## Open Questions

1. **Task Granularity:** How fine-grained should tasks be? File-level? Function-level?
2. **Task Dependencies:** Should we support DAG execution (like Airflow)?
3. **Resource Limits:** How many parallel coder terminals should we allow?
4. **State Cleanup:** When do we garbage collect old terminal_states and completed tasks?
5. **Conflict Resolution:** What if two terminals modify the same file?

## Next Steps

1. Implement database models in `database.py`
2. Create migration script to add new tables
3. Update `claude_code.py` to read `initial_prompt` from DB
4. Create `task_service.py` with basic CRUD
5. Add REST API endpoints for task management
6. Test with simple 2-task parallel execution scenario
