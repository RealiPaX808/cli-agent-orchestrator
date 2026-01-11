# 🧠 Hive-Mind Analyse: CLI Agent Orchestrator Refactor

**Datum**: 2025-01-11
**Analyse-Typ**: Multi-Agent Swarm Koordination
**Status**: ✅ Abgeschlossen

## Executive Summary

Diese Analyse vergleicht den **zesty-pondering-lemon.md** Refactor-Plan mit dem aktuellen Zustand des **cli-agent-orchestrator** Projekts. Fünf Spezialisten-Agenten haben parallel analysiert:

- **Explore Agent**: Komplette Projektstruktur-Analyse
- **Researcher Agent**: Refactor-Plan Analyse
- **Coder Agent**: Implementierungs-Feasibility
- **Code-Architect Agent**: Architecture Gap Analysis
- **Risk-Manager Agent**: Risikoanalyse

---

## Entscheidung: **GO mit Bedingungen**

Der Refactor-Plan ist **architektonisch kompatibel** und **implementierbar**, erfordert jedoch sorgfältige Vorbereitung und schrittweise Implementierung.

---

## 1. Aktueller Projekt-Zustand

### 1.1 Existierende Komponenten (Wiederverwendbar)

| Komponente | Datei | Status |
|------------|-------|--------|
| BPMN 2.0 Models | `models/bpmn.py` (256 Zeilen) | ✅ Komplett, Token-basiert |
| BPMN Execution Engine | `services/bpmn_execution_engine.py` (419 Zeilen) | ✅ Funktioniert |
| Agent Profiles | `utils/agent_profiles.py` (58 Zeilen) | ✅ Markdown + YAML |
| Database | `clients/database.py` (1096 Zeilen) | ⚠️ 12 Tabellen, needs TDD |
| Frontend | `apps/dashboard/` | ⚠️ Types need update |

### 1.2 Existierende Datenbank-Tabellen

```
terminals, inbox, flows, workflows, workflow_nodes, workflow_edges,
session_workflows, terminal_states, tasks, task_assignments,
task_artifacts, workflow_executions
```

### 1.3 Was fehlt (Gap Analysis)

| Kategorie | Fehlt | Priorität |
|-----------|--------|-----------|
| DB Tabelle | `projects` (top-level org unit) | HOCH |
| DB Tabelle | `token_executions` (BPMN persistenz) | MITTEL |
| DB Tabelle | `workflow_versions` (Versionierung) | MITTEL |
| Service | `agent_resolver.py` | HOCH |
| Service | `task_tdd_service.py` | HOCH |
| Service | `task_orchestrator.py` | HOCH |
| BPMN Node | `TASK_CREATOR` | MANDATORY |
| BPMN Node | `TASK_ORCHESTRATOR` | MANDATORY |
| Frontend | `types/task.ts` | MITTEL |

---

## 2. Top 5 Kritische Risiken

### 1. [KRITISCH] Kein Migration-System

**Problem**: Aktuelles `init_db()` verwendet `create_all()` - kann keine ALTER TABLE migrations.

**Lösung**:
```bash
pip install alembic>=1.13.0
alembic init migrations
```

### 2. [KRITISCH] Agent Resolution Breaking Change

**Problem**: Existierende Workflows mit hardcoded `agent_profile` brechen.

**Lösung**: Backward Compatibility Layer:
```python
class LegacyAgentResolver(AgentResolver):
    def resolve_agent_for_task(self, task, available_agents):
        try:
            return super().resolve_agent_for_task(task, available_agents)
        except ValueError:
            # Fallback zu altem Verhalten
            return task.required_agent_profile
```

### 3. [HOCH] BPMN Engine Integration

**Problem**: Keine Handler für neue Node Types.

**Lösung**:
```python
# models/bpmn.py
class BPMNElementType(str, Enum):
    TASK_CREATOR = "taskCreator"      # NEW
    TASK_ORCHESTRATOR = "taskOrchestrator"  # NEW

# bpmn_execution_engine.py
async def _execute_task_creator(self, token, element):
    # Implementation needed
```

### 4. [HOCH] Race Conditions bei Terminal Creation

**Problem**: Doppelte Terminals bei paralleler Task-Zuweisung.

**Lösung**:
```sql
ALTER TABLE terminals ADD CONSTRAINT unique_agent_per_session
    UNIQUE (tmux_session, agent_profile);
```

### 5. [HOCH] TDD State Management

**Problem**: Keine Validierung für State Transitions.

**Lösung**:
```python
class TDDStateMachine:
    VALID_TRANSITIONS = {
        TestState.NONE: {TestState.PENDING, TestState.SKIPPED},
        TestState.PENDING: {TestState.RED, TestState.SKIPPED},
        TestState.RED: {TestState.GREEN, TestState.SKIPPED},
        TestState.GREEN: {TestState.RED, TestState.NONE},  # Regression
    }
```

---

## 3. Implementierungs-Plan

### Phase 0: Vorbereitung (1-2 Tage)

- [ ] Alembic setup
- [ ] Database backup
- [ ] Regression tests schreiben
- [ ] Feature branch erstellen

### Phase 1: Database Schema (1 Tag) - **CRITICAL PATH**

- [ ] Migration `001_add_tdd_support.py`
- [ ] projects table
- [ ] token_executions table
- [ ] workflow_versions table
- [ ] Task enhancements (8 columns)
- [ ] Indexes

### Phase 2: Service Layer (2-3 Tage)

- [ ] `services/agent_resolver.py`
- [ ] `services/task_tdd_service.py`
- [ ] `services/task_orchestrator.py`
- [ ] `task_service.py` extensions
- [ ] Unit tests

### Phase 3: API Layer (1 Tag)

- [ ] Task TDD endpoints
- [ ] Agent endpoints
- [ ] Project endpoints
- [ ] API tests

### Phase 4: BPMN Integration (2-3 Tage)

- [ ] TASK_CREATOR node type
- [ ] TASK_ORCHESTRATOR node type
- [ ] Execution handlers
- [ ] Token persistence
- [ ] BPMN tests

### Phase 5: Frontend (2-3 Tage)

- [ ] `types/task.ts`
- [ ] `types/project.ts`
- [ ] Task list UI with TDD states
- [ ] Agent selector
- [ ] E2E tests

### Phase 6: Rollout (2-3 Tage)

- [ ] Staging deployment
- [ ] Performance testing
- [ ] Documentation
- [ ] Production rollout

**Gesamt: 16-20 Tage (3-4 Wochen)**

---

## 4. Database Schema Changes

### 4.1 Neue Tabellen

```sql
-- Projects (top-level org unit)
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    path TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token Executions (BPMN persistenz)
CREATE TABLE token_executions (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    current_element_id TEXT,
    state TEXT NOT NULL DEFAULT 'active',
    data TEXT,
    parent_token_id TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id)
);

-- Workflow Versions
CREATE TABLE workflow_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    change_description TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id),
    UNIQUE(workflow_id, version)
);
```

### 4.2 Task Table Enhancements

```sql
-- TDD Support
ALTER TABLE tasks ADD COLUMN test_state TEXT DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN last_red_output TEXT;
ALTER TABLE tasks ADD COLUMN last_red_error TEXT;
ALTER TABLE tasks ADD COLUMN last_green_timestamp TIMESTAMP;

-- Agent Assignment
ALTER TABLE tasks ADD COLUMN required_agent_profile TEXT;
ALTER TABLE tasks ADD COLUMN assigned_agent_profile TEXT;
ALTER TABLE tasks ADD COLUMN assigned_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;

-- Hierarchy (für Task Splitting)
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT;
ALTER TABLE tasks ADD COLUMN split_strategy TEXT;
ALTER TABLE tasks ADD COLUMN split_metadata TEXT;

-- Indexes
CREATE INDEX idx_tasks_test_state ON tasks(test_state);
CREATE INDEX idx_tasks_agent_profile ON tasks(assigned_agent_profile);
CREATE INDEX idx_tasks_parent_task ON tasks(parent_task_id);
```

### 4.3 Task Assignment Enhancements

```sql
ALTER TABLE task_assignments ADD COLUMN agent_profile TEXT;
ALTER TABLE task_assignments ADD COLUMN agent_name TEXT;
ALTER TABLE task_assignments ADD COLUMN test_state_at_start TEXT DEFAULT 'none';
ALTER TABLE task_assignments ADD COLUMN test_state_at_end TEXT DEFAULT 'none';
```

---

## 5. Code Changes Summary

### 5.1 Files to Modify

| File | Lines | Complexity |
|------|-------|------------|
| `database.py` | +200 | HIGH |
| `bpmn.py` | +30 | LOW |
| `bpmn_execution_engine.py` | +50 | MEDIUM |
| `task_service.py` | +80 | MEDIUM |
| `agent_profiles.py` | +40 | LOW |
| `workflow.ts` | +20 | LOW |

### 5.2 Files to Create

| File | Purpose | Lines Est |
|------|---------|-----------|
| `services/agent_resolver.py` | Agent resolution | ~150 |
| `services/task_tdd_service.py` | TDD state mgmt | ~120 |
| `services/task_orchestrator.py` | Task assignment | ~180 |
| `api/project_endpoints.py` | Project CRUD | ~100 |
| `apps/dashboard/src/types/task.ts` | Frontend types | ~100 |
| `apps/dashboard/src/types/project.ts` | Project types | ~50 |

---

## 6. Empfehlungen

### DO's ✅

1. **Alembic zuerst** - Migration system vor Schema changes
2. **Feature Flags** - TDD support opt-in initially
3. **Backward Compatibility** - Legacy agent resolution fallback
4. **Test-First** - Migration tests vor implementation
5. **Incremental Rollout** - Phase-by-phase mit checkpoints

### DON'Ts ❌

1. **Keine breaking changes** ohne fallback
2. **Nicht skippen** der migration tests
3. **Nicht hardcoded** agent mappings
4. **Nicht ändern** existierende task IDs
5. **Nicht vergessen** frontend type sync

---

## 7. Next Steps

### Sofort (Diese Woche)

1. **Alembic Setup**
   ```bash
   cd /home/bdk01962/privat-repos/cli-agent-orchestrator
   echo "alembic>=1.13.0" >> pyproject.toml
   pip install alembic
   alembic init migrations
   ```

2. **Database Backup**
   ```bash
   cp data/cli_agent_orchestrator.db backups/pre_tdd_$(date +%Y%m%d).db
   ```

3. **Feature Branch**
   ```bash
   git checkout -b feature/tdd-support
   ```

### Phase 1 Start (Nächste Woche)

1. Erste Alembic migration erstellen
2. projects table implementieren
3. Token execution tracking

---

## 8. Anhänge

### A. Agent Output Referenzen

- Explore Agent: `agentId: a1efba2`
- Researcher Agent: `agentId: ad89e14`
- Coder Agent: `agentId: a44d897`
- Code-Architect Agent: `agentId: ae17092`
- Risk-Manager Agent: `agentId: a7d1ed5`

### B. Dateireferenzen

- Plan: `/home/bdk01962/.claude/plans/zesty-pondering-lemon.md`
- Projekt: `/home/bdk01962/privat-repos/cli-agent-orchestrator/`
- Architecture Doc: `ARCHITECTURE_TASK_TDD.md`
- Database: `src/cli_agent_orchestrator/clients/database.py`
- BPMN Models: `src/cli_agent_orchestrator/models/bpmn.py`
- Agent Utils: `src/cli_agent_orchestrator/utils/agent_profiles.py`

---

**Ende der Analyse**
