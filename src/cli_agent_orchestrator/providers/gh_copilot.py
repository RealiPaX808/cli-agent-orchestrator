"""GitHub Copilot CLI provider implementation."""

import logging
import re
from typing import List, Optional

from cli_agent_orchestrator.clients.tmux import tmux_client
from cli_agent_orchestrator.models.terminal import TerminalStatus
from cli_agent_orchestrator.providers.base import BaseProvider
from cli_agent_orchestrator.utils.terminal import wait_for_shell, wait_until_status

logger = logging.getLogger(__name__)

ANSI_CODE_PATTERN = r"\x1b\[[0-9;]*m"
RESPONSE_PATTERN = r"❯"  # Pattern for GitHub Copilot CLI prompt
IDLE_PROMPT_PATTERN = r"gh copilot >"  # Pattern for idle state
IDLE_PROMPT_PATTERN_LOG = r"gh copilot >"
PROCESSING_PATTERN = r"[\.\.\.]"  # Processing indicators


class GhCopilotProvider(BaseProvider):
    """Provider for GitHub Copilot CLI tool integration (gh copilot chat)."""

    def __init__(
        self,
        terminal_id: str,
        session_name: str,
        window_name: str,
        agent_profile: Optional[str] = None,
    ):
        super().__init__(terminal_id, session_name, window_name)
        self._initialized = False
        self._agent_profile = agent_profile

    def initialize(self) -> bool:
        """Initialize GitHub Copilot CLI provider by starting gh copilot chat command."""
        # Wait for shell to be ready first
        if not wait_for_shell(tmux_client, self.session_name, self.window_name, timeout=10.0):
            raise TimeoutError("Shell initialization timed out after 10 seconds")

        command = f"gh copilot chat"
        tmux_client.send_keys(self.session_name, self.window_name, command)

        # Wait for GitHub Copilot CLI prompt to be ready
        if not wait_until_status(
            self, TerminalStatus.IDLE, timeout=30.0, polling_interval=1.0
        ):
            raise TimeoutError(
                "GitHub Copilot CLI initialization timed out after 30 seconds"
            )

        self._initialized = True
        return True

    def get_status(self, tail_lines: Optional[int] = None) -> TerminalStatus:
        """Get GitHub Copilot CLI status by analyzing terminal output."""
        logger.debug(f"get_status: tail_lines={tail_lines}")
        output = tmux_client.get_history(
            self.session_name, self.window_name, tail_lines=tail_lines
        )

        if not output:
            return TerminalStatus.ERROR

        # Strip ANSI codes for pattern matching
        clean_output = re.sub(ANSI_CODE_PATTERN, "", output)

        # Check for idle prompt (not processing)
        has_idle_prompt = re.search(IDLE_PROMPT_PATTERN, clean_output)

        if not has_idle_prompt:
            return TerminalStatus.PROCESSING

        # Check for processing indicators
        if re.search(PROCESSING_PATTERN, clean_output):
            return TerminalStatus.PROCESSING

        # Check for response (has prompt + response)
        if re.search(RESPONSE_PATTERN, clean_output):
            logger.debug(f"get_status: returning COMPLETED")
            return TerminalStatus.COMPLETED

        # Just prompt, no response
        return TerminalStatus.IDLE

    def get_idle_pattern_for_log(self) -> str:
        """Return GitHub Copilot CLI IDLE prompt pattern for log files."""
        return IDLE_PROMPT_PATTERN_LOG

    def extract_last_message_from_script(self, script_output: str) -> str:
        """Extract GitHub Copilot's final response message using ❯ indicator."""
        # Strip ANSI codes for pattern matching
        clean_output = re.sub(ANSI_CODE_PATTERN, "", script_output)

        # Find all ❯ indicators (responses)
        matches = list(re.finditer(RESPONSE_PATTERN, clean_output))

        if not matches:
            raise ValueError(
                "No GitHub Copilot CLI response found - no ❯ pattern detected"
            )

        # Get last match (final answer)
        last_match = matches[-1]
        start_pos = last_match.end()

        # Extract everything after last response until next prompt
        remaining_text = script_output[start_pos:].strip()

        if not remaining_text:
            raise ValueError("Empty GitHub Copilot CLI response - no content found")

        # Clean up trailing whitespace and prompts
        final_answer = re.sub(r"gh copilot >.*$", "", remaining_text).strip()

        # Remove ANSI codes from final message
        final_answer = re.sub(ANSI_CODE_PATTERN, "", final_answer)
        return final_answer.strip()

    def exit_cli(self) -> str:
        """Get the command to exit GitHub Copilot CLI."""
        return "\x03"  # Ctrl+C to interrupt and exit

    def cleanup(self) -> None:
        """Clean up GitHub Copilot CLI provider."""
        self._initialized = False
