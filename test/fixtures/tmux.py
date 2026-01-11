"""Tmux fixtures for testing."""

from pathlib import Path
from typing import Dict, List, Optional
from unittest.mock import Mock, MagicMock

from cli_agent_orchestrator.clients.tmux import TmuxClient


class MockTmuxSession:
    """Mock tmux session for testing."""
    
    def __init__(self, name: str, windows: Optional[List[str]] = None):
        """Initialize mock session.
        
        Args:
            name: Session name
            windows: List of window names (default: ["window-0"])
        """
        self.name = name
        self.windows = windows or ["window-0"]
        self.attached = False
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation."""
        return {
            "id": self.name,
            "name": self.name,
            "status": "active" if self.attached else "detached"
        }


class TmuxFixtureManager:
    """Manages tmux fixtures for testing."""
    
    def __init__(self, use_real_tmux: bool = False):
        """Initialize the tmux fixture manager.
        
        Args:
            use_real_tmux: If True, use real tmux (for integration tests).
                         If False, use mocked tmux (for unit tests).
        """
        self.use_real_tmux = use_real_tmux
        self._created_sessions: List[str] = []
        self._mock_client: Optional[Mock] = None
    
    def get_client(self) -> TmuxClient:
        """Get the tmux client (real or mocked)."""
        if self.use_real_tmux:
            from cli_agent_orchestrator.clients.tmux import tmux_client
            return tmux_client
        
        if self._mock_client is None:
            self._mock_client = self._create_mock_client()
        
        return self._mock_client
    
    def _create_mock_client(self) -> Mock:
        """Create a mock tmux client.
        
        The mock client has realistic behavior but doesn't require tmux.
        """
        mock = Mock(spec=TmuxClient)
        
        # Track created sessions for realism
        sessions: Dict[str, MockTmuxSession] = {}
        
        def create_session(session_name: str, window_name: str, terminal_id: str) -> str:
            sessions[session_name] = MockTmuxSession(session_name, [window_name])
            self._created_sessions.append(session_name)
            return window_name
        
        def create_window(session_name: str, window_name: str, terminal_id: str) -> str:
            if session_name in sessions:
                sessions[session_name].windows.append(window_name)
            return window_name
        
        def session_exists(session_name: str) -> bool:
            return session_name in sessions
        
        def kill_session(session_name: str) -> bool:
            if session_name in sessions:
                del sessions[session_name]
                return True
            return False
        
        def list_sessions() -> List[Dict]:
            return [s.to_dict() for s in sessions.values()]
        
        def get_history(session_name: str, window_name: str, tail_lines: Optional[int] = None) -> str:
            return ""
        
        def send_keys(session_name: str, window_name: str, keys: str, enter: bool = True) -> None:
            pass
        
        # Set up the mock
        mock.create_session.side_effect = create_session
        mock.create_window.side_effect = create_window
        mock.session_exists.side_effect = session_exists
        mock.kill_session.side_effect = kill_session
        mock.list_sessions.side_effect = list_sessions
        mock.get_history.side_effect = get_history
        mock.send_keys.side_effect = send_keys
        
        return mock
    
    def create_test_session(
        self,
        session_name: str,
        window_name: str = "window-0",
        terminal_id: str = "test-terminal"
    ) -> str:
        """Create a test session.
        
        Args:
            session_name: Name for the session
            window_name: Name for the initial window
            terminal_id: Terminal ID for the window
            
        Returns:
            The actual window name created
        """
        client = self.get_client()
        return client.create_session(session_name, window_name, terminal_id)
    
    def cleanup(self) -> None:
        """Clean up all created sessions."""
        if self.use_real_tmux:
            client = self.get_client()
            for session_name in self._created_sessions:
                try:
                    client.kill_session(session_name)
                except:
                    pass
        else:
            # Reset the mock
            if self._mock_client:
                self._mock_client.reset_mock()
        
        self._created_sessions.clear()


class MockTmuxOutput:
    """Mock tmux output patterns for testing provider status detection."""
    
    Q_CLI_IDLE = "\x1b[36m[developer]\x1b[35m>\x1b[39m "
    Q_CLI_IDLE_WITH_PERCENT = "\x1b[36m[developer] \x1b[32m75%\x1b[35m>\x1b[39m "
    Q_CLI_PROCESSING = "✶ Processing...\x1b[0mctrl+c to interrupt"
    Q_CLI_COMPLETED = "\x1b[38;5;10m> \x1b[39mTask completed successfully\n\x1b[36m[developer]\x1b[35m>\x1b[39m "
    Q_CLI_ERROR = "Error: Command failed\n\x1b[36m[developer]\x1b[35m>\x1b[39m "
    Q_CLI_WAITING_APPROVAL = "Approve? [y/n]:\n\x1b[36m[developer]\x1b[35m>\x1b[39m "
    
    CLAUDE_IDLE = '❯ Try "edit files"\n? for shortcuts'
    CLAUDE_PROCESSING = "✶ Canoodling… (ctrl+c to interrupt)"
    CLAUDE_COMPLETED = '✻ Cogitated for 52s\n\n❯ Try "edit files"\n? for shortcuts'
    
    @staticmethod
    def get_q_cli_output(state: str) -> str:
        """Get mock Q CLI output for a given state.
        
        Args:
            state: One of "idle", "processing", "completed", "error", "waiting"
            
        Returns:
            Mock terminal output string
        """
        outputs = {
            "idle": MockTmuxOutput.Q_CLI_IDLE,
            "processing": MockTmuxOutput.Q_CLI_PROCESSING,
            "completed": MockTmuxOutput.Q_CLI_COMPLETED,
            "error": MockTmuxOutput.Q_CLI_ERROR,
            "waiting": MockTmuxOutput.Q_CLI_WAITING_APPROVAL
        }
        return outputs.get(state, MockTmuxOutput.Q_CLI_IDLE)
    
    @staticmethod
    def get_claude_output(state: str) -> str:
        """Get mock Claude Code output for a given state.
        
        Args:
            state: One of "idle", "processing", "completed"
            
        Returns:
            Mock terminal output string
        """
        outputs = {
            "idle": MockTmuxOutput.CLAUDE_IDLE,
            "processing": MockTmuxOutput.CLAUDE_PROCESSING,
            "completed": MockTmuxOutput.CLAUDE_COMPLETED
        }
        return outputs.get(state, MockTmuxOutput.CLAUDE_IDLE)
