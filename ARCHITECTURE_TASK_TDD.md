# Task & Agent Architecture - TDD-Enabled Design

## Status: Design Phase

---

## 1. Current State Analysis

### 1.1 Agent System (Markdown-based)

Agenten werden als Markdown-Dateien mit YAML-Frontmatter gespeichert:

```yaml
---
name: developer
description: Developer Agent
initial_prompt: "..."
mcpServers:
  cao-mcp-server:
    type: stdio
    command: uvx
    args: ["--from", "...", "cao-mcp-server"]
---

# DEVELOPER AGENT
[Rest is the system prompt]
```

**Agent Store Location:** `src/cli_agent_orchestrator/agent_store/*.md`

**Key Insight:** Agenten sind dynamisch erweiterbar - einfach eine neue `.md` Datei erstellen!

### 1.2 Current Task Model

```python
class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True)  # T-001
    workflow_id = Column(String)             # Optional
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    task_type = Column(String)               # "CODE", "REVIEW", "TEST"
    priority = Column(Integer, default=0)
    status = Column(String)                  # "PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED"
    dependencies = Column(String)            # JSON: ["T-001", "T-002"]
    task_metadata = Column(String)           # JSON: additional data
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    completed_at = Column(DateTime, nullable=True)
```

**Missing:** TDD state (red/green), last output/error storage

### 1.3 Current TaskAssignment Model

```python
class TaskAssignmentModel(Base):
    __tablename__ = "task_assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String, nullable=False)   # Links to tasks.id
    terminal_id = Column(String, nullable=False)  # Links to terminals.id
    assigned_at = Column(DateTime)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String)  # "ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED"
    result = Column(String, nullable=True)      # JSON: output
    error_message = Column(String, nullable=True)
```

**Missing:** Agent assignment tracking, test state tracking

---

## 2. Enhanced Task Architecture

### 2.1 Extended Task Model with TDD Support

```python
# src/cli_agent_orchestrator/models/task.py

from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TaskType(str, Enum):
    CODE = "CODE"
    REVIEW = "REVIEW"
    TEST = "TEST"
    ANALYZE = "ANALYZE"
    DOCUMENT = "DOCUMENT"
    REFACTOR = "REFACTOR"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class TestState(str, Enum):
    """TDD Test State for each task."""
    NONE = "none"          # Not a test-related task
    PENDING = "pending"    # Test not yet written/run
    RED = "red"           # Test failing / implementation needed
    GREEN = "green"       # Test passing / implementation complete
    SKIPPED = "skipped"   # Test was skipped


class Task(BaseModel):
    """Enhanced Task model with TDD support."""
    id: str
    project_id: Optional[str] = None
    workflow_id: Optional[str] = None
    title: str
    description: str
    task_type: TaskType
    priority: int = 0

    # Status tracking
    status: TaskStatus = TaskStatus.PENDING

    # TDD Support
    test_state: TestState = TestState.NONE
    last_red_output: Optional[str] = None       # Last test failure output
    last_red_error: Optional[str] = None        # Last test error message
    last_green_timestamp: Optional[datetime] = None

    # Dependencies
    dependencies: Optional[List[str]] = None   # Task IDs this task depends on

    # Agent Assignment (NEW - explicit agent request)
    required_agent_profile: Optional[str] = None  # "developer", "reviewer", etc.
    assigned_agent_profile: Optional[str] = None   # Actually assigned agent

    # Metadata
    metadata: Optional[Dict[str, Any]] = None     # Extended metadata

    # Timestamps
    created_at: datetime
    updated_at: datetime
    assigned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
```

### 2.2 Extended TaskAssignment Model

```python
class TaskAssignment(BaseModel):
    """Enhanced TaskAssignment with agent tracking."""
    id: int
    task_id: str
    terminal_id: str

    # Agent tracking
    agent_profile: Optional[str] = None       # Agent assigned to this task
    agent_name: Optional[str] = None          # Display name from agent.md

    # Timing
    assigned_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Status
    status: TaskStatus = TaskStatus.ASSIGNED

    # Results
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    # TDD Support (assignment level)
    test_state_at_start: TestState = TestState.NONE
    test_state_at_end: TestState = TestState.NONE
```

---

## 3. Database Schema Changes

### 3.1 Enhanced Tasks Table

```sql
-- Add new columns to existing tasks table
ALTER TABLE tasks ADD COLUMN project_id TEXT;
ALTER TABLE tasks ADD COLUMN required_agent_profile TEXT;
ALTER TABLE tasks ADD COLUMN assigned_agent_profile TEXT;

-- TDD Support Columns
ALTER TABLE tasks ADD COLUMN test_state TEXT DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN last_red_output TEXT;
ALTER TABLE tasks ADD COLUMN last_red_error TEXT;
ALTER TABLE tasks ADD COLUMN last_green_timestamp TIMESTAMP;

-- Better timestamp tracking
ALTER TABLE tasks ADD COLUMN assigned_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;

-- Indexes for TDD queries
CREATE INDEX idx_tasks_test_state ON tasks(test_state);
CREATE INDEX idx_tasks_agent_profile ON tasks(assigned_agent_profile);
```

### 3.2 Enhanced Task Assignments Table

```sql
ALTER TABLE task_assignments ADD COLUMN agent_profile TEXT;
ALTER TABLE task_assignments ADD COLUMN agent_name TEXT;

-- TDD tracking at assignment level
ALTER TABLE task_assignments ADD COLUMN test_state_at_start TEXT DEFAULT 'none';
ALTER TABLE task_assignments ADD COLUMN test_state_at_end TEXT DEFAULT 'none';

CREATE INDEX idx_assignments_agent ON task_assignments(agent_profile);
```

---

## 4. Agent Assignment Strategy

### 4.1 Agent Profile Resolution

```python
# src/cli_agent_orchestrator/services/agent_resolver.py

from pathlib import Path
import yaml
from typing import Dict, Optional, List


class AgentProfile:
    """Represents a loaded agent profile from .md file."""

    def __init__(self, name: str, description: str, initial_prompt: Optional[str],
                 mcp_servers: Dict, system_prompt: str, file_path: Path):
        self.name = name
        self.description = description
        self.initial_prompt = initial_prompt
        self.mcp_servers = mcp_servers
        self.system_prompt = system_prompt
        self.file_path = file_path

    @property
    def display_name(self) -> str:
        return self.name.replace("_", " ").title()


class AgentResolver:
    """Dynamically loads and resolves agent profiles from .md files."""

    def __init__(self, agent_store_dir: Path):
        self.agent_store_dir = agent_store_dir
        self._cache: Dict[str, AgentProfile] = {}

    def list_available_agents(self) -> List[str]:
        """List all available agent names."""
        agents = []
        for md_file in self.agent_store_dir.glob("*.md"):
            try:
                with open(md_file) as f:
                    frontmatter = self._parse_frontmatter(f.read())
                    if frontmatter.get("name"):
                        agents.append(frontmatter["name"])
            except Exception:
                continue
        return agents

    def get_agent(self, agent_name: str) -> Optional[AgentProfile]:
        """Load agent profile by name."""
        if agent_name in self._cache:
            return self._cache[agent_name]

        md_file = self.agent_store_dir / f"{agent_name}.md"
        if not md_file.exists():
            return None

        with open(md_file) as f:
            content = f.read()

        frontmatter, system_prompt = self._parse_agent_md(content)

        profile = AgentProfile(
            name=frontmatter.get("name", agent_name),
            description=frontmatter.get("description", ""),
            initial_prompt=frontmatter.get("initial_prompt"),
            mcp_servers=frontmatter.get("mcpServers", {}),
            system_prompt=system_prompt,
            file_path=md_file
        )

        self._cache[agent_name] = profile
        return profile

    def resolve_agent_for_task(self, task: Task, available_agents: List[str]) -> str:
        """
        Resolve which agent should handle a task.

        Priority:
        1. task.required_agent_profile (explicit user request)
        2. task.task_type -> agent mapping
        3. default fallback
        """
        # 1. Explicit request
        if task.required_agent_profile:
            if task.required_agent_profile in available_agents:
                return task.required_agent_profile
            else:
                raise ValueError(f"Requested agent '{task.required_agent_profile}' not found")

        # 2. Task type mapping (configurable)
        type_mappings = {
            TaskType.CODE: "developer",
            TaskType.REVIEW: "reviewer",
            TaskType.TEST: "tester",
            TaskType.ANALYZE: "analyst",
            TaskType.DOCUMENT: "documenter",
            TaskType.REFACTOR: "refactorer",
        }

        mapped_agent = type_mappings.get(task.task_type, "developer")

        # 3. Fallback to available agent
        if mapped_agent in available_agents:
            return mapped_agent

        # 4. Ultimate fallback
        return available_agents[0] if available_agents else "developer"
```

### 4.2 Agent Configuration (YAML)

Agent mappings können konfiguriert werden:

```yaml
# config/agents.yaml
agent_mappings:
  CODE:
    - developer
    - fullstack_developer
    - backend_developer
  REVIEW:
    - reviewer
    - senior_reviewer
  TEST:
    - tester
    - qa_engineer

default_fallback:
  task_type: developer
  priority: 1
```

---

## 5. TDD Integration

### 5.1 Test State Transitions

```
┌─────────┐     write test      ┌─────────┐
│  NONE   │ ──────────────────> │  RED    │
└─────────┘                     └─────────┘
    ▲                               │
    │                               │ implement
    │                               ▼
└───────────                  ┌─────────┐
│            │                 │  GREEN  │
└───────────┘                 └─────────┘
      │                           │
      │                           │ test fails
      │                           ▼
      │                      ┌─────────┐
      └──────────────────────│  RED    │
          (regression)       └─────────┘
```

### 5.2 TDD Context for Agents

When a task is in **RED** state, include the failure context:

```python
def build_task_context_for_agent(task: Task) -> Dict[str, Any]:
    """Build context for agent including TDD state."""
    context = {
        "task_id": task.id,
        "title": task.title,
        "description": task.description,
        "task_type": task.task_type.value,
    }

    # Add TDD context if in RED state
    if task.test_state == TestState.RED:
        context["tdd_context"] = {
            "state": "RED",
            "last_failure": task.last_red_output,
            "last_error": task.last_red_error,
            "instruction": "The test is failing. Fix the implementation to make the test pass."
        }

    return context
```

### 5.3 Test State Update API

```python
# src/cli_agent_orchestrator/services/task_tdd_service.py

class TaskTDDService:
    """Service for managing TDD state of tasks."""

    def update_test_state(
        self,
        task_id: str,
        test_state: TestState,
        output: Optional[str] = None,
        error: Optional[str] = None
    ) -> bool:
        """Update test state for a task."""
        task = get_task(task_id)
        if not task:
            return False

        updates = {"test_state": test_state.value}

        if test_state == TestState.RED:
            updates["last_red_output"] = output
            updates["last_red_error"] = error
        elif test_state == TestState.GREEN:
            updates["last_green_timestamp"] = datetime.now().isoformat()

        return update_task(task_id, **updates)

    def get_red_tasks_for_context(self, workflow_id: str) -> List[Dict[str, Any]]:
        """Get all RED tasks for TDD context in next task."""
        tasks = list_tasks(workflow_id=workflow_id, status="IN_PROGRESS")
        return [
            {
                "id": t["id"],
                "title": t["title"],
                "last_failure": t["last_red_output"],
                "last_error": t["last_red_error"],
            }
            for t in tasks
            if t.get("test_state") == TestState.RED.value
        ]
```

---

## 6. Task Orchestrator Flow

### 6.1 Complete Assignment Flow

```
┌─────────────────┐
│ Task Creator    │ Creates tasks with required_agent_profile
│ (Workflow Node) │ ─────────────────────────────────────────┐
└─────────────────┘                                         │
                                                             ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Tasks Table    │────>│ Task Orchestr.  │────>│  Terminals      │
│  (PENDING)      │     │  (Service)      │     │  (with agents)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │ 1. Resolve agent
                               │ 2. Find/create terminal
                               │ 3. Assign task
                               ▼
                        ┌─────────────────┐
                        │ TaskAssignment  │
                        │ (ASSIGNED)      │
                        └─────────────────┘
                               │
                               │ Agent works on task
                               ▼
                        ┌─────────────────┐
                        │ TDD State Update│
                        │ (RED → GREEN)   │
                        └─────────────────┘
```

### 6.2 Agent Selection Algorithm

```python
def assign_task_to_terminal(
    task_id: str,
    available_terminals: List[Dict],
    agent_resolver: AgentResolver
) -> Dict[str, Any]:
    """
    Assign a task to the best available terminal.

    Strategy:
    1. Get task details (including required_agent_profile)
    2. Resolve which agent profile is needed
    3. Find terminal with matching agent_profile (idle)
    4. If no match, create new terminal with required agent
    5. Update task and assignment records
    """
    task = get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    # Resolve required agent
    available_agents = agent_resolver.list_available_agents()
    required_agent = agent_resolver.resolve_agent_for_task(task, available_agents)

    # Find idle terminal with matching agent
    matching_terminal = None
    for terminal in available_terminals:
        if (terminal.get("agent_profile") == required_agent
            and terminal.get("status") == "idle"):
            matching_terminal = terminal
            break

    if not matching_terminal:
        # Create new terminal with required agent
        matching_terminal = create_terminal_with_agent(
            provider="q_cli",
            agent_profile=required_agent
        )

    # Create assignment
    assignment = assign_task_to_terminal(
        task_id=task_id,
        terminal_id=matching_terminal["id"]
    )

    # Update task with assigned agent
    update_task(
        task_id=task_id,
        assigned_agent_profile=required_agent,
        status="ASSIGNED",
        assigned_at=datetime.now()
    )

    return {
        "task_id": task_id,
        "terminal_id": matching_terminal["id"],
        "agent_profile": required_agent,
        "assignment_id": assignment["id"]
    }
```

---

## 7. TypeScript Types (Frontend)

### 7.1 Enhanced Task Types

```typescript
// apps/dashboard/src/types/task.ts

export enum TaskType {
  CODE = 'CODE',
  REVIEW = 'REVIEW',
  TEST = 'TEST',
  ANALYZE = 'ANALYZE',
  DOCUMENT = 'DOCUMENT',
  REFACTOR = 'REFACTOR',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TestState {
  NONE = 'none',
  PENDING = 'pending',
  RED = 'red',
  GREEN = 'green',
  SKIPPED = 'skipped',
}

export interface Task {
  id: string;
  projectId?: string;
  workflowId?: string;
  title: string;
  description: string;
  taskType: TaskType;
  priority: number;
  status: TaskStatus;

  // TDD Support
  testState: TestState;
  lastRedOutput?: string;
  lastRedError?: string;
  lastGreenTimestamp?: string;

  // Agent Assignment
  requiredAgentProfile?: string;
  assignedAgentProfile?: string;

  // Dependencies
  dependencies?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TDDContext {
  state: TestState;
  lastFailure?: string;
  lastError?: string;
  instruction?: string;
}
```

### 7.2 Agent Types

```typescript
// apps/dashboard/src/types/agent.ts

export interface AgentProfile {
  name: string;
  displayName: string;
  description: string;
  initialPrompt?: string;
  mcpServers: Record<string, MCPServerConfig>;
  systemPrompt: string;
  filePath: string;
}

export interface MCPServerConfig {
  type: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

export interface AgentMapping {
  taskType: TaskType;
  agents: string[];  // List of agent names that can handle this task type
  priority: number;  // Higher = preferred
}
```

---

## 8. UI Components

### 8.1 Task List with TDD State

```tsx
// apps/dashboard/src/components/task/TaskListItem.tsx

interface TaskListItemProps {
  task: Task;
  onAssign: () => void;
}

export function TaskListItem({ task, onAssign }: TaskListItemProps) {
  const testStateIcon = {
    [TestState.NONE]: null,
    [TestState.PENDING]: '⏳',
    [TestState.RED]: '🔴',
    [TestState.GREEN]: '🟢',
    [TestState.SKIPPED]: '⏭️',
  }[task.testState];

  return (
    <div className={`task-item priority-${task.priority}`}>
      <div className="task-header">
        <span className="task-id">{task.id}</span>
        <span className="task-title">{task.title}</span>
        {testStateIcon && <span className="test-state" title={task.testState}>{testStateIcon}</span>}
      </div>

      {task.testState === TestState.RED && task.lastRedError && (
        <div className="tdd-failure-context">
          <details>
            <summary>Last Failure</summary>
            <pre>{task.lastRedOutput || task.lastRedError}</pre>
          </details>
        </div>
      )}

      <div className="task-meta">
        <span className="agent-badge">{task.assignedAgentProfile || 'Unassigned'}</span>
        <span className={`status status-${task.status.toLowerCase()}`}>
          {task.status}
        </span>
      </div>
    </div>
  );
}
```

---

## 9. Migration Steps

### Phase 1: Database Migration (Alembic)

```python
# migrations/versions/007_add_tdd_support_to_tasks.py

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add TDD columns
    op.add_column('tasks', sa.Column('test_state', sa.String(), nullable=False, server_default='none'))
    op.add_column('tasks', sa.Column('last_red_output', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('last_red_error', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('last_green_timestamp', sa.DateTime(), nullable=True))

    # Add agent assignment columns
    op.add_column('tasks', sa.Column('required_agent_profile', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('assigned_agent_profile', sa.String(), nullable=True))

    # Add timestamps
    op.add_column('tasks', sa.Column('assigned_at', sa.DateTime(), nullable=True))
    op.add_column('tasks', sa.Column('started_at', sa.DateTime(), nullable=True))

    # Add indexes
    op.create_index('idx_tasks_test_state', 'tasks', ['test_state'])
    op.create_index('idx_tasks_agent_profile', 'tasks', ['assigned_agent_profile'])

    # Task assignments
    op.add_column('task_assignments', sa.Column('agent_profile', sa.String(), nullable=True))
    op.add_column('task_assignments', sa.Column('agent_name', sa.String(), nullable=True))
    op.add_column('task_assignments', sa.Column('test_state_at_start', sa.String(), nullable=False, server_default='none'))
    op.add_column('task_assignments', sa.Column('test_state_at_end', sa.String(), nullable=True))

def downgrade():
    # Remove all added columns and indexes
    op.drop_index('idx_tasks_agent_profile')
    op.drop_index('idx_tasks_test_state')

    op.drop_column('task_assignments', 'test_state_at_end')
    op.drop_column('task_assignments', 'test_state_at_start')
    op.drop_column('task_assignments', 'agent_name')
    op.drop_column('task_assignments', 'agent_profile')

    op.drop_column('tasks', 'started_at')
    op.drop_column('tasks', 'assigned_at')
    op.drop_column('tasks', 'assigned_agent_profile')
    op.drop_column('tasks', 'required_agent_profile')
    op.drop_column('tasks', 'last_green_timestamp')
    op.drop_column('tasks', 'last_red_error')
    op.drop_column('tasks', 'last_red_output')
    op.drop_column('tasks', 'test_state')
```

---

## 10. Summary

### Key Features Added

1. **TDD State Tracking** - Each task has `test_state` (none/pending/red/green/skipped)
2. **Failure Context** - `last_red_output` and `last_red_error` stored for RED tasks
3. **Agent Assignment** - `required_agent_profile` and `assigned_agent_profile` for flexible routing
4. **Dynamic Agent Loading** - Agents loaded from `.md` files, extensible at runtime
5. **TDD Context Propagation** - RED task context passed to agents for next attempts

### Compatibility

- Works with **new agents** just by adding `.md` files to `agent_store/`
- **Backward compatible** - existing tasks without TDD state default to `NONE`
- **Extensible** - task type to agent mapping configurable via YAML
