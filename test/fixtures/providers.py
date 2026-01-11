"""Provider fixtures for testing."""

from pathlib import Path
from typing import Dict, List, Optional
from unittest.mock import Mock, MagicMock

from cli_agent_orchestrator.models.terminal import TerminalStatus
from cli_agent_orchestrator.providers.base import BaseProvider


class MockProvider(BaseProvider):
    """Mock provider for testing.
    
    Implements all abstract methods with realistic mock behavior.
    """
    
    def __init__(
        self,
        terminal_id: str = "mock-terminal",
        session_name: str = "mock-session",
        window_name: str = "mock-window",
        provider_type: str = "mock"
    ):
        """Initialize mock provider."""
        super().__init__(terminal_id, session_name, window_name)
        self.provider_type = provider_type
        self._initialize_called = False
        self._cleanup_called = False
        self._messages_sent: List[str] = []
        self._status_sequence: List[TerminalStatus] = [TerminalStatus.IDLE]
        self._current_status_index = 0
    
    def initialize(self) -> bool:
        """Mock initialization."""
        self._initialize_called = True
        return True
    
    def get_status(self, tail_lines: Optional[int] = None) -> TerminalStatus:
        """Get current status from sequence."""
        status = self._status_sequence[self._current_status_index]
        return status
    
    def set_status_sequence(self, statuses: List[TerminalStatus]) -> None:
        """Set the sequence of statuses to return.
        
        Useful for testing state transitions.
        """
        self._status_sequence = statuses
        self._current_status_index = 0
    
    def advance_status(self) -> TerminalStatus:
        """Advance to next status in sequence."""
        if self._current_status_index < len(self._status_sequence) - 1:
            self._current_status_index += 1
        return self.get_status()
    
    def get_idle_pattern_for_log(self) -> str:
        """Return idle pattern for log detection."""
        return f"{self.provider_type}_idle_prompt>"
    
    def extract_last_message_from_script(self, script_output: str) -> str:
        """Mock message extraction."""
        # Simple extraction: find content between markers
        if f"{self.provider_type}_response:" in script_output:
            parts = script_output.split(f"{self.provider_type}_response:")
            if len(parts) > 1:
                return parts[1].split(f"{self.provider_type}_idle_prompt")[0].strip()
        return "Mock extracted message"
    
    def exit_cli(self) -> str:
        """Return exit command."""
        return "/exit"
    
    def cleanup(self) -> None:
        """Mock cleanup."""
        self._cleanup_called = True
        self._initialize_called = False


class ProviderFixtureManager:
    """Manages provider fixtures for testing."""
    
    def __init__(self):
        """Initialize provider fixture manager."""
        self._providers: Dict[str, MockProvider] = {}
    
    def create_mock_provider(
        self,
        terminal_id: str = "mock-terminal",
        session_name: str = "mock-session",
        window_name: str = "mock-window",
        provider_type: str = "mock"
    ) -> MockProvider:
        """Create a mock provider.
        
        Args:
            terminal_id: Terminal ID
            session_name: Tmux session name
            window_name: Tmux window name
            provider_type: Type identifier for the provider
            
        Returns:
            MockProvider instance
        """
        provider = MockProvider(terminal_id, session_name, window_name, provider_type)
        self._providers[terminal_id] = provider
        return provider
    
    def get_provider(self, terminal_id: str) -> Optional[MockProvider]:
        """Get a previously created provider."""
        return self._providers.get(terminal_id)
    
    def cleanup_all(self) -> None:
        """Cleanup all providers."""
        for provider in self._providers.values():
            provider.cleanup()
        self._providers.clear()
    
    def create_q_cli_provider(
        self,
        terminal_id: str = "test-q-cli",
        agent_profile: str = "developer"
    ) -> Mock:
        """Create a mock Q CLI provider.
        
        Returns a Mock object configured to behave like QCliProvider.
        """
        mock = Mock()
        mock.terminal_id = terminal_id
        mock.session_name = "test-session"
        mock.window_name = "window-0"
        mock._agent_profile = agent_profile
        mock._status = TerminalStatus.IDLE
        mock.initialize.return_value = True
        mock.get_status.return_value = TerminalStatus.IDLE
        mock.get_idle_pattern_for_log.return_value = "\\[developer\\]>"
        mock.extract_last_message_from_script.return_value = "Q CLI response"
        mock.exit_cli.return_value = "/exit"
        mock.cleanup.return_value = None
        
        return mock
    
    def create_claude_code_provider(
        self,
        terminal_id: str = "test-claude",
        agent_profile: Optional[str] = None
    ) -> Mock:
        """Create a mock Claude Code provider.
        
        Returns a Mock object configured to behave like ClaudeCodeProvider.
        """
        mock = Mock()
        mock.terminal_id = terminal_id
        mock.session_name = "test-session"
        mock.window_name = "window-0"
        mock._agent_profile = agent_profile
        mock._status = TerminalStatus.IDLE
        mock.initialize.return_value = True
        mock.get_status.return_value = TerminalStatus.IDLE
        mock.get_idle_pattern_for_log.return_value = "Try.*shortcuts"
        mock.extract_last_message_from_script.return_value = "Claude response"
        mock.exit_cli.return_value = "/exit"
        mock.cleanup.return_value = None
        
        return mock


class ProviderOutputFactory:
    """Factory for creating realistic provider output for testing."""
    
    @staticmethod
    def q_cli_idle(agent_profile: str = "developer") -> str:
        """Generate Q CLI idle output."""
        return f"\x1b[36m[{agent_profile}]\x1b[35m>\x1b[39m "
    
    @staticmethod
    def q_cli_processing() -> str:
        """Generate Q CLI processing output."""
        return "✶ Processing request...\x1b[0mctrl+c to interrupt"
    
    @staticmethod
    def q_cli_completed(response: str = "Task completed") -> str:
        """Generate Q CLI completed output."""
        return (
            f"\x1b[38;5;10m> \x1b[39m{response}\n"
            "\x1b[36m[developer]\x1b[35m>\x1b[39m "
        )
    
    @staticmethod
    def q_cli_error(error_msg: str = "Command failed") -> str:
        """Generate Q CLI error output."""
        return (
            f"Error: {error_msg}\n"
            "\x1b[36m[developer]\x1b[35m>\x1b[39m "
        )
    
    @staticmethod
    def claude_idle() -> str:
        """Generate Claude Code idle output."""
        return '❯ Try "edit files"\n? for shortcuts'
    
    @staticmethod
    def claude_processing() -> str:
        """Generate Claude Code processing output."""
        return "✶ Canoodling… (ctrl+c to interrupt · 5s)"
    
    @staticmethod
    def claude_completed(duration: str = "52s") -> str:
        """Generate Claude Code completed output."""
        return f'✻ Cogitated for {duration}\n\n❯ Try "edit files"\n? for shortcuts'
