"""Integration tests for provider + tmux + database."""

import pytest
import uuid
from pathlib import Path

from cli_agent_orchestrator.providers.manager import ProviderManager
from cli_agent_orchestrator.clients.database import (
    create_terminal, get_terminal_metadata,
    TerminalModel, InboxModel
)
from cli_agent_orchestrator.models.inbox import MessageStatus


@pytest.mark.integration
class TestProviderDatabaseIntegration:
    """Test provider and database integration."""
    
    @pytest.fixture(autouse=True)
    def clean_database(self):
        """Ensure clean database state before and after each test."""
        from cli_agent_orchestrator.clients.database import SessionLocal
        
        with SessionLocal() as db:
            db.query(TerminalModel).filter(
                TerminalModel.id.like("test-integration-%")
            ).delete()
            db.query(InboxModel).filter(
                InboxModel.sender_id.like("test-integration-%")
            ).delete()
            db.commit()
        
        yield
        
        # Cleanup after test
        with SessionLocal() as db:
            db.query(TerminalModel).filter(
                TerminalModel.id.like("test-integration-%")
            ).delete()
            db.query(InboxModel).filter(
                InboxModel.sender_id.like("test-integration-%")
            ).delete()
            db.commit()
    
    def test_create_and_retrieve_terminal(self):
        """Test creating terminal and retrieving from database."""
        terminal_id = f"test-integration-{uuid.uuid4().hex[:8]}"
        
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
    
    def test_provider_manager_on_demand_creation(self):
        """Test ProviderManager creates provider on-demand from database."""
        terminal_id = f"test-integration-{uuid.uuid4().hex[:8]}"
        
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
        assert provider.terminal_id == terminal_id
        assert provider._agent_profile == "developer"
    
    def test_multiple_terminals_same_session(self):
        """Test creating multiple terminals in the same session."""
        session_name = f"test-session-{uuid.uuid4().hex[:4]}"
        
        terminal_ids = []
        for i in range(3):
            terminal_id = f"test-integration-{uuid.uuid4().hex[:8]}"
            create_terminal(
                terminal_id=terminal_id,
                tmux_session=session_name,
                tmux_window=f"window-{i}",
                provider="q_cli" if i % 2 == 0 else "claude_code",
                agent_profile="developer" if i % 2 == 0 else "reviewer"
            )
            terminal_ids.append(terminal_id)
        
        # Verify all terminals exist
        for terminal_id in terminal_ids:
            metadata = get_terminal_metadata(terminal_id)
            assert metadata is not None
            assert metadata["tmux_session"] == session_name


@pytest.mark.integration
@pytest.mark.skipif(not True, reason="Requires --run-tmux flag")
class TestProviderTmuxIntegration:
    """Test provider and tmux integration."""
    
    @pytest.fixture(autouse=True)
    def cleanup_tmux(self):
        """Clean up tmux sessions after tests."""
        from cli_agent_orchestrator.clients.tmux import tmux_client
        from cli_agent_orchestrator.clients.database import SessionLocal, TerminalModel
        
        yield
        
        # Cleanup database
        with SessionLocal() as db:
            db.query(TerminalModel).filter(
                TerminalModel.id.like("test-tmux-%")
            ).delete()
            db.commit()
        
        # Note: tmux sessions are cleaned up by test logic
    
    def test_q_cli_provider_initialization(self):
        """Test Q CLI provider can initialize with tmux."""
        from cli_agent_orchestrator.clients.tmux import tmux_client
        from cli_agent_orchestrator.providers.q_cli import QCliProvider
        
        terminal_id = f"test-tmux-{uuid.uuid4().hex[:8]}"
        session_name = f"test-session-{uuid.uuid4().hex[:4]}"
        window_name = "test-window"
        
        try:
            # Create tmux session and window
            tmux_client.create_session(session_name, window_name, terminal_id)
            
            # Create provider
            provider = QCliProvider(terminal_id, session_name, window_name, "developer")
            
            # Test provider methods that don't require actual Q CLI
            assert provider.terminal_id == terminal_id
            assert provider.session_name == session_name
            assert provider.window_name == window_name
            assert provider.get_idle_pattern_for_log() is not None
            assert provider.exit_cli() is not None
            
        finally:
            # Cleanup
            try:
                tmux_client.kill_session(session_name)
            except:
                pass


@pytest.mark.integration
class TestInboxDatabaseIntegration:
    """Test inbox operations with database."""
    
    @pytest.fixture(autouse=True)
    def clean_database(self):
        """Clean up test data."""
        from cli_agent_orchestrator.clients.database import SessionLocal
        from cli_agent_orchestrator.clients.database import InboxModel
        
        with SessionLocal() as db:
            db.query(InboxModel).filter(
                InboxModel.sender_id.like("test-inbox-%")
            ).delete()
            db.commit()
        
        yield
        
        with SessionLocal() as db:
            db.query(InboxModel).filter(
                InboxModel.sender_id.like("test-inbox-%")
            ).delete()
            db.commit()
    
    def test_message_delivery_workflow(self):
        """Test complete message delivery workflow."""
        from cli_agent_orchestrator.clients.database import (
            create_inbox_message,
            get_inbox_messages,
            update_message_status
        )
        
        sender_id = f"test-inbox-sender-{uuid.uuid4().hex[:4]}"
        receiver_id = f"test-inbox-receiver-{uuid.uuid4().hex[:4]}"
        
        # Create messages
        msg1 = create_inbox_message(sender_id, receiver_id, "First message")
        msg2 = create_inbox_message(sender_id, receiver_id, "Second message")
        
        assert msg1.id < msg2.id  # Sequential IDs
        assert msg1.status == MessageStatus.PENDING
        
        # Retrieve pending messages
        pending = get_inbox_messages(receiver_id, status=MessageStatus.PENDING)
        assert len(pending) >= 2
        
        # Update status
        update_message_status(msg1.id, MessageStatus.DELIVERED)
        
        # Verify status change
        messages = get_inbox_messages(receiver_id, status=MessageStatus.DELIVERED)
        assert any(m.id == msg1.id for m in messages)
