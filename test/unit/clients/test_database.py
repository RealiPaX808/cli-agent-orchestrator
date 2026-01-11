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


@pytest.mark.parametrize(
    "status,limit,expected_filter",
    [
        (None, 10, None),
        (MessageStatus.PENDING, 10, MessageStatus.PENDING.value),
        (MessageStatus.DELIVERED, 5, MessageStatus.DELIVERED.value),
    ]
)
def test_get_inbox_messages_filters(status, limit, expected_filter):
    """Test getting inbox messages with various filters."""
    with patch("cli_agent_orchestrator.clients.database.SessionLocal") as mock_session_cls:
        mock_session = MagicMock()
        mock_session_cls.return_value.__enter__.return_value = mock_session
        
        mock_messages = [
            Mock(id=1, sender_id="s1", receiver_id="r1", message="msg1",
                  status=MessageStatus.PENDING.value, created_at=datetime.now()),
        ]
        
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        
        if status:
            mock_query.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mock_messages[:limit]
        else:
            mock_query.filter.return_value = mock_query
            mock_query.order_by.return_value.limit.return_value.all.return_value = mock_messages[:limit]
        
        result = database.get_inbox_messages("r1", limit=limit, status=status)
        
        assert len(result) <= limit


class TestFlowOperations:
    """Test flow database operations."""
    
    def test_create_flow(self, mock_session):
        """Test creating flow."""
        from datetime import datetime, timedelta
        
        mock_flow = Mock()
        mock_flow.name = "test-flow"
        mock_session.add.return_value = None
        mock_session.commit.return_value = None
        mock_session.refresh.return_value = None
        
        result = database.create_flow(
            name="test-flow",
            file_path="/flows/test.flow",
            schedule="0 * * * *",
            agent_profile="developer",
            provider="q_cli",
            script="echo test",
            next_run=datetime.now() + timedelta(hours=1)
        )
        
        assert result.name == "test-flow"
        assert result.schedule == "0 * * * *"
        mock_session.add.assert_called_once()


class TestWorkflowOperations:
    """Test workflow database operations."""
    
    def test_create_workflow(self, mock_session):
        """Test creating workflow with nodes and edges."""
        mock_session.add.return_value = None
        mock_session.commit.return_value = None
        mock_session.refresh.return_value = None
        
        nodes = [
            {"id": "start", "data": '{"label": "Start"}', "position_x": 100, "position_y": 100}
        ]
        edges = [
            {"id": "e1", "source": "start", "target": "end", "data": None}
        ]
        
        result = database.create_workflow(
            workflow_id="wf-001",
            name="Test Workflow",
            description="A test workflow",
            config="{}",
            nodes=nodes,
            edges=edges
        )
        
        assert result["id"] == "wf-001"
        assert result["name"] == "Test Workflow"
        assert mock_session.add.call_count >= 2  # workflow + node + edge


class TestTaskOperations:
    """Test task database operations."""
    
    def test_create_task(self, mock_session):
        """Test creating task."""
        mock_session.add.return_value = None
        mock_session.commit.return_value = None
        mock_session.refresh.return_value = None
        
        result = database.create_task(
            task_id="T-001",
            title="Implement feature",
            description="Full task description",
            task_type="CODE",
            workflow_id="wf-001",
            priority=5
        )
        
        assert result["id"] == "T-001"
        assert result["title"] == "Implement feature"
        assert result["status"] == "PENDING"
        mock_session.add.assert_called_once()
    
    def test_update_task_status(self, mock_session):
        """Test updating task status."""
        mock_task = Mock()
        mock_task.status = "IN_PROGRESS"
        mock_query = Mock()
        mock_query.filter.return_value.first.return_value = mock_task
        mock_session.query.return_value = mock_query
        
        result = database.update_task_status("T-001", "COMPLETED")
        
        assert result is True
        assert mock_task.status == "COMPLETED"
        mock_session.commit.assert_called_once()
