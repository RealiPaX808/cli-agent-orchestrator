"""Gemini CLI provider implementation."""

import logging
import re
import shlex
from typing import List, Optional

from cli_agent_orchestrator.clients.tmux import tmux_client
from cli_agent_orchestrator.models.terminal import TerminalStatus
from cli_agent_orchestrator.providers.base import BaseProvider
from cli_agent_orchestrator.utils.agent_profiles import load_agent_profile
from cli_agent_orchestrator.utils.terminal import wait_for_shell, wait_until_status

logger = logging.getLogger(__name__)

ANSI_CODE_PATTERN = r"\x1b\[[0-9;]*m"
RESPONSE_PATTERN = r">\s+"  # Pattern for Gemini CLI prompt (simple > with spaces)
IDLE_PROMPT_PATTERN = r">\s+"  # Pattern for Gemini CLI idle prompt
IDLE_PROMPT_PATTERN_LOG = r">\s+"
PROCESSING_PATTERN = r"\.\.\."  # Processing indicators (three dots in a row)


class GeminiCliProvider(BaseProvider):
    """Provider for Gemini CLI tool integration (gemini-cli npm package)."""

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
        """Initialize Gemini CLI provider by starting gemini command."""
        import tempfile
        import os

        # Wait for shell to be ready first
        if not wait_for_shell(tmux_client, self.session_name, self.window_name, timeout=10.0):
            raise TimeoutError("Shell initialization timed out after 10 seconds")

        # Build command with agent profile if provided
        logger.info(f"Agent profile: {self._agent_profile}")
        if self._agent_profile:
            try:
                profile = load_agent_profile(self._agent_profile)
                logger.info(f"Loaded profile: {profile.name}")
                system_prompt = profile.system_prompt if profile.system_prompt else ""
                logger.info(f"System prompt length: {len(system_prompt)} chars")

                if system_prompt:
                    logger.info(f"Injecting agent profile '{self._agent_profile}' as system prompt")

                    # Write prompt to temporary file to avoid command-line length limitations
                    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
                        f.write(system_prompt)
                        prompt_file = f.name

                    # Use command substitution to read prompt from file
                    # Using -i flag (short form of --prompt-interactive)
                    command = f'gemini -i "$(cat {prompt_file})"'
                    logger.info(f"Executing: {command}")
                    tmux_client.send_keys(self.session_name, self.window_name, command)

                    # Wait for prompt processing to complete
                    if not wait_until_status(
                        self, TerminalStatus.COMPLETED, timeout=90.0, polling_interval=1.0
                    ):
                        # Clean up temp file
                        try:
                            os.unlink(prompt_file)
                        except:
                            pass
                        raise TimeoutError("Gemini CLI initialization with agent profile timed out after 90 seconds")

                    # Clean up temp file
                    try:
                        os.unlink(prompt_file)
                    except Exception as e:
                        logger.warning(f"Failed to delete temp prompt file: {e}")
                else:
                    # No system prompt, just start gemini normally
                    tmux_client.send_keys(self.session_name, self.window_name, "gemini")
                    if not wait_until_status(
                        self, TerminalStatus.IDLE, timeout=60.0, polling_interval=1.0
                    ):
                        raise TimeoutError("Gemini CLI initialization timed out after 60 seconds")
            except Exception as e:
                logger.warning(f"Failed to load agent profile '{self._agent_profile}': {e}")
                # Fall back to normal gemini start
                tmux_client.send_keys(self.session_name, self.window_name, "gemini")
                if not wait_until_status(
                    self, TerminalStatus.IDLE, timeout=60.0, polling_interval=1.0
                ):
                    raise TimeoutError("Gemini CLI initialization timed out after 60 seconds")
        else:
            # No agent profile, start gemini normally
            tmux_client.send_keys(self.session_name, self.window_name, "gemini")
            if not wait_until_status(
                self, TerminalStatus.IDLE, timeout=60.0, polling_interval=1.0
            ):
                raise TimeoutError("Gemini CLI initialization timed out after 60 seconds")

        self._initialized = True
        return True

    def get_status(self, tail_lines: Optional[int] = None) -> TerminalStatus:
        """Get Gemini CLI status by analyzing terminal output."""
        logger.debug(f"get_status: tail_lines={tail_lines}")
        output = tmux_client.get_history(
            self.session_name, self.window_name, tail_lines=tail_lines
        )

        if not output:
            return TerminalStatus.ERROR

        # Strip ANSI codes for pattern matching
        clean_output = re.sub(ANSI_CODE_PATTERN, "", output)

        # Check for processing indicators (loading extensions, etc.)
        if "Loading extension:" in clean_output or "Loaded cached credentials" in clean_output:
            if not re.search(IDLE_PROMPT_PATTERN, clean_output):
                return TerminalStatus.PROCESSING

        # Check for idle prompt
        has_idle_prompt = re.search(IDLE_PROMPT_PATTERN, clean_output)

        if not has_idle_prompt:
            return TerminalStatus.PROCESSING

        # Check for processing indicators (disabled - "..." appears in truncated paths)
        # if re.search(PROCESSING_PATTERN, clean_output):
        #     return TerminalStatus.PROCESSING

        # Find all prompts to determine state
        prompts = list(re.finditer(IDLE_PROMPT_PATTERN, clean_output))

        if len(prompts) == 0:
            return TerminalStatus.PROCESSING
        elif len(prompts) == 1:
            # Only one prompt means waiting for first input
            return TerminalStatus.IDLE
        else:
            # Multiple prompts mean there was a response
            return TerminalStatus.COMPLETED

    def get_idle_pattern_for_log(self) -> str:
        """Return Gemini CLI IDLE prompt pattern for log files."""
        return IDLE_PROMPT_PATTERN_LOG

    def extract_last_message_from_script(self, script_output: str) -> str:
        """Extract Gemini's final response message using > prompt indicator."""
        # Strip ANSI codes for pattern matching
        clean_output = re.sub(ANSI_CODE_PATTERN, "", script_output)

        # Find all > indicators (prompts)
        matches = list(re.finditer(RESPONSE_PATTERN, clean_output))

        if not matches:
            raise ValueError("No Gemini CLI response found - no > prompt pattern detected")

        # Get last match (final answer)
        last_match = matches[-1]
        start_pos = last_match.end()

        # Extract everything after last response until end
        remaining_text = script_output[start_pos:].strip()

        if not remaining_text:
            raise ValueError("Empty Gemini CLI response - no content found")

        # Clean up trailing whitespace and prompts
        final_answer = re.sub(r">\s+.*$", "", remaining_text).strip()

        # Remove ANSI codes from final message
        final_answer = re.sub(ANSI_CODE_PATTERN, "", final_answer)
        return final_answer.strip()

    def exit_cli(self) -> str:
        """Get the command to exit Gemini CLI."""
        return "/quit"

    def cleanup(self) -> None:
        """Clean up Gemini CLI provider."""
        self._initialized = False
