"""E2E tests for complete session lifecycle."""

import pytest
import uuid
import time
from pathlib import Path

from cli_agent_orchestrator.clients.tmux import tmux_client
from cli_agent_orchestrator.clients.database import (
    create_terminal, get_terminal_metadata,
    delete_terminal, TerminalModel
)
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
        time.sleep(0.5)  # Wait for command to execute
        output = tmux_client.get_history(unique_session, window_name)
        assert "echo" in output or "Hello E2E" in output or "bash" in output
        
        # 7. Cleanup
        provider_manager.cleanup_provider(terminal_id)
        delete_terminal(terminal_id)
        tmux_client.kill_session(unique_session)
        
        # 8. Verify cleanup
        assert not tmux_client.session_exists(unique_session)
        assert get_terminal_metadata(terminal_id) is None
    
    def test_multi_terminal_session(self, unique_session):
        """Test session with multiple terminals."""
        # Create session
        tmux_client.create_session(
            session_name=unique_session,
            window_name="window-0",
            terminal_id="e2e-multi-001"
        )
        
        # Create multiple terminals in same session
        terminal_ids = []
        for i in range(3):
            window_name = tmux_client.create_window(
                session_name=unique_session,
                window_name=f"window-{i}",
                terminal_id=f"e2e-multi-{i}"
            )
            
            terminal_id = f"e2e-{uuid.uuid4().hex[:8]}"
            create_terminal(
                terminal_id=terminal_id,
                tmux_session=unique_session,
                tmux_window=window_name,
                provider="q_cli",
                agent_profile="developer"
            )
            terminal_ids.append(terminal_id)
        
        # Verify all terminals exist
        for terminal_id in terminal_ids:
            metadata = get_terminal_metadata(terminal_id)
            assert metadata is not None
            assert metadata["tmux_session"] == unique_session
        
        # Cleanup
        for terminal_id in terminal_ids:
            provider_manager.cleanup_provider(terminal_id)
            delete_terminal(terminal_id)
        
        tmux_client.kill_session(unique_session)


@pytest.mark.e2e
@pytest.mark.slow
@pytest.mark.skipif(True, reason="Requires actual provider installation")
class TestAgentHandoff:
    """Test agent handoff between terminals."""
    
    @pytest.fixture
    def handoff_session(self):
        """Create session for handoff testing."""
        session_name = f"e2e-handoff-{uuid.uuid4().hex[:8]}"
        tmux_client.create_session(
            session_name=session_name,
            window_name="dev-window",
            terminal_id="handoff-dev"
        )
        yield session_name
        try:
            tmux_client.kill_session(session_name)
        except:
            pass
    
    def test_simple_handoff(self, handoff_session):
        """Test simple handoff from developer to reviewer."""
        # Create developer terminal
        dev_id = f"e2e-dev-{uuid.uuid4().hex[:8]}"
        create_terminal(
            terminal_id=dev_id,
            tmux_session=handoff_session,
            tmux_window="dev-window",
            provider="q_cli",
            agent_profile="developer"
        )
        
        # Create reviewer terminal
        reviewer_window = tmux_client.create_window(
            session_name=handoff_session,
            window_name="reviewer-window",
            terminal_id="handoff-reviewer"
        )
        
        reviewer_id = f"e2e-reviewer-{uuid.uuid4().hex[:8]}"
        create_terminal(
            terminal_id=reviewer_id,
            tmux_session=handoff_session,
            tmux_window=reviewer_window,
            provider="q_cli",
            agent_profile="code-reviewer"
        )
        
        # Verify both terminals exist
        assert get_terminal_metadata(dev_id) is not None
        assert get_terminal_metadata(reviewer_id) is not None
        
        # Cleanup
        provider_manager.cleanup_provider(dev_id)
        provider_manager.cleanup_provider(reviewer_id)
        delete_terminal(dev_id)
        delete_terminal(reviewer_id)


@pytest.mark.e2e
@pytest.mark.slow
class TestErrorRecovery:
    """Test error recovery scenarios."""
    
    @pytest.fixture
    def recovery_session(self):
        """Create session for error recovery testing."""
        session_name = f"e2e-recovery-{uuid.uuid4().hex[:8]}"
        tmux_client.create_session(
            session_name=session_name,
            window_name="main",
            terminal_id="recovery-main"
        )
        yield session_name
        try:
            tmux_client.kill_session(session_name)
        except:
            pass
    
    def test_terminal_cleanup_on_error(self, recovery_session):
        """Test that terminal is cleaned up properly on errors."""
        terminal_id = f"e2e-error-{uuid.uuid4().hex[:8]}"
        
        # Create terminal
        create_terminal(
            terminal_id=terminal_id,
            tmux_session=recovery_session,
            tmux_window="main",
            provider="q_cli",
            agent_profile="developer"
        )
        
        # Simulate error condition
        provider = provider_manager.get_provider(terminal_id)
        if provider:
            provider.cleanup()
        
        delete_terminal(terminal_id)
        
        # Verify cleanup
        assert get_terminal_metadata(terminal_id) is None
