"""Shared pytest configuration and fixtures for CLI Agent Orchestrator tests."""

import os
import sys
import uuid
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Generator
from unittest.mock import Mock, MagicMock

import pytest

# Add src to path for imports
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "unit: Unit tests (fast, isolated)"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests (require database, mocked tmux)"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests (require real tmux, slow)"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take more than 5 seconds"
    )
    config.addinivalue_line(
        "markers", "performance: Performance and load tests"
    )


def pytest_addoption(parser):
    """Add custom command line options."""
    parser.addoption(
        "--run-tmux",
        action="store_true",
        default=False,
        help="Run tests that require real tmux installation"
    )
    parser.addoption(
        "--run-e2e",
        action="store_true",
        default=False,
        help="Run end-to-end tests"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection based on options."""
    if not config.getoption("--run-tmux"):
        skip_tmux = pytest.mark.skip(reason="Need --run-tmux to run")
        for item in items:
            if "tmux" in item.keywords:
                item.add_marker(skip_tmux)
    
    if not config.getoption("--run-e2e"):
        skip_e2e = pytest.mark.skip(reason="Need --run-e2e to run E2E tests")
        for item in items:
            if "e2e" in item.keywords:
                item.add_marker(skip_e2e)


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest.fixture(scope="function")
def temp_database() -> Generator[Path, None, None]:
    """Create a temporary in-memory database for testing."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from cli_agent_orchestrator.clients.database import Base
    
    temp_dir = TemporaryDirectory()
    db_path = Path(temp_dir.name) / "test.db"
    
    # Create new engine with test database
    test_engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=test_engine)
    
    TestSessionLocal = sessionmaker(bind=test_engine)
    
    # Patch the SessionLocal
    import cli_agent_orchestrator.clients.database as db_module
    original_session = db_module.SessionLocal
    original_engine = db_module.engine
    
    db_module.SessionLocal = TestSessionLocal
    db_module.engine = test_engine
    
    yield db_path
    
    # Cleanup
    db_module.SessionLocal = original_session
    db_module.engine = original_engine
    temp_dir.cleanup()


@pytest.fixture
def clean_database(temp_database: Path) -> None:
    """Ensure clean database state at start of test."""
    from cli_agent_orchestrator.clients.database import SessionLocal, TerminalModel, InboxModel
    
    with SessionLocal() as db:
        db.query(TerminalModel).filter(
            TerminalModel.id.like("test-%")
        ).delete()
        db.query(InboxModel).filter(
            InboxModel.sender_id.like("test-%")
        ).delete()
        db.commit()


# ============================================================================
# Tmux Fixtures
# ============================================================================

@pytest.fixture
def mock_tmux_client() -> Mock:
    """Create a mocked tmux client."""
    mock_client = Mock()
    mock_client.create_session.return_value = "window-0"
    mock_client.create_window.return_value = "window-1"
    mock_client.session_exists.return_value = True
    mock_client.get_history.return_value = ""
    mock_client.send_keys.return_value = None
    mock_client.kill_session.return_value = True
    mock_client.list_sessions.return_value = []
    return mock_client


# ============================================================================
# Provider Fixtures
# ============================================================================

@pytest.fixture
def sample_terminal_data():
    """Sample terminal data for tests."""
    return {
        "id": f"test-term-{uuid.uuid4().hex[:8]}",
        "tmux_session": f"cao-test-session-{uuid.uuid4().hex[:4]}",
        "tmux_window": "window-0",
        "provider": "q_cli",
        "agent_profile": "developer"
    }


@pytest.fixture
def mock_provider():
    """Create a mock provider."""
    from cli_agent_orchestrator.models.terminal import TerminalStatus
    
    mock = Mock()
    mock.terminal_id = "test-123"
    mock.session_name = "test-session"
    mock.window_name = "window-0"
    mock._status = TerminalStatus.IDLE
    mock.initialize.return_value = True
    mock.get_status.return_value = TerminalStatus.IDLE
    mock.get_idle_pattern_for_log.return_value = "idle_prompt"
    mock.extract_last_message_from_script.return_value = "Test message"
    mock.exit_cli.return_value = "/exit"
    mock.cleanup.return_value = None
    return mock


# ============================================================================
# Model Fixtures
# ============================================================================

@pytest.fixture
def sample_workflow_data():
    """Sample workflow data for tests."""
    return {
        "id": "workflow-001",
        "name": "Test Workflow",
        "description": "A test workflow for testing",
        "config": {},
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


@pytest.fixture
def sample_bpmn_process():
    """Create a sample BPMN process for testing."""
    from cli_agent_orchestrator.models.bpmn import (
        BPMNProcess, BPMNEvent, BPMNElementType,
        ServiceTask, SequenceFlow
    )
    
    start_event = BPMNEvent(
        id="start", type=BPMNElementType.START_EVENT, name="Start"
    )
    
    service_task = ServiceTask(
        id="task1",
        type=BPMNElementType.SERVICE_TASK,
        name="Task 1",
        agent_profile="developer",
        provider="q_cli",
        task_template="Do something with {{var}}",
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
        },
        process_variables={"var": "test_value"}
    )


# ============================================================================
# Tmux Output Fixtures
# ============================================================================

@pytest.fixture
def mock_tmux_outputs():
    """Mock tmux output with various states for testing."""
    return {
        "idle_q_cli": "\x1b[36m[developer]\x1b[35m>\x1b[39m ",
        "idle_claude": '❯ Try "edit files"\n? for shortcuts',
        "processing": "✶ Processing...\x1b[0mctrl+c to interrupt",
        "completed": "\x1b[38;5;10m> \x1b[39mTask completed\n\x1b[36m[developer]\x1b[35m>\x1b[39m ",
        "error": "Error: Command failed\n\x1b[36m[developer]\x1b[35m>\x1b[39m ",
        "waiting_approval": "Approve? [y/n]:\n\x1b[36m[developer]\x1b[35m>\x1b[39m "
    }


# ============================================================================
# Test Data Factories
# ============================================================================

class TerminalFactory:
    """Factory for creating test Terminal objects."""
    
    @staticmethod
    def create(**kwargs):
        """Create a Terminal instance with test data."""
        from cli_agent_orchestrator.models.terminal import Terminal, TerminalStatus
        from datetime import datetime, timedelta
        import random
        import string
        
        defaults = {
            "id": f"term-{''.join(random.choices(string.ascii_lowercase, k=8))}",
            "name": f"window-{random.randint(0, 10)}",
            "session_name": f"cao-session-{random.randint(1000, 9999)}",
            "provider": "q_cli",
            "agent_profile": "developer",
            "status": TerminalStatus.IDLE,
            "last_active": datetime.now() - timedelta(minutes=random.randint(0, 60))
        }
        defaults.update(kwargs)
        return Terminal(**defaults)


class InboxMessageFactory:
    """Factory for creating test InboxMessage objects."""
    
    @staticmethod
    def create(**kwargs):
        """Create an InboxMessage instance with test data."""
        from cli_agent_orchestrator.models.inbox import InboxMessage, MessageStatus
        from datetime import datetime, timedelta
        import random
        import string
        
        defaults = {
            "id": random.randint(1000, 9999),
            "sender_id": f"sender-{''.join(random.choices(string.ascii_lowercase, k=4))}",
            "receiver_id": f"receiver-{''.join(random.choices(string.ascii_lowercase, k=4))}",
            "message": f"Test message {''.join(random.choices(string.ascii_lowercase, k=20))}",
            "status": MessageStatus.PENDING,
            "created_at": datetime.now() - timedelta(minutes=random.randint(0, 120))
        }
        defaults.update(kwargs)
        return InboxMessage(**defaults)


# Export factories for use in tests
@pytest.fixture
def terminal_factory():
    """Terminal factory fixture."""
    return TerminalFactory


@pytest.fixture
def message_factory():
    """InboxMessage factory fixture."""
    return InboxMessageFactory


# ============================================================================
# Async Event Loop Fixture
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
