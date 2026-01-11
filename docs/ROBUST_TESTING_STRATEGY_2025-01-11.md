# Robust Testing Strategy for CLI Agent Orchestrator

**Date**: 2025-01-11  
**Version**: 1.0  
**Status**: Active

---

## Executive Summary

This document provides a comprehensive testing strategy for the CLI Agent Orchestrator (CAO) project. The current codebase comprises **54 Python modules** with **7,849 lines of source code** and only **11 test files** with **2,220 lines of test code**. This strategy aims to achieve **90%+ test coverage** with **70%+ automation** while maintaining practical, maintainable, and fast tests.

### Current State Assessment

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Source Files (Python) | 54 | - | - |
| Test Files | 11 | 54 | 43 |
| Source LOC | 7,849 | - | - |
| Test LOC | 2,220 | ~6,000 | 3,780 |
| Test Coverage | ~15% (est.) | 90% | 75% |
| Unit Tests | 8 | 48 | 40 |
| Integration Tests | 2 | 12 | 10 |
| E2E Tests | 1 | 6 | 5 |
| Test Automation | 0% | 70% | 70% |

### Current Test Coverage by Module

| Module | Coverage | Status | Priority |
|--------|----------|--------|----------|
| `providers/claude_code.py` | ~85% | Good | Maintain |
| `providers/q_cli.py` | ~80% | Good | Maintain |
| `providers/kiro_cli.py` | 0% | Missing | High |
| `providers/manager.py` | 0% | Missing | High |
| `providers/base.py` | 0% | Missing | Medium |
| `services/session_service.py` | 0% | Missing | High |
| `services/terminal_service.py` | 0% | Missing | High |
| `services/bpmn_execution_engine.py` | 0% | Missing | High |
| `services/inbox_service.py` | 0% | Missing | High |
| `services/workflow_execution_service.py` | 0% | Missing | High |
| `clients/tmux.py` | 0% | Missing | High |
| `clients/database.py` | ~5% | Minimal | High |
| `api/main.py` | ~10% | Minimal | High |
| `models/*` | 0% | Missing | Medium |

---

## 1. Testing Philosophy

### Core Principles

1. **Test-First Development (TDD)**: Write tests before implementation for new features
2. **Fast Feedback**: Unit tests should run in < 2 seconds total
3. **Isolation**: Each test should be independent and order-independent
4. **Practicality**: Avoid over-testing; focus on business logic and critical paths
5. **Maintainability**: Tests should be as readable as production code

### Testing Goals

- **Coverage**: 90% line coverage, 100% for critical paths
- **Speed**: Full test suite under 30 seconds
- **Reliability**: < 1% flaky test rate
- **Documentation**: Tests serve as living documentation

---

## 2. Test Pyramid

```
                 /\
                /  \
               / E2E \         5% (6 tests)
              /------\
             /        \
            /Integration\    15% (12 tests)
           /------------\
          /              \
         /    Unit Tests  \  80% (48+ tests)
        /------------------\
```

### Unit Tests (80% - Target: 48+ test files)

**Purpose**: Verify individual functions and classes in isolation

**Scope**:
- Single function/method behavior
- Class state management
- Input validation and error handling
- Edge cases and boundary conditions

**Execution Time**: < 2 seconds total
**Dependencies**: Mocked external services (tmux, database, APIs)

### Integration Tests (15% - Target: 12 test files)

**Purpose**: Verify interaction between components

**Scope**:
- Provider + Database interaction
- Service + Client integration
- API endpoint + Service layer
- Workflow execution with mocked agents

**Execution Time**: < 15 seconds total
**Dependencies**: Real database (in-memory), mocked tmux

### E2E Tests (5% - Target: 6 test files)

**Purpose**: Verify complete user workflows

**Scope**:
- Session creation and terminal spawning
- Complete agent handoff scenarios
- Workflow execution from start to finish
- Inbox message delivery

**Execution Time**: < 30 seconds total
**Dependencies**: Real tmux, real database, real provider (Q CLI or Claude Code)

---

## 3. Test Organization

### Directory Structure

```
test/
├── unit/                          # Unit tests (80%)
│   ├── providers/                 # Provider unit tests
│   │   ├── test_base_provider.py
│   │   ├── test_claude_code.py
│   │   ├── test_q_cli.py
│   │   ├── test_kiro_cli.py
│   │   ├── test_gemini_cli.py
│   │   ├── test_qwen_cli.py
│   │   ├── test_gh_copilot.py
│   │   ├── test_opencode.py
│   │   └── test_manager.py
│   ├── services/                  # Service unit tests
│   │   ├── test_session_service.py
│   │   ├── test_terminal_service.py
│   │   ├── test_inbox_service.py
│   │   ├── test_flow_service.py
│   │   ├── test_bpmn_execution_engine.py
│   │   ├── test_workflow_execution_service.py
│   │   ├── test_cleanup_service.py
│   │   └── test_expression_evaluator.py
│   ├── clients/                   # Client unit tests
│   │   ├── test_tmux.py
│   │   └── test_database.py
│   ├── models/                    # Model tests
│   │   ├── test_terminal.py
│   │   ├── test_session.py
│   │   ├── test_inbox.py
│   │   ├── test_flow.py
│   │   ├── test_bpmn.py
│   │   └── test_agent_profile.py
│   ├── api/                       # API unit tests
│   │   ├── test_main_endpoints.py
│   │   ├── test_task_endpoints.py
│   │   └── test_websocket.py
│   └── utils/                     # Utility tests
│       ├── test_terminal_utils.py
│       ├── test_agent_profiles.py
│       ├── test_template.py
│       └── test_logging.py
├── integration/                   # Integration tests (15%)
│   ├── test_provider_integration.py
│   ├── test_service_integration.py
│   ├── test_api_integration.py
│   ├── test_workflow_integration.py
│   ├── test_inbox_integration.py
│   └── test_bpmn_integration.py
├── e2e/                           # E2E tests (5%)
│   ├── test_session_lifecycle.py
│   ├── test_agent_handoff.py
│   ├── test_workflow_execution.py
│   ├── test_inbox_delivery.py
│   ├── test_multi_agent_session.py
│   └── test_error_recovery.py
├── fixtures/                      # Test fixtures and data
│   ├── __init__.py
│   ├── database.py
│   ├── tmux.py
│   ├── providers.py
│   └── workflows.py
├── conftest.py                    # Shared pytest configuration
└── __init__.py
```

---

## 4. Unit Test Templates

### Base Provider Test Template

```python
# test/unit/providers/test_base_provider.py
"""Unit tests for BaseProvider abstract class."""

import pytest
from unittest.mock import Mock, patch

from cli_agent_orchestrator.providers.base import BaseProvider
from cli_agent_orchestrator.models.terminal import TerminalStatus


class TestBaseProvider:
    """Test BaseProvider abstract interface."""
    
    def test_cannot_instantiate_base_provider(self):
        """BaseProvider should not be instantiable directly."""
        with pytest.raises(TypeError):
            BaseProvider("test_id", "test_session", "test_window")
    
    def test_provider_attributes(self):
        """Test provider attribute initialization."""
        # Create a concrete implementation for testing
        class ConcreteProvider(BaseProvider):
            def initialize(self) -> bool:
                return True
            def get_status(self, tail_lines: int = None) -> TerminalStatus:
                return TerminalStatus.IDLE
            def get_idle_pattern_for_log(self) -> str:
                return "idle_pattern"
            def extract_last_message_from_script(self, script_output: str) -> str:
                return "message"
            def exit_cli(self) -> str:
                return "/exit"
            def cleanup(self) -> None:
                pass
        
        provider = ConcreteProvider("test_id", "test_session", "test_window")
        
        assert provider.terminal_id == "test_id"
        assert provider.session_name == "test_session"
        assert provider.window_name == "test_window"
        assert provider.status == TerminalStatus.IDLE
    
    def test_status_update(self):
        """Test internal status update mechanism."""
        class ConcreteProvider(BaseProvider):
            def initialize(self) -> bool:
                self._update_status(TerminalStatus.PROCESSING)
                return True
            def get_status(self, tail_lines: int = None) -> TerminalStatus:
                return self._status
            def get_idle_pattern_for_log(self) -> str:
                return "idle"
            def extract_last_message_from_script(self, script_output: str) -> str:
                return "msg"
            def exit_cli(self) -> str:
                return "/exit"
            def cleanup(self) -> None:
                pass
        
        provider = ConcreteProvider("id", "sess", "win")
        provider.initialize()
        assert provider.get_status() == TerminalStatus.PROCESSING
```

### Service Test Template

```python
# test/unit/services/test_session_service.py
"""Unit tests for session service."""

import pytest
from unittest.mock import Mock, patch, MagicMock

from cli_agent_orchestrator.services import session_service


class TestListSessions:
    """Test list_sessions function."""
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_list_sessions_success(self, mock_tmux):
        """Test successful session listing."""
        mock_tmux.list_sessions.return_value = [
            {"id": "cao-session-1", "name": "cao-session-1", "status": "active"},
            {"id": "cao-session-2", "name": "cao-session-2", "status": "detached"},
            {"id": "other-session", "name": "other-session", "status": "detached"},
        ]
        
        result = session_service.list_sessions()
        
        assert len(result) == 2
        assert all(s["id"].startswith("cao-") for s in result)
        assert result[0]["id"] == "cao-session-1"
        assert result[1]["id"] == "cao-session-2"
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_list_sessions_empty(self, mock_tmux):
        """Test listing when no sessions exist."""
        mock_tmux.list_sessions.return_value = []
        
        result = session_service.list_sessions()
        
        assert result == []
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_list_sessions_tmux_error(self, mock_tmux):
        """Test error handling when tmux fails."""
        mock_tmux.list_sessions.side_effect = Exception("Tmux error")
        
        result = session_service.list_sessions()
        
        assert result == []


class TestGetSession:
    """Test get_session function."""
    
    @patch("cli_agent_orchestrator.services.session_service.list_terminals_by_session")
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_get_session_success(self, mock_tmux, mock_list_terminals):
        """Test successful session retrieval."""
        mock_tmux.session_exists.return_value = True
        mock_tmux.list_sessions.return_value = [
            {"id": "cao-test", "name": "cao-test", "status": "active"}
        ]
        mock_list_terminals.return_value = [
            {
                "id": "term-1",
                "tmux_session": "cao-test",
                "tmux_window": "window-0",
                "provider": "q_cli",
                "agent_profile": "developer",
            }
        ]
        
        result = session_service.get_session("cao-test")
        
        assert result["session"]["id"] == "cao-test"
        assert len(result["terminals"]) == 1
        assert result["terminals"][0]["id"] == "term-1"
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_get_session_not_found(self, mock_tmux):
        """Test error when session doesn't exist."""
        mock_tmux.session_exists.return_value = False
        
        with pytest.raises(ValueError, match="not found"):
            session_service.get_session("nonexistent")


class TestDeleteSession:
    """Test delete_session function."""
    
    @patch("cli_agent_orchestrator.services.session_service.delete_terminals_by_session")
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    @patch("cli_agent_orchestrator.services.session_service.provider_manager")
    @patch("cli_agent_orchestrator.services.session_service.db_unassign_workflow")
    def test_delete_session_success(
        self, mock_unassign, mock_provider_mgr, mock_tmux, mock_delete_terms
    ):
        """Test successful session deletion."""
        mock_tmux.session_exists.return_value = True
        mock_delete_terms.return_value = [
            {
                "id": "term-1",
                "tmux_session": "cao-test",
                "tmux_window": "window-0",
            }
        ]
        
        result = session_service.delete_session("cao-test")
        
        assert result is True
        mock_provider_mgr.cleanup_provider.assert_called_once_with("term-1")
        mock_tmux.kill_session.assert_called_once_with("cao-test")
        mock_unassign.assert_called_once_with("cao-test")
```

### Database Test Template

```python
# test/unit/clients/test_database.py
"""Unit tests for database client."""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

from cli_agent_orchestrator.clients import database
from cli_agent_orchestrator.models.inbox import MessageStatus


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    with patch("cli_agent_orchestrator.clients.database.SessionLocal") as mock:
        session = MagicMock()
        mock.return_value.__enter__.return_value = session
        mock.return_value.__exit__.return_value = False
        yield session


class TestTerminalOperations:
    """Test terminal database operations."""
    
    def test_create_terminal(self, mock_session):
        """Test creating terminal metadata."""
        mock_terminal = Mock()
        mock_terminal.id = "test-123"
        mock_session.add.return_value = None
        mock_session.commit.return_value = None
        
        result = database.create_terminal(
            terminal_id="test-123",
            tmux_session="cao-session",
            tmux_window="window-0",
            provider="q_cli",
            agent_profile="developer"
        )
        
        assert result["id"] == "test-123"
        assert result["provider"] == "q_cli"
        assert result["agent_profile"] == "developer"
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
    
    def test_get_terminal_metadata_success(self, mock_session):
        """Test retrieving terminal metadata."""
        mock_terminal = Mock()
        mock_terminal.id = "test-123"
        mock_terminal.tmux_session = "cao-session"
        mock_terminal.tmux_window = "window-0"
        mock_terminal.provider = "q_cli"
        mock_terminal.agent_profile = "developer"
        mock_terminal.last_active = datetime.now()
        
        mock_query = Mock()
        mock_query.filter.return_value.first.return_value = mock_terminal
        mock_session.query.return_value = mock_query
        
        result = database.get_terminal_metadata("test-123")
        
        assert result is not None
        assert result["id"] == "test-123"
        assert result["provider"] == "q_cli"
    
    def test_get_terminal_metadata_not_found(self, mock_session):
        """Test retrieving non-existent terminal."""
        mock_query = Mock()
        mock_query.filter.return_value.first.return_value = None
        mock_session.query.return_value = mock_query
        
        result = database.get_terminal_metadata("nonexistent")
        
        assert result is None
    
    def test_delete_terminal(self, mock_session):
        """Test deleting terminal."""
        mock_query = Mock()
        mock_query.filter.return_value.delete.return_value = 1
        mock_session.query.return_value = mock_query
        
        result = database.delete_terminal("test-123")
        
        assert result is True
        mock_session.commit.assert_called_once()


class TestInboxOperations:
    """Test inbox message database operations."""
    
    def test_create_inbox_message(self, mock_session):
        """Test creating inbox message."""
        mock_msg = Mock()
        mock_msg.id = 1
        mock_msg.sender_id = "sender-1"
        mock_msg.receiver_id = "receiver-1"
        mock_msg.message = "Hello world"
        mock_msg.status = MessageStatus.PENDING.value
        mock_msg.created_at = datetime.now()
        mock_session.add.return_value = None
        mock_session.commit.return_value = None
        mock_session.refresh.return_value = None
        
        result = database.create_inbox_message(
            sender_id="sender-1",
            receiver_id="receiver-1",
            message="Hello world"
        )
        
        assert result.sender_id == "sender-1"
        assert result.receiver_id == "receiver-1"
        assert result.status == MessageStatus.PENDING
    
    @pytest.mark.parametrize("status,limit,expected_count", [
        (None, 10, 3),
        (MessageStatus.PENDING, 10, 2),
        (MessageStatus.DELIVERED, 10, 1),
        (None, 1, 1),
    ])
    def test_get_inbox_messages_with_filters(self, mock_session, status, limit, expected_count):
        """Test getting inbox messages with various filters."""
        mock_messages = [
            Mock(id=1, sender_id="s1", receiver_id="r1", message="msg1", 
                  status=MessageStatus.PENDING.value, created_at=datetime.now()),
            Mock(id=2, sender_id="s2", receiver_id="r1", message="msg2",
                  status=MessageStatus.PENDING.value, created_at=datetime.now()),
            Mock(id=3, sender_id="s3", receiver_id="r1", message="msg3",
                  status=MessageStatus.DELIVERED.value, created_at=datetime.now()),
        ]
        
        mock_query = Mock()
        if status:
            filtered = [m for m in mock_messages if m.status == status.value]
            mock_query.filter.return_value.order_by.return_value.limit.return_value.all.return_value = filtered[:limit]
        else:
            mock_query.filter.return_value = mock_query
            mock_query.order_by.return_value.limit.return_value.all.return_value = mock_messages[:limit]
        
        mock_session.query.return_value = mock_query
        
        result = database.get_inbox_messages("r1", limit=limit, status=status)
        
        assert len(result) <= limit
```

### BPMN Engine Test Template

```python
# test/unit/services/test_bpmn_execution_engine.py
"""Unit tests for BPMN execution engine."""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock

from cli_agent_orchestrator.services.bpmn_execution_engine import BPMNExecutionEngine
from cli_agent_orchestrator.models.bpmn import (
    BPMNProcess, BPMNEvent, BPMNElementType, ServiceTask,
    ScriptTask, ExclusiveGateway, ParallelGateway, SequenceFlow,
    Token, TokenState, ProcessInstance
)


@pytest.fixture
def sample_process():
    """Create a sample BPMN process for testing."""
    start_event = BPMNEvent(
        id="start", type=BPMNElementType.START_EVENT, name="Start"
    )
    
    service_task = ServiceTask(
        id="task1",
        type=BPMNElementType.SERVICE_TASK,
        name="Task 1",
        agent_profile="developer",
        provider="q_cli",
        task_template="Do something",
        wait_for_completion=True
    )
    
    end_event = BPMNEvent(
        id="end", type=BPMNElementType.END_EVENT, name="End"
    )
    
    flow1 = SequenceFlow(id="flow1", source_ref="start", target_ref="task1")
    flow2 = SequenceFlow(id="flow2", source_ref="task1", target_ref="end")
    
    return BPMNProcess(
        id="test-process",
        name="Test Process",
        elements={
            "start": start_event,
            "task1": service_task,
            "end": end_event
        },
        sequence_flows={
            "flow1": flow1,
            "flow2": flow2
        }
    )


@pytest.fixture
def mock_engine():
    """Create a mock BPMN execution engine."""
    with patch("cli_agent_orchestrator.services.bpmn_execution_engine.tmux_client"), \
         patch("cli_agent_orchestrator.services.bpmn_execution_engine.provider_manager"):
        
        mock_terminal_service = Mock()
        mock_terminal_service.create_terminal.return_value = Mock(id="term-1")
        mock_terminal_service.send_direct_input = Mock()
        mock_terminal_service.get_terminal_info = Mock(return_value={"status": "COMPLETED"})
        mock_terminal_service.get_terminal_output = Mock(return_value={"content": "Done"})
        
        mock_evaluator = Mock()
        mock_evaluator.render_template = Mock(return_value="Rendered task")
        mock_evaluator.evaluate = Mock(return_value="result")
        
        process = BPMNProcess(
            id="test", name="Test",
            elements={"start": BPMNEvent(id="start", type=BPMNElementType.START_EVENT)},
            sequence_flows={}
        )
        
        engine = BPMNExecutionEngine(
            process=process,
            session_name="test-session",
            terminal_service=mock_terminal_service,
            expression_evaluator=mock_evaluator
        )
        
        yield engine, mock_terminal_service, mock_evaluator


class TestBPMNExecutionEngine:
    """Test BPMN execution engine core functionality."""
    
    @pytest.mark.asyncio
    async def test_execute_simple_process(self, sample_process):
        """Test execution of a simple start-end process."""
        with patch("cli_agent_orchestrator.services.bpmn_execution_engine.tmux_client"), \
             patch("cli_agent_orchestrator.services.bpmn_execution_engine.provider_manager"):
            
            mock_terminal_service = Mock()
            mock_terminal_service.create_terminal.return_value = Mock(id="term-1")
            mock_terminal_service.send_direct_input = Mock()
            mock_terminal_service.get_terminal_info = Mock(return_value={"status": "COMPLETED"})
            
            mock_evaluator = Mock()
            mock_evaluator.render_template = Mock(return_value="Task")
            mock_evaluator.evaluate = Mock(return_value="result")
            
            engine = BPMNExecutionEngine(
                process=sample_process,
                session_name="test-session",
                terminal_service=mock_terminal_service,
                expression_evaluator=mock_evaluator
            )
            
            # Execute the process
            result = await engine.execute()
            
            assert isinstance(result, ProcessInstance)
            assert result.process_id == "test-process"
            assert result.session_name == "test-session"
    
    @pytest.mark.asyncio
    async def test_execute_service_task_with_wait(self, mock_engine):
        """Test service task execution with wait_for_completion=True."""
        engine, mock_terminal_service, mock_evaluator = mock_engine
        
        service_task = ServiceTask(
            id="task1",
            type=BPMNElementType.SERVICE_TASK,
            agent_profile="developer",
            provider="q_cli",
            task_template="Test task with {{var}}",
            wait_for_completion=True,
            timeout=300
        )
        
        token = Token(
            id="token1", 
            current_element_id="task1",
            state=TokenState.ACTIVE
        )
        engine.instance.add_token(token)
        engine.process.elements["task1"] = service_task
        engine.process.sequence_flows["flow1"] = SequenceFlow(
            id="flow1", source_ref="task1", target_ref="end"
        )
        
        await engine._execute_service_task(token, service_task)
        
        mock_terminal_service.create_terminal.assert_called_once()
        mock_terminal_service.send_direct_input.assert_called_with("term-1", "Rendered task")
    
    @pytest.mark.asyncio
    async def test_execute_script_task(self, mock_engine):
        """Test script task execution."""
        engine, mock_terminal_service, mock_evaluator = mock_engine
        
        script_task = ScriptTask(
            id="script1",
            type=BPMNElementType.SCRIPT_TASK,
            script_format="python",
            script="result = x + y"
        )
        
        token = Token(
            id="token1",
            current_element_id="script1",
            state=TokenState.ACTIVE,
            data={"x": 5, "y": 3}
        )
        engine.instance.add_token(token)
        engine.process.elements["script1"] = script_task
        engine.process.sequence_flows["flow1"] = SequenceFlow(
            id="flow1", source_ref="script1", target_ref="end"
        )
        mock_evaluator.evaluate.return_value = 8
        
        await engine._execute_script_task(token, script_task)
        
        assert token.data["output"] == 8
        mock_evaluator.evaluate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_xor_gateway_split(self, mock_engine):
        """Test exclusive gateway (XOR) split behavior."""
        engine, mock_terminal_service, mock_evaluator = mock_engine
        
        gateway = ExclusiveGateway(
            id="xor1",
            type=BPMNElementType.EXCLUSIVE_GATEWAY,
            direction="Diverging",
            default_flow="flow_default"
        )
        
        flow1 = SequenceFlow(
            id="flow1", source_ref="xor1", target_ref="task1",
            condition_expression="x > 5"
        )
        flow2 = SequenceFlow(
            id="flow2", source_ref="xor1", target_ref="task2",
            condition_expression="x <= 5"
        )
        flow_default = SequenceFlow(
            id="flow_default", source_ref="xor1", target_ref="default"
        )
        
        token = Token(
            id="token1",
            current_element_id="xor1",
            state=TokenState.ACTIVE,
            data={"x": 10}
        )
        engine.instance.add_token(token)
        engine.process.elements["xor1"] = gateway
        engine.process.sequence_flows = {
            "flow1": flow1,
            "flow2": flow2,
            "flow_default": flow_default
        }
        engine.process.get_element = Mock(side_effect=lambda eid: engine.process.elements.get(eid))
        engine.process.get_sequence_flow = Mock(side_effect=lambda fid: engine.process.sequence_flows.get(fid))
        
        mock_evaluator.evaluate.side_effect = lambda expr, ctx: ctx["x"] > 5 if "x > 5" in expr else False
        
        await engine._execute_xor_split(token, gateway)
        
        # Should take flow1 since x=10 > 5
        assert token.current_element_id == "task1"
    
    @pytest.mark.asyncio
    async def test_parallel_gateway_split(self, mock_engine):
        """Test parallel gateway (AND) split spawns multiple tokens."""
        engine, mock_terminal_service, mock_evaluator = mock_engine
        
        gateway = ParallelGateway(
            id="and1",
            type=BPMNElementType.PARALLEL_GATEWAY,
            direction="Diverging"
        )
        
        flow1 = SequenceFlow(id="flow1", source_ref="and1", target_ref="task1")
        flow2 = SequenceFlow(id="flow2", source_ref="and1", target_ref="task2")
        
        token = Token(
            id="parent_token",
            current_element_id="and1",
            state=TokenState.ACTIVE
        )
        engine.instance.add_token(token)
        engine.process.elements["and1"] = gateway
        engine.process.sequence_flows = {"flow1": flow1, "flow2": flow2}
        engine.process.get_sequence_flow = Mock(side_effect=lambda fid: engine.process.sequence_flows.get(fid))
        
        await engine._execute_and_split(token, gateway)
        
        # Parent token should be completed
        assert token.state == TokenState.COMPLETED
        # Two child tokens should be created
        assert len([t for t in engine.instance.tokens.values() if t.parent_token_id == "parent_token"]) == 2
```

---

## 5. Integration Test Templates

```python
# test/integration/test_provider_integration.py
"""Integration tests for provider + tmux + database."""

import pytest
import asyncio
from pathlib import Path
from unittest.mock import patch

from cli_agent_orchestrator.providers.manager import ProviderManager
from cli_agent_orchestrator.providers.q_cli import QCliProvider
from cli_agent_orchestrator.clients.database import create_terminal, get_terminal_metadata


@pytest.mark.integration
class TestProviderDatabaseIntegration:
    """Test provider and database integration."""
    
    @pytest.fixture
    def clean_database(self):
        """Ensure clean database state."""
        from cli_agent_orchestrator.clients.database import SessionLocal, TerminalModel
        
        with SessionLocal() as db:
            db.query(TerminalModel).filter(
                TerminalModel.id.like("test-integration-%")
            ).delete()
            db.commit()
        yield
        # Cleanup
        with SessionLocal() as db:
            db.query(TerminalModel).filter(
                TerminalModel.id.like("test-integration-%")
            ).delete()
            db.commit()
    
    @pytest.mark.skipif(not pytest.config.getoption("--run-tmux"), reason="Need real tmux")
    def test_create_and_retrieve_terminal(self, clean_database):
        """Test creating terminal and retrieving from database."""
        terminal_id = "test-integration-001"
        
        # Create terminal in database
        create_terminal(
            terminal_id=terminal_id,
            tmux_session="test-session",
            tmux_window="test-window",
            provider="q_cli",
            agent_profile="developer"
        )
        
        # Retrieve from database
        metadata = get_terminal_metadata(terminal_id)
        
        assert metadata is not None
        assert metadata["id"] == terminal_id
        assert metadata["provider"] == "q_cli"
        assert metadata["agent_profile"] == "developer"
    
    def test_provider_manager_on_demand_creation(self, clean_database):
        """Test ProviderManager creates provider on-demand from database."""
        terminal_id = "test-integration-002"
        
        # Create terminal in database
        create_terminal(
            terminal_id=terminal_id,
            tmux_session="test-session",
            tmux_window="test-window",
            provider="q_cli",
            agent_profile="developer"
        )
        
        # ProviderManager should create provider from database metadata
        manager = ProviderManager()
        provider = manager.get_provider(terminal_id)
        
        assert provider is not None
        assert isinstance(provider, QCliProvider)
        assert provider.terminal_id == terminal_id
        assert provider._agent_profile == "developer"
```

---

## 6. E2E Test Templates

```python
# test/e2e/test_session_lifecycle.py
"""E2E tests for complete session lifecycle."""

import pytest
import uuid
from pathlib import Path

from cli_agent_orchestrator.clients.tmux import tmux_client
from cli_agent_orchestrator.clients.database import create_terminal, get_terminal_metadata
from cli_agent_orchestrator.providers.manager import provider_manager


@pytest.mark.e2e
@pytest.mark.slow
class TestSessionLifecycle:
    """Test complete session creation, usage, and deletion."""
    
    @pytest.fixture
    def unique_session(self):
        """Generate unique session name for each test."""
        session_name = f"e2e-test-{uuid.uuid4().hex[:8]}"
        yield session_name
        # Cleanup
        try:
            tmux_client.kill_session(session_name)
        except:
            pass
    
    def test_full_session_lifecycle(self, unique_session):
        """Test: Create session -> Create terminal -> Send input -> Get output -> Delete."""
        # 1. Create tmux session
        window_name = tmux_client.create_session(
            session_name=unique_session,
            window_name="main",
            terminal_id="e2e-test-001"
        )
        assert window_name == "main"
        
        # 2. Verify session exists
        assert tmux_client.session_exists(unique_session)
        
        # 3. Create terminal in database
        terminal_id = f"e2e-{uuid.uuid4().hex[:8]}"
        create_terminal(
            terminal_id=terminal_id,
            tmux_session=unique_session,
            tmux_window=window_name,
            provider="q_cli",
            agent_profile="developer"
        )
        
        # 4. Verify terminal in database
        metadata = get_terminal_metadata(terminal_id)
        assert metadata is not None
        assert metadata["tmux_session"] == unique_session
        
        # 5. Send input via tmux
        tmux_client.send_keys(unique_session, window_name, "echo 'Hello E2E'")
        
        # 6. Get output
        output = tmux_client.get_history(unique_session, window_name)
        assert "echo 'Hello E2E'" in output or "Hello E2E" in output
        
        # 7. Cleanup
        provider_manager.cleanup_provider(terminal_id)
        tmux_client.kill_session(unique_session)
        
        # 8. Verify cleanup
        assert not tmux_client.session_exists(unique_session)
```

---

## 7. Test Fixtures

```python
# test/fixtures/database.py
"""Database fixtures for testing."""

import pytest
from pathlib import Path
from tempfile import TemporaryDirectory

from cli_agent_orchestrator.clients.database import (
    Base, engine, SessionLocal, TerminalModel, 
    InboxModel, FlowModel, WorkflowModel
)


@pytest.fixture(scope="function")
def temp_database():
    """Create a temporary in-memory database for testing."""
    temp_dir = TemporaryDirectory()
    db_path = Path(temp_dir.name) / "test.db"
    
    # Create new engine with test database
    from sqlalchemy import create_engine
    test_engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=test_engine)
    
    from sqlalchemy.orm import sessionmaker
    TestSessionLocal = sessionmaker(bind=test_engine)
    
    # Patch the SessionLocal
    import cli_agent_orchestrator.clients.database as db_module
    original_session = db_module.SessionLocal
    db_module.SessionLocal = TestSessionLocal
    db_module.engine = test_engine
    
    yield db_path
    
    # Cleanup
    db_module.SessionLocal = original_session
    db_module.engine = engine
    temp_dir.cleanup()


@pytest.fixture
def sample_terminal_data():
    """Sample terminal data for tests."""
    return {
        "id": "test-term-001",
        "tmux_session": "cao-test-session",
        "tmux_window": "window-0",
        "provider": "q_cli",
        "agent_profile": "developer"
    }


@pytest.fixture
def sample_workflow_data():
    """Sample workflow data for tests."""
    return {
        "id": "workflow-001",
        "name": "Test Workflow",
        "description": "A test workflow for E2E testing",
        "nodes": [
            {
                "id": "start",
                "type": "startEvent",
                "data": {"label": "Start"},
                "position": {"x": 100, "y": 100}
            },
            {
                "id": "task-1",
                "type": "serviceTask",
                "data": {
                    "label": "Code Review",
                    "agent_profile": "code-reviewer",
                    "provider": "q_cli",
                    "task_template": "Review the following code"
                },
                "position": {"x": 300, "y": 100}
            },
            {
                "id": "end",
                "type": "endEvent",
                "data": {"label": "End"},
                "position": {"x": 500, "y": 100}
            }
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "task-1"},
            {"id": "e2", "source": "task-1", "target": "end"}
        ]
    }
```


@pytest.fixture
def sample_session():
    """Create a sample tmux session for testing."""
    session_name = f"test-session-{uuid.uuid4().hex[:8]}"
    window_name = f"test-window"
    terminal_id = f"test-terminal-{uuid.uuid4().hex[:8]}"
    
    tmux_client.create_session(session_name, window_name, terminal_id)
    
    yield {
        "session_name": session_name,
        "window_name": window_name,
        "terminal_id": terminal_id
    }
    
    # Cleanup
    try:
        tmux_client.kill_session(session_name)
    except:
        pass


@pytest.fixture
def mock_tmux_output():
    """Mock tmux output with various states."""
    return {
        "idle": "\x1b[36m[developer]\x1b[35m>\x1b[39m ",
        "processing": "✶ Processing...\x1b[0mctrl+c to interrupt",
        "completed": "\x1b[38;5;10m> \x1b[39mTask completed\n\x1b[36m[developer]\x1b[35m>\x1b[39m ",
        "error": "Error: Command failed\n\x1b[36m[developer]\x1b[35m>\x1b[39m "
    }
```

---

## 8. Test Data Management

### Test Data Strategy

1. **Fixtures**: Use pytest fixtures for reusable test data
2. **Factories**: Use factory pattern for complex objects
3. **Isolation**: Each test gets isolated data
4. **Cleanup**: Automatic cleanup after each test
5. **Determinism**: Use seeded random data for reproducibility

### Test Database

```python
# test/fixtures/factory.py
"""Test data factories."""

from dataclasses import dataclass
from typing import Optional
from datetime import datetime, timedelta
import random
import string

from cli_agent_orchestrator.models.terminal import Terminal, TerminalStatus, TerminalId
from cli_agent_orchestrator.models.inbox import InboxMessage, MessageStatus
from cli_agent_orchestrator.models.flow import Flow


class TerminalFactory:
    """Factory for creating Terminal objects."""
    
    @staticmethod
    def create(
        id: Optional[str] = None,
        provider: str = "q_cli",
        agent_profile: str = "developer",
        status: TerminalStatus = TerminalStatus.IDLE
    ) -> Terminal:
        """Create a Terminal instance with test data."""
        if id is None:
            id = f"term-{''.join(random.choices(string.ascii_lowercase, k=8))}"
        
        return Terminal(
            id=id,
            name=f"window-{random.randint(0, 10)}",
            session_name=f"cao-session-{random.randint(1000, 9999)}",
            provider=provider,
            agent_profile=agent_profile,
            status=status,
            last_active=datetime.now() - timedelta(minutes=random.randint(0, 60))
        )


class InboxMessageFactory:
    """Factory for creating InboxMessage objects."""
    
    @staticmethod
    def create(
        sender_id: Optional[str] = None,
        receiver_id: Optional[str] = None,
        message: Optional[str] = None,
        status: MessageStatus = MessageStatus.PENDING
    ) -> InboxMessage:
        """Create an InboxMessage instance with test data."""
        if sender_id is None:
            sender_id = f"sender-{''.join(random.choices(string.ascii_lowercase, k=4))}"
        if receiver_id is None:
            receiver_id = f"receiver-{''.join(random.choices(string.ascii_lowercase, k=4))}"
        if message is None:
            message = f"Test message {''.join(random.choices(string.ascii_lowercase, k=20))}"
        
        return InboxMessage(
            id=random.randint(1000, 9999),
            sender_id=sender_id,
            receiver_id=receiver_id,
            message=message,
            status=status,
            created_at=datetime.now() - timedelta(minutes=random.randint(0, 120))
        )
```

---

## 9. TDD Implementation Workflow

### Red-Green-Refactor Cycle

```python
# Example: Adding new terminal status detection

# STEP 1: RED - Write failing test
def test_detect_waiting_for_approval_status():
    """Test: System detects waiting-for-approval status."""
    output = """
    The following action requires approval:
    - Read file /etc/passwd
    - Execute system command
    
    Approve? [y/n]:
    [developer]>
    """
    provider = QCliProvider("id", "session", "window", "developer")
    status = provider.get_status(output)
    assert status == TerminalStatus.WAITING_USER_APPROVAL

# STEP 2: GREEN - Write minimal implementation
# In q_cli.py:
# WAITING_APPROVAL_PATTERN = re.compile(r"Approve\? \[y/n\]")

# def get_status(self, tail_lines: int = None) -> TerminalStatus:
#     output = tmux_client.get_history(...)
#     if self._WAITING_APPROVAL_PATTERN.search(output):
#         return TerminalStatus.WAITING_USER_APPROVAL
#     # ... existing logic

# STEP 3: REFACTOR - Improve implementation
# Extract to base class, add documentation, optimize regex
```

### Bug Fix TDD

```python
# STEP 1: Write regression test for bug
def test_regression_unicode_handling_in_output():
    """Bug: Unicode characters in agent output cause extraction to fail."""
    output_with_unicode = """
    > Response with special characters: café, 日本語, emoji 🚀
    [developer]>
    """
    provider = QCliProvider("id", "session", "window", "developer")
    message = provider.extract_last_message_from_script(output_with_unicode)
    assert "café" in message
    assert "日本語" in message
    assert "🚀" in message

# STEP 2: Fix bug
# STEP 3: Verify fix works
# STEP 4: Add additional edge case tests
```

---

## 10. CI/CD Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Cache pip
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('pyproject.toml') }}
      
      - name: Install dependencies
        run: |
          pip install -e ".[dev]"
      
      - name: Run unit tests
        run: |
          pytest test/unit/ -v --cov=src --cov-report=xml --cov-report=term
      
      - name: Check coverage threshold
        run: |
          coverage report --fail-under=80
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage.xml

  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -e ".[dev]"
      
      - name: Run integration tests
        run: |
          pytest test/integration/ -v -m integration --cov=src --cov-append

  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y tmux
      
      - name: Install Q CLI (if available)
        run: |
          if command -v q &> /dev/null; then
            echo "Q CLI already installed"
          else
            echo "Q CLI not available, skipping E2E tests that require it"
          fi
      
      - name: Install Python dependencies
        run: |
          pip install -e ".[dev]"
      
      - name: Run E2E tests
        run: |
          pytest test/e2e/ -v -m "e2e and slow" --timeout=300

  type-check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -e ".[dev]"
      
      - name: Run mypy
        run: |
          mypy src/cli_agent_orchestrator --strict

  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -e ".[dev]"
      
      - name: Run ruff
        run: |
          ruff check src/ test/
      
      - name: Run black check
        run: |
          black --check src/ test/
```

### Pre-commit Configuration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: check-merge-conflict
  
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.9
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
      - id: ruff-format
  
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies:
          - types-requests
        args: [--strict, src/]
  
  - repo: local
    hooks:
      - id: pytest-unit
        name: Run unit tests
        entry: pytest test/unit/ -v
        language: system
        pass_filenames: false
        stages: [commit]
      
      - id: pytest-coverage
        name: Check coverage
        entry: pytest test/unit/ --cov=src --cov-fail-under=80
        language: system
        pass_filenames: false
        stages: [push]
```

---

## 11. Test Execution Commands

### Local Development

```bash
# Run all tests
pytest test/ -v

# Run only unit tests
pytest test/unit/ -v

# Run with coverage
pytest test/ --cov=src --cov-report=html --cov-report=term

# Run specific test file
pytest test/unit/services/test_session_service.py -v

# Run specific test class
pytest test/unit/services/test_session_service.py::TestListSessions -v

# Run specific test
pytest test/unit/services/test_session_service.py::TestListSessions::test_list_sessions_success -v

# Run with markers
pytest -m "not slow" -v  # Skip slow tests
pytest -m "unit" -v        # Only unit tests
pytest -m "integration" -v # Only integration tests

# Run with xdist (parallel)
pytest -n auto test/unit/

# Run and stop on first failure
pytest -x test/

# Run with verbose output
pytest -vv test/unit/providers/test_claude_code.py
```

### CI/CD Commands

```bash
# Full test suite for CI
pytest test/ -v --cov=src --cov-report=xml --cov-report=term --junitxml=test-results.xml

# Quick smoke tests
pytest test/unit/ -k "test_success or test_create" -v

# Nightly full regression
pytest test/ -v -m "not slow" --timeout=300 && pytest test/e2e/ -v -m "slow"
```

---

## 12. Coverage Goals and Tracking

### Module-Level Coverage Targets

| Module | Target | Priority | Notes |
|--------|--------|----------|-------|
| `providers/base.py` | 100% | High | Abstract base, critical interface |
| `providers/manager.py` | 95% | High | Central provider coordination |
| `providers/*_cli.py` | 90% | High | Each provider implementation |
| `services/session_service.py` | 90% | High | Session lifecycle critical |
| `services/terminal_service.py` | 90% | High | Terminal operations critical |
| `services/bpmn_execution_engine.py` | 95% | High | Workflow execution core |
| `services/inbox_service.py` | 85% | Medium | Messaging system |
| `clients/database.py` | 80% | Medium | CRUD operations |
| `clients/tmux.py` | 75% | Medium | External dependency |
| `api/main.py` | 70% | Medium | HTTP endpoints |
| `models/*.py` | 60% | Low | Data models |

### Coverage Tracking

```bash
# Generate coverage report
pytest --cov=src --cov-report=html --cov-report=term

# View HTML report
open htmlcov/index.html

# Check coverage for specific module
pytest --cov=src/cli_agent_orchestrator/services --cov-report=term test/unit/services/

# Combine coverage from multiple test runs
pytest test/unit/ --cov=src --cov-context=test
pytest test/integration/ --cov=src --cov-append --cov-context=test
coverage report --omit="*/test*,*/venv/*"
```

---

## 13. Performance Testing

### Load Testing Strategy

```python
# test/performance/test_concurrent_sessions.py
"""Performance tests for concurrent session handling."""

import pytest
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

from cli_agent_orchestrator.services import session_service, terminal_service


@pytest.mark.performance
@pytest.mark.slow
class TestConcurrentSessionPerformance:
    """Test system performance under concurrent load."""
    
    def test_create_10_concurrent_terminals(self):
        """Test creating 10 terminals concurrently."""
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i in range(10):
                future = executor.submit(
                    terminal_service.create_terminal,
                    provider="q_cli",
                    agent_profile="developer",
                    session_name=f"perf-test-{i}",
                    new_session=True
                )
                futures.append(future)
            
            results = [f.result() for f in futures]
        
        elapsed = time.time() - start_time
        
        assert len(results) == 10
        assert elapsed < 30  # Should complete in under 30 seconds
        print(f"Created 10 terminals in {elapsed:.2f} seconds")
    
    @pytest.mark.skipif(True, reason="Requires real Q CLI installation")
    def test_100_message_throughput(self):
        """Test inbox message throughput."""
        from cli_agent_orchestrator.clients.database import create_inbox_message
        
        start_time = time.time()
        
        for i in range(100):
            create_inbox_message(
                sender_id=f"sender-{i % 10}",
                receiver_id="receiver-1",
                message=f"Message {i}"
            )
        
        elapsed = time.time() - start_time
        
        assert elapsed < 5  # Should complete in under 5 seconds
        print(f"Created 100 messages in {elapsed:.2f} seconds")
```

---

## 14. Test Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review flaky tests
   - Update fixtures for new features
   - Check coverage trends

2. **Per Release**:
   - Full test suite execution
   - Coverage report review
   - Update test documentation

3. **Per Quarter**:
   - Test debt assessment
   - Test infrastructure upgrades
   - Performance baseline update

### Test Smell Detection

```python
# Examples of test smells to avoid

# BAD: Fragile test (depends on exact timing)
def test_terminal_completes():
    provider = QCliProvider(...)
    provider.initialize()
    time.sleep(5)  # Fragile!
    assert provider.get_status() == TerminalStatus.COMPLETED

# GOOD: Use polling with timeout
def test_terminal_completes():
    provider = QCliProvider(...)
    provider.initialize()
    wait_until_status(provider, TerminalStatus.COMPLETED, timeout=30)

# BAD: Test does too much
def test_full_workflow():
    # 100 lines of test code
    # Tests: session creation, terminal spawn, message sending, receiving, cleanup

# GOOD: Split into focused tests
def test_session_creation()
def test_terminal_spawn()
def test_message_sending()
def test_message_receiving()
def test_cleanup()
```

---

## 15. Success Metrics

### Quality Gates

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit Test Coverage | 90% | pytest-cov |
| Integration Test Coverage | 70% | pytest-cov |
| Critical Path Coverage | 100% | Manual verification |
| Test Execution Time | < 30s | pytest --durations |
| Flaky Test Rate | < 1% | CI flakiness tracking |
| Test Failure Rate | < 5% | CI tracking |

### Definition of Done

A feature is complete when:
1. All unit tests pass (>90% coverage)
2. Integration tests pass
3. E2E scenarios validated
4. No regressions in existing tests
5. Performance benchmarks met
6. Security review completed

---

## 16. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up test infrastructure (pytest, fixtures, conftest)
- [ ] Create test templates
- [ ] Set up CI/CD pipeline
- [ ] Establish coverage baseline

### Phase 2: Core Coverage (Week 3-6)
- [ ] Test all providers (8 files)
- [ ] Test all services (8 files)
- [ ] Test database client
- [ ] Test tmux client

### Phase 3: API & Integration (Week 7-8)
- [ ] Test API endpoints
- [ ] Integration tests
- [ ] WebSocket tests

### Phase 4: Advanced Features (Week 9-10)
- [ ] BPMN engine tests
- [ ] Workflow execution tests
- [ ] E2E scenarios

### Phase 5: Automation & Performance (Week 11-12)
- [ ] Performance tests
- [ ] Load tests
- [ ] CI/CD optimization

---

## 17. Appendix: Quick Reference

### Common Test Patterns

```python
# Mocking external dependencies
@patch("cli_agent_orchestrator.services.session_service.tmux_client")
def test_with_mock(mock_tmux):
    mock_tmux.list_sessions.return_value = [...]

# Using fixtures
def test_with_fixture(sample_terminal):
    assert sample_terminal.provider == "q_cli"

# Parametrized tests
@pytest.mark.parametrize("status,expected", [
    (TerminalStatus.IDLE, True),
    (TerminalStatus.PROCESSING, False),
])
def test_is_ready(status, expected):
    assert is_ready(status) == expected

# Async tests
@pytest.mark.asyncio
async def test_async_function():
    result = await async_function()
    assert result is not None

# Markers
@pytest.mark.unit
def test_unit_only():
    ...

@pytest.mark.integration
@pytest.mark.slow
def test_integration_slow():
    ...
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-11  
**Maintained By**: QA Team  
**Review Cycle**: Quarterly
