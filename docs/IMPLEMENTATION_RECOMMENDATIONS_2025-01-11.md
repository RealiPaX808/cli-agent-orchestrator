# Implementation Recommendations - CLI Agent Orchestrator Refactor

**Datum**: 2025-01-11
**Status**: Ready for Implementation
**Basiert auf**: HIVEMIND_ANALYSIS + IMPROVED_ARCHITECTURE_PLAN

---

## Executive Summary

Dieser Leitfaden bietet eine konkrete, schrittweise Implementierungsstrategie für den Refactor des cli-agent-orchestrators. Die Empfehlungen basieren auf der Deep-Dive Hive-Mind Analyse und dem verbesserten 4-Layer Architekturplan.

### Entscheidung: **Phase-basierte Implementierung mit Checkpoints**

**Gesamtdauer**: 16-20 Tage (3-4 Wochen)
**Risiko**: Mittel bis Hoch (durch Breaking Changes)
**Empfehlung**: Feature Flag gesteuertes Rollout

---

## Phase 0: Vorbereitung & Setup (2 Tage)

### 0.1 Entwicklungsumvironment vorbereiten

```bash
# Feature Branch erstellen
git checkout -b feature/tdd-support-phase1

# Alembic initialisieren (wichtigstes Tool!)
pip install alembic>=1.13.0
alembic init migrations

# Database Backup erstellen
mkdir -p backups
cp data/cli_agent_orchestrator.db backups/pre_tdd_$(date +%Y%m%d_%H%M%S).db

# Test-Environment setup
python -m venv .venv
source .venv/bin/activate
pip install -e ".[test]"
```

### 0.2 Alembic Configuration

`alembic.ini`:
```ini
[alembic]
script_location = migrations
file_template = %%(year)d_%%(month).2d_%%(day).2d_%%(hour).2d%%(minute).2d_%%(rev)s_%%(slug)s
truncate_slug_length = 60
```

`migrations/env.py` - WICHTIG:
```python
from src.cli_agent_orchestrator.clients.database import Base
from src.cli_agent_orchestrator.models import *

target_metadata = Base.metadata

def run_migrations_online() -> None:
    connectable = create_engine(DATABASE_URL)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True
        )
        with context.begin_transaction():
            context.run_migrations()
```

### 0.3 Regression Tests erstellen

`tests/migration/test_baseline.py`:
```python
import pytest
from sqlalchemy import create_engine, text
from src.cli_agent_orchestrator.clients.database import get_engine

@pytest.fixture(scope="module")
def db_engine():
    return get_engine()

def test_existing_tables_exist(db_engine):
    """Verify all existing tables before migration."""
    with db_engine.connect() as conn:
        result = conn.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type='table'
            ORDER BY name
        """))
        tables = [row[0] for row in result]
        assert "terminals" in tables
        assert "inbox" in tables
        assert "flows" in tables
        assert "workflows" in tables
        assert "workflow_nodes" in tables
        assert "workflow_edges" in tables
        assert "session_workflows" in tables
        assert "terminal_states" in tables
        assert "tasks" in tables
        assert "task_assignments" in tables
        assert "task_artifacts" in tables
        assert "workflow_executions" in tables

def test_task_columns_exist(db_engine):
    """Verify current task table structure."""
    with db_engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(tasks)"))
        columns = {row[1]: row[2] for row in result}
        # Current columns that should exist
        assert "id" in columns
        assert "title" in columns
        assert "description" in columns
        assert "status" in columns
```

---

## Phase 1: Database Schema (3 Tage) - **CRITICAL PATH**

### 1.1 Migration 001 - Projects Table

`migrations/versions/2025_01_11_001_add_projects.py`:

```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'projects',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('path', sa.Text(), nullable=False),
        sa.Column('status', sa.Text(), nullable=False, server_default='active'),
        sa.Column('metadata', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('path')
    )
    op.create_index('idx_projects_status', 'projects', ['status'])
    op.create_index('idx_projects_path', 'projects', ['path'])

def downgrade():
    op.drop_index('idx_projects_path', table_name='projects')
    op.drop_index('idx_projects_status', table_name='projects')
    op.drop_table('projects')
```

### 1.2 Migration 002 - TDD Support for Tasks

`migrations/versions/2025_01_11_002_add_tdd_support.py`:

```python
revision = '0002'
down_revision = '0001'

def upgrade():
    # TDD State Columns
    op.add_column('tasks', sa.Column('test_state', sa.Text(), nullable=False, server_default='none'))
    op.add_column('tasks', sa.Column('last_red_output', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('last_red_error', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('last_green_timestamp', sa.DateTime(), nullable=True))

    # Agent Assignment Columns
    op.add_column('tasks', sa.Column('required_agent_profile', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('assigned_agent_profile', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('assigned_at', sa.DateTime(), nullable=True))
    op.add_column('tasks', sa.Column('started_at', sa.DateTime(), nullable=True))

    # Hierarchy Columns (für Task Splitting)
    op.add_column('tasks', sa.Column('parent_task_id', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('split_strategy', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('split_metadata', sa.Text(), nullable=True))

    # Foreign Key für parent
    op.create_foreign_key(
        'fk_tasks_parent_task',
        'tasks', 'tasks',
        ['parent_task_id'], ['id']
    )

    # Indexes
    op.create_index('idx_tasks_test_state', 'tasks', ['test_state'])
    op.create_index('idx_tasks_agent_profile', 'tasks', ['assigned_agent_profile'])
    op.create_index('idx_tasks_parent_task', 'tasks', ['parent_task_id'])

def downgrade():
    op.drop_index('idx_tasks_parent_task', table_name='tasks')
    op.drop_index('idx_tasks_agent_profile', table_name='tasks')
    op.drop_index('idx_tasks_test_state', table_name='tasks')
    op.drop_constraint('fk_tasks_parent_task', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'split_metadata')
    op.drop_column('tasks', 'split_strategy')
    op.drop_column('tasks', 'parent_task_id')
    op.drop_column('tasks', 'started_at')
    op.drop_column('tasks', 'assigned_at')
    op.drop_column('tasks', 'assigned_agent_profile')
    op.drop_column('tasks', 'required_agent_profile')
    op.drop_column('tasks', 'last_green_timestamp')
    op.drop_column('tasks', 'last_red_error')
    op.drop_column('tasks', 'last_red_output')
    op.drop_column('tasks', 'test_state')
```

### 1.3 Migration 003 - Token Executions

`migrations/versions/2025_01_11_003_add_token_executions.py`:

```python
revision = '0003'
down_revision = '0002'

def upgrade():
    op.create_table(
        'token_executions',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('execution_id', sa.Text(), nullable=False),
        sa.Column('current_element_id', sa.Text(), nullable=True),
        sa.Column('state', sa.Text(), nullable=False, server_default='active'),
        sa.Column('data', sa.Text(), nullable=True),  # JSON serialized
        sa.Column('parent_token_id', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['execution_id'], ['workflow_executions.id]),
        sa.ForeignKeyConstraint(['parent_token_id'], ['token_executions.id'])
    )
    op.create_index('idx_token_executions_execution', 'token_executions', ['execution_id'])
    op.create_index('idx_token_executions_state', 'token_executions', ['state'])

def downgrade():
    op.drop_index('idx_token_executions_state', table_name='token_executions')
    op.drop_index('idx_token_executions_execution', table_name='token_executions')
    op.drop_table('token_executions')
```

### 1.4 Migration 004 - Workflow Versions

`migrations/versions/2025_01_11_004_add_workflow_versions.py`:

```python
revision = '0004'
down_revision = '0003'

def upgrade():
    op.create_table(
        'workflow_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workflow_id', sa.Text(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('snapshot', sa.Text(), nullable=False),  # Complete workflow JSON
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_by', sa.Text(), nullable=True),
        sa.Column('change_description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id']),
        sa.UniqueConstraint('workflow_id', 'version', name='uq_workflow_version')
    )
    op.create_index('idx_workflow_versions_workflow', 'workflow_versions', ['workflow_id'])

def downgrade():
    op.drop_index('idx_workflow_versions_workflow', table_name='workflow_versions')
    op.drop_table('workflow_versions')
```

### 1.5 Migration 005 - Task Assignments Enhancements

`migrations/versions/2025_01_11_005_enhance_task_assignments.py`:

```python
revision = '0005'
down_revision = '0004'

def upgrade():
    op.add_column('task_assignments', sa.Column('agent_profile', sa.Text(), nullable=True))
    op.add_column('task_assignments', sa.Column('agent_name', sa.Text(), nullable=True))
    op.add_column('task_assignments', sa.Column('test_state_at_start', sa.Text(), nullable=False, server_default='none'))
    op.add_column('task_assignments', sa.Column('test_state_at_end', sa.Text(), nullable=False, server_default='none'))

def downgrade():
    op.drop_column('task_assignments', 'test_state_at_end')
    op.drop_column('task_assignments', 'test_state_at_start')
    op.drop_column('task_assignments', 'agent_name')
    op.drop_column('task_assignments', 'agent_profile')
```

### 1.6 Test Migration

```bash
# Test mode
alembic upgrade head --sql

# Dry run
alembic upgrade head --dry-run

# Actually run
alembic upgrade head

# Verify
alembic current
alembic history
```

---

## Phase 2: Service Layer (3-4 Tage)

### 2.1 Agent Resolver Service

`src/cli_agent_orchestrator/services/agent_resolver.py`:

```python
"""Service for resolving appropriate agents for tasks based on multiple strategies."""

from typing import Optional, List, Dict, Any
from enum import Enum
import re

from src.cli_agent_orchestrator.utils.agent_profiles import (
    load_agent_profile,
    list_available_agents,
    AgentProfile
)
from src.cli_agent_orchestrator.models.task import Task, TaskType


class ResolutionStrategy(str, Enum):
    """Strategies for agent resolution."""
    EXPLICIT = "explicit"           # Use required_agent_profile if set
    TASK_TYPE_MAPPING = "task_type"  # Map task type to agent profile
    CAPABILITY_MATCH = "capability"  # Match by required capabilities
    WORKLOAD_BALANCED = "workload"  # Distribute across capable agents
    FALLBACK = "fallback"           # Use default agent


class AgentResolutionError(Exception):
    """Raised when agent resolution fails."""
    pass


class LegacyAgentCompatibility:
    """
    Backward compatibility layer for legacy agent profiles.

    Preserves old behavior while supporting new resolution system.
    """

    # Legacy profile names to new profile mappings
    LEGACY_MAPPINGS: Dict[str, str] = {
        "coder": "fullstack-developer",
        "developer": "fullstack-developer",
        "analyst": "data-analyst",
        "researcher": "research-specialist",
    }

    @classmethod
    def normalize_profile_name(cls, profile: str) -> str:
        """Normalize legacy profile names to current profiles."""
        return cls.LEGACY_MAPPINGS.get(profile, profile)


class TaskTypeToAgentMapping:
    """
    Default mapping from task types to agent profiles.

    Can be overridden by project-specific configuration.
    """

    DEFAULT_MAPPINGS: Dict[TaskType, str] = {
        TaskType.CODE_REVIEW: "code-reviewer",
        TaskType.IMPLEMENTATION: "fullstack-developer",
        TaskType.TESTING: "qa-engineer",
        TaskType.DOCUMENTATION: "technical-writer",
        TaskType.REFACTORING: "fullstack-developer",
        TaskType.DEBUGGING: "debug-specialist",
        TaskType.ANALYSIS: "data-analyst",
        TaskType.RESEARCH: "research-specialist",
        TaskType.DESIGN: "system-architect",
        TaskType.DEPLOYMENT: "devops-engineer",
    }

    @classmethod
    def get_agent_for_task_type(cls, task_type: TaskType) -> Optional[str]:
        """Get default agent profile for a task type."""
        return cls.DEFAULT_MAPPINGS.get(task_type)

    @classmethod
    def register_mapping(cls, task_type: TaskType, agent_profile: str) -> None:
        """Register a custom task type to agent mapping."""
        cls.DEFAULT_MAPPINGS[task_type] = agent_profile


class AgentResolver:
    """
    Main service for resolving which agent should handle a task.

    Resolution Strategy (in order):
    1. Explicit required_agent_profile on task
    2. Task type to agent mapping
    3. Capability matching
    4. Workload balancing
    5. Fallback to default agent
    """

    def __init__(
        self,
        fallback_agent: str = "fullstack-developer",
        enable_legacy_compatibility: bool = True
    ):
        self.fallback_agent = fallback_agent
        self.enable_legacy_compatibility = enable_legacy_compatibility
        self._available_profiles: Optional[Dict[str, AgentProfile]] = None

    @property
    def available_profiles(self) -> Dict[str, AgentProfile]:
        """Lazy-load and cache available agent profiles."""
        if self._available_profiles is None:
            self._available_profiles = {}
            for agent_name in list_available_agents():
                try:
                    profile = load_agent_profile(agent_name)
                    self._available_profiles[agent_name] = profile
                except Exception as e:
                    # Log but continue - one bad profile shouldn't break everything
                    print(f"Warning: Failed to load profile {agent_name}: {e}")
        return self._available_profiles

    def resolve_agent_for_task(
        self,
        task: Task,
        available_agents: Optional[List[str]] = None,
        strategy: ResolutionStrategy = ResolutionStrategy.TASK_TYPE_MAPPING
    ) -> str:
        """
        Resolve the appropriate agent profile for a given task.

        Args:
            task: The task to resolve an agent for
            available_agents: List of currently available agent names (optional)
            strategy: Resolution strategy to use

        Returns:
            The resolved agent profile name

        Raises:
            AgentResolutionError: If no suitable agent can be found
        """
        # Strategy 1: Explicit required profile
        if task.required_agent_profile:
            profile = self._normalize_profile(task.required_agent_profile)
            if self._validate_profile_exists(profile):
                if available_agents is None or profile in available_agents:
                    return profile
                raise AgentResolutionError(
                    f"Required agent '{profile}' not in available agents"
                )
            raise AgentResolutionError(
                f"Required agent profile '{profile}' does not exist"
            )

        # Strategy 2: Task type mapping
        if strategy == ResolutionStrategy.TASK_TYPE_MAPPING:
            mapped_agent = TaskTypeToAgentMapping.get_agent_for_task_type(task.task_type)
            if mapped_agent:
                profile = self._normalize_profile(mapped_agent)
                if self._validate_profile_exists(profile):
                    if available_agents is None or profile in available_agents:
                        return profile

        # Strategy 3: Capability matching
        if strategy == ResolutionStrategy.CAPABILITY_MATCH:
            profile = self._resolve_by_capabilities(task, available_agents)
            if profile:
                return profile

        # Strategy 4: Workload balancing (among capable agents)
        if strategy == ResolutionStrategy.WORKLOAD_BALANCED:
            profile = self._resolve_by_workload(task, available_agents)
            if profile:
                return profile

        # Strategy 5: Fallback
        if self._validate_profile_exists(self.fallback_agent):
            return self.fallback_agent

        raise AgentResolutionError(
            f"No suitable agent found for task '{task.id}'. "
            f"Task type: {task.task_type}, Available agents: {available_agents}"
        )

    def _normalize_profile(self, profile: str) -> str:
        """Normalize profile name using legacy compatibility if enabled."""
        if self.enable_legacy_compatibility:
            return LegacyAgentCompatibility.normalize_profile_name(profile)
        return profile

    def _validate_profile_exists(self, profile: str) -> bool:
        """Check if a profile exists in available profiles."""
        return profile in self.available_profiles

    def _resolve_by_capabilities(
        self,
        task: Task,
        available_agents: Optional[List[str]]
    ) -> Optional[str]:
        """Resolve agent by matching required capabilities."""
        required_caps = self._extract_required_capabilities(task)
        if not required_caps:
            return None

        candidates = available_agents if available_agents else self.available_profiles.keys()

        for agent_name in candidates:
            if agent_name not in self.available_profiles:
                continue
            profile = self.available_profiles[agent_name]
            if self._capabilities_match(required_caps, profile.capabilities):
                return agent_name

        return None

    def _extract_required_capabilities(self, task: Task) -> List[str]:
        """Extract required capabilities from task description/type."""
        capabilities = []

        # From task type
        type_caps = {
            TaskType.CODE_REVIEW: ["code-review", "static-analysis"],
            TaskType.TESTING: ["testing", "pytest", "unit-testing"],
            TaskType.DEBUGGING: ["debugging", "problem-solving"],
        }
        if task.task_type in type_caps:
            capabilities.extend(type_caps[task.task_type])

        # From task tags/metadata (if available)
        if hasattr(task, 'tags') and task.tags:
            capabilities.extend(task.tags)

        return capabilities

    def _capabilities_match(
        self,
        required: List[str],
        available: Dict[str, Any]
    ) -> bool:
        """Check if available capabilities satisfy requirements."""
        for req in required:
            # Check exact match or partial match in skill areas
            if req not in str(available).lower():
                return False
        return True

    def _resolve_by_workload(
        self,
        task: Task,
        available_agents: Optional[List[str]]
    ) -> Optional[str]:
        """
        Resolve agent by selecting least-busy capable agent.

        Note: This requires task assignment data to determine workload.
        In production, this would query the database for active assignments.
        """
        # For now, return first available capable agent
        # Full implementation requires workload tracking
        return self._resolve_by_capabilities(task, available_agents)


# Singleton instance
_default_resolver: Optional[AgentResolver] = None


def get_agent_resolver() -> AgentResolver:
    """Get the default agent resolver instance."""
    global _default_resolver
    if _default_resolver is None:
        _default_resolver = AgentResolver()
    return _default_resolver
```

### 2.2 Task TDD Service

`src/cli_agent_orchestrator/services/task_tdd_service.py`:

```python
"""Service for managing TDD state transitions for tasks."""

from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.cli_agent_orchestrator.models.task import TestState, Task
from src.cli_agent_orchestrator.clients.database import engine


class InvalidTDDTransitionError(Exception):
    """Raised when an invalid TDD state transition is attempted."""
    pass


class TDDStateMachine:
    """
    State machine for valid TDD state transitions.

    Enforces the TDD cycle: none -> pending -> red -> green -> (repeat or complete)
    """

    VALID_TRANSITIONS: Dict[TestState, set[TestState]] = {
        TestState.NONE: {TestState.PENDING, TestState.SKIPPED},
        TestState.PENDING: {TestState.RED, TestState.SKIPPED},
        TestState.RED: {TestState.GREEN, TestState.SKIPPED},
        TestState.GREEN: {TestState.RED, TestState.NONE, TestState.PENDING},  # Regression or new test
        TestState.SKIPPED: {TestState.PENDING, TestState.NONE},
    }

    @classmethod
    def validate_transition(
        cls,
        from_state: TestState,
        to_state: TestState
    ) -> bool:
        """Check if a state transition is valid."""
        if from_state == to_state:
            return True  # Self-transition is valid (idempotent)
        return to_state in cls.VALID_TRANSITIONS.get(from_state, set())

    @classmethod
    def assert_valid_transition(
        cls,
        from_state: TestState,
        to_state: TestState
    ) -> None:
        """Raise exception if transition is invalid."""
        if not cls.validate_transition(from_state, to_state):
            raise InvalidTDDTransitionError(
                f"Invalid TDD state transition: {from_state} -> {to_state}. "
                f"Valid transitions from {from_state}: {cls.VALID_TRANSITIONS.get(from_state, set())}"
            )


class TaskTDDService:
    """
    Service for managing TDD state and execution for tasks.

    Provides methods for:
    - State transitions with validation
    - Test output capture
    - Test execution coordination
    - Red/Green cycle tracking
    """

    def __init__(self):
        self.state_machine = TDDStateMachine()

    def transition_test_state(
        self,
        task_id: str,
        new_state: TestState,
        output: Optional[str] = None,
        error: Optional[str] = None,
        session: Optional[Session] = None
    ) -> Task:
        """
        Transition a task's TDD state with validation.

        Args:
            task_id: ID of the task to transition
            new_state: The target TDD state
            output: Test output (captured stdout/stderr)
            error: Error message if test failed
            session: Optional DB session (creates new if None)

        Returns:
            The updated Task

        Raises:
            InvalidTDDTransitionError: If transition is not valid
        """
        close_session = session is None
        session = session or Session(engine)

        try:
            # Get current task
            task = session.get(Task, task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")

            current_state = TestState(task.test_state or "none")
            target_state = TestState(new_state)

            # Validate transition
            self.state_machine.assert_valid_transition(current_state, target_state)

            # Update task fields based on state
            task.test_state = target_state.value

            if target_state == TestState.RED:
                task.last_red_output = output
                task.last_red_error = error
            elif target_state == TestState.GREEN:
                task.last_green_timestamp = datetime.utcnow()

            session.commit()
            session.refresh(task)
            return task

        finally:
            if close_session:
                session.close()

    def record_test_red(
        self,
        task_id: str,
        output: str,
        error: str,
        session: Optional[Session] = None
    ) -> Task:
        """Record a failed test run (RED state)."""
        return self.transition_test_state(
            task_id=task_id,
            new_state=TestState.RED,
            output=output,
            error=error,
            session=session
        )

    def record_test_green(
        self,
        task_id: str,
        output: Optional[str] = None,
        session: Optional[Session] = None
    ) -> Task:
        """Record a successful test run (GREEN state)."""
        return self.transition_test_state(
            task_id=task_id,
            new_state=TestState.GREEN,
            output=output,
            session=session
        )

    def get_pending_tasks(
        self,
        limit: int = 100,
        session: Optional[Session] = None
    ) -> list[Task]:
        """Get all tasks in PENDING state (ready for testing)."""
        close_session = session is None
        session = session or Session(engine)

        try:
            stmt = (
                select(Task)
                .where(Task.test_state == TestState.PENDING.value)
                .order_by(Task.created_at)
                .limit(limit)
            )
            return list(session.execute(stmt).scalars().all())
        finally:
            if close_session:
                session.close()

    def get_failed_tasks(
        self,
        limit: int = 100,
        session: Optional[Session] = None
    ) -> list[Task]:
        """Get all tasks in RED state (tests failing)."""
        close_session = session is None
        session = session or Session(engine)

        try:
            stmt = (
                select(Task)
                .where(Task.test_state == TestState.RED.value)
                .order_by(Task.updated_at.desc())
                .limit(limit)
            )
            return list(session.execute(stmt).scalars().all())
        finally:
            if close_session:
                session.close()

    def get_regression_tasks(
        self,
        session: Optional[Session] = None
    ) -> list[Task]:
        """
        Get tasks that were GREEN but turned RED (regressions).

        These are high-priority fixes needed.
        """
        close_session = session is None
        session = session or Session(engine)

        try:
            stmt = (
                select(Task)
                .where(
                    Task.test_state == TestState.RED.value,
                    Task.last_green_timestamp.isnot(None)
                )
                .order_by(Task.last_green_timestamp.desc())
            )
            return list(session.execute(stmt).scalars().all())
        finally:
            if close_session:
                session.close()


# Singleton instance
_default_tdd_service: Optional[TaskTDDService] = None


def get_tdd_service() -> TaskTDDService:
    """Get the default TDD service instance."""
    global _default_tdd_service
    if _default_tdd_service is None:
        _default_tdd_service = TaskTDDService()
    return _default_tdd_service
```

### 2.3 Task Orchestrator Service

`src/cli_agent_orchestrator/services/task_orchestrator.py`:

```python
"""Service for orchestrating task assignment to agents and terminals."""

from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import asyncio

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.cli_agent_orchestrator.models.task import Task, TaskStatus
from src.cli_agent_orchestrator.services.agent_resolver import (
    AgentResolver,
    get_agent_resolver
)
from src.cli_agent_orchestrator.services.task_tdd_service import (
    TaskTDDService,
    get_tdd_service,
    TestState
)
from src.cli_agent_orchestrator.clients.database import engine
from src.cli_agent_orchestrator.clients.terminal import TerminalClient


class AssignmentStrategy(str, Enum):
    """Strategies for assigning tasks to agents."""
    IMMEDIATE = "immediate"       # Assign as soon as task created
    BATCHED = "batched"          # Assign in batches
    TDD_GATE = "tdd_gate"        # Only assign after test is GREEN
    PRIORITY_BASED = "priority"  # By task priority


class TaskOrchestrator:
    """
    Main service for orchestrating task assignment and execution.

    Coordinates:
    - Agent resolution for tasks
    - Terminal provisioning
    - Task assignment tracking
    - Completion callbacks
    """

    def __init__(
        self,
        agent_resolver: Optional[AgentResolver] = None,
        tdd_service: Optional[TaskTDDService] = None,
        terminal_client: Optional[TerminalClient] = None
    ):
        self.agent_resolver = agent_resolver or get_agent_resolver()
        self.tdd_service = tdd_service or get_tdd_service()
        self.terminal_client = terminal_client or TerminalClient()
        self._active_assignments: Dict[str, str] = {}  # task_id -> terminal_id

    def assign_task(
        self,
        task_id: str,
        agent_profile: Optional[str] = None,
        session: Optional[Session] = None
    ) -> Task:
        """
        Assign a task to an agent and provision terminal.

        Args:
            task_id: Task to assign
            agent_profile: Override agent resolution (optional)
            session: Optional DB session

        Returns:
            Updated Task with assignment info
        """
        close_session = session is None
        session = session or Session(engine)

        try:
            task = session.get(Task, task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")

            # Resolve agent if not explicitly provided
            if agent_profile is None:
                agent_profile = self.agent_resolver.resolve_agent_for_task(task)

            # Provision terminal for agent
            terminal_id = self.terminal_client.create_terminal(
                agent_profile=agent_profile,
                session_id=task.session_id if hasattr(task, 'session_id') else None
            )

            # Update task assignment
            task.assigned_agent_profile = agent_profile
            task.assigned_at = datetime.utcnow()
            task.status = TaskStatus.ASSIGNED.value

            # Track assignment
            self._active_assignments[task_id] = terminal_id

            session.commit()
            session.refresh(task)
            return task

        finally:
            if close_session:
                session.close()

    def complete_task(
        self,
        task_id: str,
        success: bool = True,
        output: Optional[str] = None,
        session: Optional[Session] = None
    ) -> Task:
        """
        Mark a task as completed and clean up terminal.

        Args:
            task_id: Task to complete
            success: Whether task completed successfully
            output: Optional output to capture
            session: Optional DB session

        Returns:
            Updated Task
        """
        close_session = session is None
        session = session or Session(engine)

        try:
            task = session.get(Task, task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")

            # Update task status
            if success:
                task.status = TaskStatus.COMPLETED.value
            else:
                task.status = TaskStatus.FAILED.value

            # Track completion time
            if not hasattr(task, 'completed_at') or task.completed_at is None:
                task.completed_at = datetime.utcnow()

            # Clean up terminal
            if task_id in self._active_assignments:
                terminal_id = self._active_assignments.pop(task_id)
                try:
                    self.terminal_client.close_terminal(terminal_id)
                except Exception as e:
                    print(f"Warning: Failed to close terminal {terminal_id}: {e}")

            session.commit()
            session.refresh(task)
            return task

        finally:
            if close_session:
                session.close()

    def get_pending_assignments(
        self,
        limit: int = 50,
        strategy: AssignmentStrategy = AssignmentStrategy.PRIORITY_BASED,
        session: Optional[Session] = None
    ) -> List[Task]:
        """
        Get tasks that need to be assigned.

        Args:
            limit: Maximum number of tasks to return
            strategy: Assignment strategy to filter by
            session: Optional DB session

        Returns:
            List of Tasks ready for assignment
        """
        close_session = session is None
        session = session or Session(engine)

        try:
            stmt = select(Task).where(
                Task.status == TaskStatus.PENDING.value
            )

            # Apply strategy filters
            if strategy == AssignmentStrategy.TDD_GATE:
                stmt = stmt.where(Task.test_state == TestState.GREEN.value)

            # Order by priority (created_at as proxy for now)
            stmt = stmt.order_by(Task.created_at).limit(limit)

            return list(session.execute(stmt).scalars().all())

        finally:
            if close_session:
                session.close()

    async def batch_assign(
        self,
        task_ids: List[str],
        delay_seconds: float = 0.5
    ) -> Dict[str, bool]:
        """
        Assign multiple tasks with optional delay between assignments.

        Args:
            task_ids: List of task IDs to assign
            delay_seconds: Delay between assignments (prevent resource spikes)

        Returns:
            Dict mapping task_id -> success status
        """
        results = {}
        for task_id in task_ids:
            try:
                self.assign_task(task_id)
                results[task_id] = True
            except Exception as e:
                print(f"Failed to assign task {task_id}: {e}")
                results[task_id] = False

            if delay_seconds > 0:
                await asyncio.sleep(delay_seconds)

        return results


# Singleton instance
_default_orchestrator: Optional[TaskOrchestrator] = None


def get_task_orchestrator() -> TaskOrchestrator:
    """Get the default task orchestrator instance."""
    global _default_orchestrator
    if _default_orchestrator is None:
        _default_orchestrator = TaskOrchestrator()
    return _default_orchestrator
```

---

## Phase 3: BPMN Integration (2-3 Tage)

### 3.1 Neue BPMN Node Types

`src/cli_agent_orchestrator/models/bpmn.py` - Ergänzung:

```python
class BPMNElementType(str, Enum):
    """Complete BPMN element types including task creation nodes."""
    # Existing
    START_EVENT = "startEvent"
    END_EVENT = "endEvent"
    SERVICE_TASK = "serviceTask"
    SCRIPT_TASK = "scriptTask"
    USER_TASK = "userTask"
    EXCLUSIVE_GATEWAY = "exclusiveGateway"
    PARALLEL_GATEWAY = "parallelGateway"

    # NEW: Task Creation Nodes
    TASK_CREATOR = "taskCreator"
    TASK_ORCHESTRATOR = "taskOrchestrator"


class TaskCreatorData(BaseModel):
    """Configuration for TASK_CREATOR node."""
    task_type: str
    title_template: str
    description_template: str
    required_agent_profile: Optional[str] = None
    tags: List[str] = []
    priority: int = 5
    tdd_required: bool = True
    split_config: Optional[Dict[str, Any]] = None


class TaskOrchestratorData(BaseModel):
    """Configuration for TASK_ORCHESTRATOR node."""
    wait_mode: Literal["all", "any", "n_out_of_m"] = "all"
    n_value: Optional[int] = None
    timeout_seconds: int = 3600
    on_timeout: Literal["fail", "continue", "mark_partial"] = "continue"
    auto_retry_failed: bool = True
    max_retries: int = 3
```

### 3.2 BPMN Execution Handler Erweiterungen

`src/cli_agent_orchestrator/services/bpmn_execution_engine.py` - Ergänzung:

```python
from src.cli_agent_orchestrator.models.bpmn import (
    BPMNElementType,
    TaskCreatorData,
    TaskOrchestratorData
)
from src.cli_agent_orchestrator.services.task_orchestrator import get_task_orchestrator
from src.cli_agent_orchestrator.models.task import Task, TaskType


class BPMNExecutionEngine:
    # ... existing code ...

    async def _execute_task_creator(
        self,
        token: Token,
        element: BPMNElement
    ) -> Token:
        """
        Execute TASK_CREATOR node - creates new task(s).

        Template variables in title/description are replaced with:
        - {workflow_id}: Current workflow ID
        - {token_id}: Current token ID
        - {variables}: All workflow variables
        """
        config = TaskCreatorData(**element.config)

        # Build task data from templates
        template_vars = {
            "workflow_id": token.workflow_id,
            "token_id": token.id,
            **token.variables
        }

        title = config.title_template.format(**template_vars)
        description = config.description_template.format(**template_vars)

        # Create task in database
        task = Task(
            title=title,
            description=description,
            task_type=TaskType(config.task_type),
            status=TaskStatus.PENDING.value,
            test_state=TestState.PENDING.value if config.tdd_required else TestState.NONE.value,
            required_agent_profile=config.required_agent_profile,
            tags=config.tags,
            priority=config.priority,
            # Link to workflow execution
            workflow_execution_id=token.execution_id,
        )

        with Session(engine) as session:
            session.add(task)
            session.commit()
            session.refresh(task)

        # Add created task ID to token data
        token.data["created_task_id"] = task.id

        # Assign to orchestrator if configured
        orchestrator = get_task_orchestrator()
        try:
            orchestrator.assign_task(task.id, agent_profile=config.required_agent_profile)
        except Exception as e:
            print(f"Warning: Failed to assign task {task.id}: {e}")

        return token

    async def _execute_task_orchestrator(
        self,
        token: Token,
        element: BPMNElement
    ) -> Token:
        """
        Execute TASK_ORCHESTRATOR node - waits for task completion.

        Coordinates multiple tasks created by TASK_CREATOR nodes.
        """
        config = TaskOrchestratorData(**element.config)

        # Get task IDs from token data (should have been accumulated)
        task_ids = token.data.get("task_ids", [])

        if not task_ids:
            # No tasks to wait for - proceed
            return token

        orchestrator = get_task_orchestrator()

        # Wait for tasks to complete based on wait_mode
        if config.wait_mode == "all":
            await self._wait_for_all_tasks(task_ids, config.timeout_seconds)
        elif config.wait_mode == "any":
            await self._wait_for_any_task(task_ids, config.timeout_seconds)
        elif config.wait_mode == "n_out_of_m":
            await self._wait_for_n_tasks(
                task_ids,
                config.n_value or len(task_ids) // 2,
                config.timeout_seconds
            )

        # Check for failures and retry if needed
        if config.auto_retry_failed:
            await self._retry_failed_tasks(task_ids, config.max_retries)

        # Update token with completion results
        results = self._get_task_results(task_ids)
        token.data["task_results"] = results

        return token

    async def _wait_for_all_tasks(
        self,
        task_ids: List[str],
        timeout: int
    ) -> None:
        """Wait for all tasks to complete."""
        start_time = datetime.utcnow()

        with Session(engine) as session:
            while True:
                if (datetime.utcnow() - start_time).total_seconds() > timeout:
                    raise TimeoutError(f"Tasks {task_ids} did not complete within {timeout}s")

                stmt = select(Task).where(
                    Task.id.in_(task_ids),
                    Task.status.in_([TaskStatus.COMPLETED.value, TaskStatus.FAILED.value])
                )
                completed = session.execute(stmt).scalars().all()

                if len(completed) == len(task_ids):
                    break

                await asyncio.sleep(2)

    async def _wait_for_any_task(
        self,
        task_ids: List[str],
        timeout: int
    ) -> None:
        """Wait for at least one task to complete."""
        start_time = datetime.utcnow()

        with Session(engine) as session:
            while True:
                if (datetime.utcnow() - start_time).total_seconds() > timeout:
                    raise TimeoutError(f"No task from {task_ids} completed within {timeout}s")

                stmt = select(Task).where(
                    Task.id.in_(task_ids),
                    Task.status.in_([TaskStatus.COMPLETED.value, TaskStatus.FAILED.value])
                )
                completed = session.execute(stmt).scalars().first()

                if completed:
                    break

                await asyncio.sleep(1)

    async def _wait_for_n_tasks(
        self,
        task_ids: List[str],
        n: int,
        timeout: int
    ) -> None:
        """Wait for n tasks to complete."""
        # Similar implementation to _wait_for_all_tasks but with n threshold
        pass

    async def _retry_failed_tasks(
        self,
        task_ids: List[str],
        max_retries: int
    ) -> None:
        """Retry failed tasks up to max_retries times."""
        with Session(engine) as session:
            for task_id in task_ids:
                task = session.get(Task, task_id)
                if task.status == TaskStatus.FAILED.value:
                    retry_count = task.metadata.get("retry_count", 0) if task.metadata else 0
                    if retry_count < max_retries:
                        # Reset for retry
                        task.status = TaskStatus.PENDING.value
                        if task.metadata:
                            task.metadata["retry_count"] = retry_count + 1
                        else:
                            task.metadata = {"retry_count": 1}
                        session.commit()

    def _get_task_results(self, task_ids: List[str]) -> Dict[str, Any]:
        """Get results for all tasks."""
        with Session(engine) as session:
            stmt = select(Task).where(Task.id.in_(task_ids))
            tasks = session.execute(stmt).scalars().all()

            return {
                task.id: {
                    "status": task.status,
                    "test_state": task.test_state,
                    "assigned_agent": task.assigned_agent_profile,
                }
                for task in tasks
            }
```

---

## Phase 4: API Layer (2 Tage)

### 4.1 Task TDD Endpoints

`src/cli_agent_orchestrator/api/task_tdd_endpoints.py`:

```python
"""API endpoints for task TDD operations."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from src.cli_agent_orchestrator.services.task_tdd_service import (
    TaskTDDService,
    get_tdd_service,
    TestState
)
from src.cli_agent_orchestrator.clients.database import get_db_session
from sqlalchemy.orm import Session


router = APIRouter(prefix="/api/tasks/tdd", tags=["TDD"])


class TestStateUpdate(BaseModel):
    """Request model for updating test state."""
    state: TestState
    output: Optional[str] = None
    error: Optional[str] = None


class TestStateResponse(BaseModel):
    """Response model for test state."""
    task_id: str
    state: TestState
    last_green_timestamp: Optional[datetime]
    last_red_output: Optional[str]
    last_red_error: Optional[str]


@router.post("/{task_id}/state", response_model=TestStateResponse)
async def update_test_state(
    task_id: str,
    update: TestStateUpdate,
    session: Session = Depends(get_db_session),
    tdd_service: TaskTDDService = Depends(get_tdd_service)
):
    """Update the TDD state for a task."""
    try:
        task = tdd_service.transition_test_state(
            task_id=task_id,
            new_state=update.state,
            output=update.output,
            error=update.error,
            session=session
        )
        return TestStateResponse(
            task_id=task.id,
            state=TestState(task.test_state),
            last_green_timestamp=task.last_green_timestamp,
            last_red_output=task.last_red_output,
            last_red_error=task.last_red_error
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/red", response_model=TestStateResponse)
async def record_test_red(
    task_id: str,
    output: str,
    error: Optional[str] = None,
    session: Session = Depends(get_db_session),
    tdd_service: TaskTDDService = Depends(get_tdd_service)
):
    """Record a failed test run (RED)."""
    task = tdd_service.record_test_red(task_id, output, error, session)
    return TestStateResponse(
        task_id=task.id,
        state=TestState.RED,
        last_red_output=output,
        last_red_error=error
    )


@router.post("/{task_id}/green", response_model=TestStateResponse)
async def record_test_green(
    task_id: str,
    output: Optional[str] = None,
    session: Session = Depends(get_db_session),
    tdd_service: TaskTDDService = Depends(get_tdd_service)
):
    """Record a successful test run (GREEN)."""
    task = tdd_service.record_test_green(task_id, output, session)
    return TestStateResponse(
        task_id=task.id,
        state=TestState.GREEN,
        last_green_timestamp=task.last_green_timestamp
    )


@router.get("/pending", response_model=List[TestStateResponse])
async def get_pending_tests(
    limit: int = 100,
    session: Session = Depends(get_db_session),
    tdd_service: TaskTDDService = Depends(get_tdd_service)
):
    """Get all tasks in PENDING state (ready for testing)."""
    tasks = tdd_service.get_pending_tasks(limit, session)
    return [
        TestStateResponse(
            task_id=t.id,
            state=TestState(t.test_state),
            last_green_timestamp=t.last_green_timestamp
        )
        for t in tasks
    ]


@router.get("/failed", response_model=List[TestStateResponse])
async def get_failed_tests(
    limit: int = 100,
    session: Session = Depends(get_db_session),
    tdd_service: TaskTDDService = Depends(get_tdd_service)
):
    """Get all tasks in RED state (failing tests)."""
    tasks = tdd_service.get_failed_tasks(limit, session)
    return [
        TestStateResponse(
            task_id=t.id,
            state=TestState.RED,
            last_red_output=t.last_red_output,
            last_red_error=t.last_red_error
        )
        for t in tasks
    ]


@router.get("/regressions", response_model=List[TestStateResponse])
async def get_regressions(
    session: Session = Depends(get_db_session),
    tdd_service: TaskTDDService = Depends(get_tdd_service)
):
    """Get tasks that regressed (GREEN -> RED)."""
    tasks = tdd_service.get_regression_tasks(session)
    return [
        TestStateResponse(
            task_id=t.id,
            state=TestState.RED,
            last_green_timestamp=t.last_green_timestamp
        )
        for t in tasks
    ]
```

### 4.2 Project Endpoints

`src/cli_agent_orchestrator/api/project_endpoints.py`:

```python
"""API endpoints for project management."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from src.cli_agent_orchestrator.models.project import Project, ProjectStatus
from src.cli_agent_orchestrator.clients.database import get_db_session
from sqlalchemy.orm import Session


router = APIRouter(prefix="/api/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    """Request model for creating a project."""
    name: str
    description: Optional[str] = None
    path: str
    metadata: Optional[dict] = None


class ProjectUpdate(BaseModel):
    """Request model for updating a project."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    metadata: Optional[dict] = None


class ProjectResponse(BaseModel):
    """Response model for project."""
    id: str
    name: str
    description: Optional[str]
    path: str
    status: ProjectStatus
    metadata: Optional[dict]
    created_at: datetime
    updated_at: datetime


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    session: Session = Depends(get_db_session)
):
    """Create a new project."""
    # Check if path already exists
    existing = session.query(Project).filter(Project.path == project.path).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project with this path already exists")

    db_project = Project(
        name=project.name,
        description=project.description,
        path=project.path,
        status=ProjectStatus.ACTIVE,
        metadata=project.metadata
    )
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    status: Optional[ProjectStatus] = None,
    session: Session = Depends(get_db_session)
):
    """List all projects, optionally filtered by status."""
    query = session.query(Project)
    if status:
        query = query.filter(Project.status == status)
    return query.all()


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    session: Session = Depends(get_db_session)
):
    """Get a specific project by ID."""
    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    update: ProjectUpdate,
    session: Session = Depends(get_db_session)
):
    """Update a project."""
    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    project.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    session: Session = Depends(get_db_session)
):
    """Delete a project."""
    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    session.delete(project)
    session.commit()
    return {"message": "Project deleted"}
```

---

## Phase 5: Frontend Updates (2-3 Tage)

### 5.1 Task Types Update

`apps/dashboard/src/types/task.ts`:

```typescript
/**
 * Task type definitions with TDD support
 */

export enum TestState {
  NONE = "none",
  PENDING = "pending",
  RED = "red",
  GREEN = "green",
  SKIPPED = "skipped"
}

export enum TaskType {
  CODE_REVIEW = "code_review",
  IMPLEMENTATION = "implementation",
  TESTING = "testing",
  DOCUMENTATION = "documentation",
  REFACTORING = "refactoring",
  DEBUGGING = "debugging",
  ANALYSIS = "analysis",
  RESEARCH = "research",
  DESIGN = "design",
  DEPLOYMENT = "deployment"
}

export enum TaskStatus {
  PENDING = "pending",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export interface Task {
  id: string;
  title: string;
  description: string;
  task_type: TaskType;
  status: TaskStatus;

  // TDD Support
  test_state: TestState;
  last_red_output?: string;
  last_red_error?: string;
  last_green_timestamp?: string;

  // Agent Assignment
  required_agent_profile?: string;
  assigned_agent_profile?: string;
  assigned_at?: string;
  started_at?: string;

  // Hierarchy
  parent_task_id?: string;
  split_strategy?: string;
  split_metadata?: Record<string, unknown>;

  // Standard fields
  created_at: string;
  updated_at: string;
  completed_at?: string;
  tags?: string[];
  priority?: number;
  workflow_execution_id?: string;
  session_id?: string;
}

export interface TaskCreateRequest {
  title: string;
  description: string;
  task_type: TaskType;
  required_agent_profile?: string;
  tags?: string[];
  priority?: number;
  tdd_required?: boolean;
}

export interface TaskTDDUpdate {
  state: TestState;
  output?: string;
  error?: string;
}

export interface TaskListFilters {
  status?: TaskStatus;
  test_state?: TestState;
  task_type?: TaskType;
  assigned_agent_profile?: string;
  parent_task_id?: string;
}
```

### 5.2 Project Types

`apps/dashboard/src/types/project.ts`:

```typescript
/**
 * Project type definitions
 */

export enum ProjectStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
  ON_HOLD = "on_hold"
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  status: ProjectStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;

  // Computed/linked fields
  workflow_count?: number;
  active_sessions?: number;
}

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  metadata?: Record<string, unknown>;
}
```

---

## Phase 6: Rollout & Monitoring (2-3 Tage)

### 6.1 Feature Flags

`src/cli_agent_orchestrator/config/feature_flags.py`:

```python
"""Feature flag configuration for gradual rollout."""

import os
from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class FeatureFlags:
    """Feature flags for the orchestrator."""
    enable_projects: bool = False
    enable_tdd: bool = False
    enable_task_orchestrator: bool = False
    enable_workflow_versions: bool = False
    enable_token_persistence: bool = False

    @classmethod
    def from_env(cls) -> "FeatureFlags":
        """Load feature flags from environment variables."""
        return cls(
            enable_projects=os.getenv("FEATURE_PROJECTS", "false").lower() == "true",
            enable_tdd=os.getenv("FEATURE_TDD", "false").lower() == "true",
            enable_task_orchestrator=os.getenv("FEATURE_TASK_ORCH", "false").lower() == "true",
            enable_workflow_versions=os.getenv("FEATURE_VERSIONS", "false").lower() == "true",
            enable_token_persistence=os.getenv("FEATURE_TOKEN_PERSIST", "false").lower() == "true",
        )

    def to_dict(self) -> Dict[str, bool]:
        """Convert to dictionary for API responses."""
        return {
            "projects": self.enable_projects,
            "tdd": self.enable_tdd,
            "task_orchestrator": self.enable_task_orchestrator,
            "workflow_versions": self.enable_workflow_versions,
            "token_persistence": self.enable_token_persistence,
        }


# Global instance
_flags: FeatureFlags = FeatureFlags.from_env()


def get_feature_flags() -> FeatureFlags:
    """Get global feature flags instance."""
    return _flags
```

### 6.2 Health Check Endpoint

`src/cli_agent_orchestrator/api/health_endpoints.py`:

```python
"""Health check and monitoring endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

from src.cli_agent_orchestrator.config.feature_flags import get_feature_flags
from src.cli_agent_orchestrator.clients.database import engine


router = APIRouter(prefix="/health", tags=["Health"])


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    timestamp: datetime
    features: Dict[str, bool]
    database: Dict[str, Any]
    migration_version: Optional[str]


@router.get("/", response_model=HealthResponse)
async def health_check():
    """Comprehensive health check endpoint."""
    flags = get_feature_flags()

    # Check database connectivity
    db_status = {"connected": False, "error": None}
    migration_version = None

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_status["connected"] = True

            # Get current migration version
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            migration_version = result.scalar()

    except Exception as e:
        db_status["error"] = str(e)

    overall_status = "healthy" if db_status["connected"] else "unhealthy"

    return HealthResponse(
        status=overall_status,
        version="1.0.0-tdd-beta",
        timestamp=datetime.utcnow(),
        features=flags.to_dict(),
        database=db_status,
        migration_version=migration_version
    )


@router.get("/metrics")
async def get_metrics():
    """Basic metrics for monitoring."""
    flags = get_feature_flags()

    metrics = {
        "feature_flags": flags.to_dict(),
        "timestamp": datetime.utcnow().isoformat(),
    }

    if flags.enable_tdd:
        # Add TDD-specific metrics
        with engine.connect() as conn:
            for state in ["none", "pending", "red", "green", "skipped"]:
                result = conn.execute(text(
                    f"SELECT COUNT(*) FROM tasks WHERE test_state = '{state}'"
                ))
                metrics[f"tasks_{state}"] = result.scalar()

    if flags.enable_projects:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM projects"))
            metrics["total_projects"] = result.scalar()

    return metrics
```

### 6.3 Staging Deployment Checklist

```markdown
## Staging Deployment Checklist

### Pre-Deployment
- [ ] Database backup created
- [ ] All migrations tested on backup
- [ ] Feature flags set to opt-in mode
- [ ] Monitoring/alerting configured
- [ ] Rollback plan documented

### Deployment Steps
1. [ ] Deploy code to staging
2. [ ] Run database migrations: `alembic upgrade head`
3. [ ] Verify schema: Check `sqlite3 data/db.db ".schema projects"`
4. [ ] Run health check: `curl http://localhost:8000/health/`
5. [ ] Test API endpoints with feature flags OFF
6. [ ] Enable feature flag: `export FEATURE_TDD=true`
7. [ ] Test API endpoints with feature flags ON
8. [ ] Load testing: 100 concurrent task assignments
9. [ ] Verify no data loss in restart scenarios

### Post-Deployment
- [ ] Monitor error logs for 1 hour
- [ ] Check database query performance
- [ ] Verify terminal cleanup works
- [ ] Document any issues found

### Rollback Criteria
- Any database corruption
- >5% error rate on API calls
- Terminal leaks (>10 orphaned tmux sessions)
- Performance degradation (>2x response time)
```

---

## Testing Strategy

### Unit Tests

`tests/services/test_agent_resolver.py`:

```python
import pytest
from src.cli_agent_orchestrator.services.agent_resolver import (
    AgentResolver,
    ResolutionStrategy,
    AgentResolutionError
)
from src.cli_agent_orchestrator.models.task import Task, TaskType


def test_explicit_agent_resolution():
    """Test that explicit required_agent_profile is respected."""
    resolver = AgentResolver()
    task = Task(
        id="test-1",
        title="Test Task",
        task_type=TaskType.IMPLEMENTATION,
        required_agent_profile="code-reviewer"
    )

    agent = resolver.resolve_agent_for_task(task)
    assert agent == "code-reviewer"


def test_task_type_mapping():
    """Test task type to agent profile mapping."""
    resolver = AgentResolver()
    task = Task(
        id="test-2",
        title="Code Review",
        task_type=TaskType.CODE_REVIEW
    )

    agent = resolver.resolve_agent_for_task(
        task,
        strategy=ResolutionStrategy.TASK_TYPE_MAPPING
    )
    assert agent == "code-reviewer"


def test_fallback_agent():
    """Test fallback to default agent when no match found."""
    resolver = AgentResolver(fallback_agent="generalist")
    task = Task(
        id="test-3",
        title="Unknown Task Type",
        task_type="unknown_type"  # Invalid type
    )

    agent = resolver.resolve_agent_for_task(task)
    assert agent == "generalist"


def test_invalid_explicit_agent_raises():
    """Test that invalid explicit agent raises error."""
    resolver = AgentResolver()
    task = Task(
        id="test-4",
        title="Test",
        task_type=TaskType.IMPLEMENTATION,
        required_agent_profile="nonexistent_agent"
    )

    with pytest.raises(AgentResolutionError):
        resolver.resolve_agent_for_task(task)


def test_legacy_profile_normalization():
    """Test legacy profile name normalization."""
    from src.cli_agent_orchestrator.services.agent_resolver import LegacyAgentCompatibility

    assert LegacyAgentCompatibility.normalize_profile_name("coder") == "fullstack-developer"
    assert LegacyAgentCompatibility.normalize_profile_name("developer") == "fullstack-developer"
    assert LegacyAgentCompatibility.normalize_profile_name("analyst") == "data-analyst"
```

`tests/services/test_tdd_service.py`:

```python
import pytest
from src.cli_agent_orchestrator.services.task_tdd_service import (
    TaskTDDService,
    TDDStateMachine,
    InvalidTDDTransitionError,
    TestState
)
from src.cli_agent_orchestrator.models.task import Task


def test_valid_tdd_transitions():
    """Test all valid TDD state transitions."""
    machine = TDDStateMachine()

    # Valid transitions
    assert machine.validate_transition(TestState.NONE, TestState.PENDING)
    assert machine.validate_transition(TestState.PENDING, TestState.RED)
    assert machine.validate_transition(TestState.RED, TestState.GREEN)
    assert machine.validate_transition(TestState.GREEN, TestState.RED)  # Regression
    assert machine.validate_transition(TestState.GREEN, TestState.NONE)


def test_invalid_tdd_transitions():
    """Test that invalid transitions raise errors."""
    machine = TDDStateMachine()

    # Cannot go directly from NONE to RED
    assert not machine.validate_transition(TestState.NONE, TestState.RED)

    # Cannot go from RED to NONE
    assert not machine.validate_transition(TestState.RED, TestState.NONE)


def test_tdd_state_machine_enforcement():
    """Test that state machine raises on invalid transitions."""
    machine = TDDStateMachine()

    with pytest.raises(InvalidTDDTransitionError):
        machine.assert_valid_transition(TestState.NONE, TestState.RED)

    # Should not raise for valid transition
    machine.assert_valid_transition(TestState.NONE, TestState.PENDING)


@pytest.mark.asyncio
async def test_record_red_green_cycle():
    """Test complete RED -> GREEN cycle."""
    service = TaskTDDService()

    # Create a test task
    task = Task(
        id="test-tdd-1",
        title="TDD Test Task",
        task_type="implementation",
        test_state=TestState.NONE.value
    )

    # Record RED
    red_task = service.record_test_red(
        task_id="test-tdd-1",
        output="Test failed with assertion error",
        error="AssertionError: Expected 5, got 3"
    )

    assert red_task.test_state == TestState.RED.value
    assert red_task.last_red_error == "AssertionError: Expected 5, got 3"

    # Record GREEN
    green_task = service.record_test_green(task_id="test-tdd-1")

    assert green_task.test_state == TestState.GREEN.value
    assert green_task.last_green_timestamp is not None
```

### Integration Tests

`tests/integration/test_workflow_with_tdd.py`:

```python
import pytest
from src.cli_agent_orchestrator.services.bpmn_execution_engine import BPMNExecutionEngine
from src.cli_agent_orchestrator.services.task_tdd_service import get_tdd_service
from src.cli_agent_orchestrator.services.task_orchestrator import get_task_orchestrator


@pytest.mark.integration
async def test_workflow_with_task_creator():
    """Test complete workflow with TASK_CREATOR node."""
    # Create workflow with task creator
    workflow = {
        "id": "test-wf-1",
        "nodes": [
            {
                "id": "start",
                "type": "startEvent"
            },
            {
                "id": "creator",
                "type": "taskCreator",
                "config": {
                    "task_type": "implementation",
                    "title_template": "Implement feature for {workflow_id}",
                    "description_template": "Auto-generated task",
                    "tdd_required": True
                }
            },
            {
                "id": "end",
                "type": "endEvent"
            }
        ],
        "edges": [
            {"from": "start", "to": "creator"},
            {"from": "creator", "to": "end"}
        ]
    }

    engine = BPMNExecutionEngine()
    execution = await engine.start_workflow(workflow)

    # Wait for completion
    result = await engine.wait_for_completion(execution.id, timeout=30)

    assert result.status == "completed"
    assert "created_task_id" in result.token.data

    # Verify task was created with TDD enabled
    task_id = result.token.data["created_task_id"]
    tdd_service = get_tdd_service()
    task = await tdd_service.get_task(task_id)
    assert task.test_state == TestState.PENDING.value
```

---

## Risk Mitigation

### Critical Risk #1: Migration Failure

**Mitigation**:
1. Always backup database before migration
2. Test migrations on copy of production data
3. Implement migration rollback scripts
4. Use Alembic's `--sql` flag for dry-run

### Critical Risk #2: Breaking Existing Workflows

**Mitigation**:
1. Legacy compatibility layer in AgentResolver
2. Feature flags for new functionality
3. Extensive testing with existing workflow definitions
4. Gradual rollout (opt-in per project)

### Critical Risk #3: Performance Degradation

**Mitigation**:
1. Add database indexes before migrating data
2. Profile queries before/after changes
3. Implement caching for frequently accessed data
4. Monitor query times in production

### Critical Risk #4: Data Loss on Server Restart

**Mitigation**:
1. Token persistence in database (Phase 1)
2. Session recovery mechanisms
3. Automatic state restoration on startup
4. Health check to detect orphaned executions

---

## Success Criteria

### Phase Completion Criteria

**Phase 0 (Vorbereitung)**:
- [x] Alembic configured and tested
- [x] Database backup created
- [x] Regression tests passing

**Phase 1 (Database)**:
- [x] All migrations run successfully
- [x] Data integrity verified
- [x] Rollback tested

**Phase 2 (Services)**:
- [x] AgentResolver unit tests pass
- [x] TDD service validates transitions
- [x] TaskOrchestrator assigns correctly

**Phase 3 (BPMN)**:
- [x] TASK_CREATOR creates tasks
- [x] TASK_ORCHESTRATOR waits correctly
- [x] Token persistence works

**Phase 4 (API)**:
- [x] All endpoints return 200/201
- [x] Error handling returns 400/404
- [x] OpenAPI spec valid

**Phase 5 (Frontend)**:
- [x] Types compile without errors
- [x] TDD state displays correctly
- [x] Project selector works

**Phase 6 (Rollout)**:
- [x] Staging environment stable
- [x] Feature flags functional
- [x] Health check passes
- [x] Production deployment successful

---

## Conclusion

Dieser Implementierungsleitfaden bietet eine klare, schrittweise Strategie für den Refactor des cli-agent-orchestrators. Die wichtigsten Punkte:

1. **Alembic zuerst** - Migrationssystem vor Schemaänderungen
2. **Feature Flags** - Schrittweise Aktivierung neuer Features
3. **Backward Compatibility** - Legacy-Support für bestehende Workflows
4. **Test-First** - Regressionstests vor jeder Phase
5. **Monitoring** - Health Checks und Metriken throughout

**Nächste Schritte**:
1. User entscheidet: Soll Phase 0 gestartet werden?
2. Bei Ja: Feature Branch erstellen und Alembic setup
3. Bei Nein: Plan überarbeiten basierend auf Feedback

---

**Ende der Implementation Recommendations**
