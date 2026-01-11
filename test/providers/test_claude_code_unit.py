import re
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from cli_agent_orchestrator.models.terminal import TerminalStatus
from cli_agent_orchestrator.providers.claude_code import ClaudeCodeProvider

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture(filename: str) -> str:
    with open(FIXTURES_DIR / filename, "r") as f:
        return f.read()


class TestClaudeCodeProviderInitialization:
    @patch("cli_agent_orchestrator.providers.claude_code.wait_until_status")
    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_initialize_success(self, mock_tmux, mock_wait_status):
        mock_wait_status.return_value = True

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        result = provider.initialize()

        assert result is True
        mock_tmux.send_keys.assert_called_once_with(
            "test-session", "window-0", "claude"
        )
        mock_wait_status.assert_called_once()

    @patch("cli_agent_orchestrator.providers.claude_code.wait_until_status")
    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_initialize_timeout(self, mock_tmux, mock_wait_status):
        mock_wait_status.return_value = False

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")

        with pytest.raises(TimeoutError, match="Claude Code initialization timed out"):
            provider.initialize()

    @patch("cli_agent_orchestrator.providers.claude_code.load_agent_profile")
    @patch("cli_agent_orchestrator.providers.claude_code.wait_until_status")
    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_initialize_with_initial_prompt(
        self, mock_tmux, mock_wait_status, mock_load_profile
    ):
        mock_profile = MagicMock()
        mock_profile.system_prompt = "You are a supervisor"
        mock_profile.initial_prompt = "Ready to coordinate"
        mock_profile.mcpServers = None
        mock_load_profile.return_value = mock_profile
        mock_wait_status.return_value = True

        provider = ClaudeCodeProvider(
            "test1234", "test-session", "window-0", "supervisor"
        )
        result = provider.initialize()

        assert result is True
        call_args = mock_tmux.send_keys.call_args[0]
        assert "claude" in call_args[2]
        assert "--append-system-prompt" in call_args[2]
        assert "Ready to coordinate" in call_args[2]

        mock_wait_status.assert_called_once_with(
            provider, TerminalStatus.COMPLETED, timeout=90.0, polling_interval=1.0
        )

    @patch("cli_agent_orchestrator.providers.claude_code.load_agent_profile")
    @patch("cli_agent_orchestrator.providers.claude_code.wait_until_status")
    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_initialize_without_initial_prompt(
        self, mock_tmux, mock_wait_status, mock_load_profile
    ):
        mock_profile = MagicMock()
        mock_profile.system_prompt = "You are a supervisor"
        mock_profile.initial_prompt = None
        mock_profile.mcpServers = None
        mock_load_profile.return_value = mock_profile
        mock_wait_status.return_value = True

        provider = ClaudeCodeProvider(
            "test1234", "test-session", "window-0", "supervisor"
        )
        result = provider.initialize()

        assert result is True

        mock_wait_status.assert_called_once_with(
            provider, TerminalStatus.IDLE, timeout=30.0, polling_interval=1.0
        )


class TestClaudeCodeProviderStatusDetection:
    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_get_status_idle(self, mock_tmux):
        mock_tmux.get_history.return_value = load_fixture("claude_code_idle_output.txt")

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.IDLE

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_get_status_completed(self, mock_tmux):
        mock_tmux.get_history.return_value = load_fixture(
            "claude_code_completed_output.txt"
        )

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.COMPLETED

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_get_status_processing(self, mock_tmux):
        mock_tmux.get_history.return_value = load_fixture(
            "claude_code_processing_output.txt"
        )

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.PROCESSING

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_get_status_waiting_user_answer(self, mock_tmux):
        mock_tmux.get_history.return_value = load_fixture(
            "claude_code_waiting_user_answer.txt"
        )

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.WAITING_USER_ANSWER

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_get_status_error(self, mock_tmux):
        mock_tmux.get_history.return_value = ""

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.ERROR

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_get_status_with_tail_lines(self, mock_tmux):
        mock_tmux.get_history.return_value = load_fixture("claude_code_idle_output.txt")

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status(tail_lines=50)

        assert status == TerminalStatus.IDLE
        mock_tmux.get_history.assert_called_once_with(
            "test-session", "window-0", tail_lines=50
        )

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_get_status_default_tail_lines_500(self, mock_tmux):
        mock_tmux.get_history.return_value = load_fixture("claude_code_idle_output.txt")

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.IDLE
        mock_tmux.get_history.assert_called_once_with(
            "test-session", "window-0", tail_lines=500
        )


class TestClaudeCodeProviderCompletionDetection:
    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_completion_with_cogitated_timestamp(self, mock_tmux):
        output = '✻ Cogitated for 52s\n\n❯ Try "edit files"\n? for shortcuts'
        mock_tmux.get_history.return_value = output

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.COMPLETED

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_completion_with_minutes(self, mock_tmux):
        output = '✻ Cogitated for 2m\n\n❯ Try "edit files"\n? for shortcuts'
        mock_tmux.get_history.return_value = output

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.COMPLETED

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_completion_with_hours(self, mock_tmux):
        output = '✻ Cogitated for 1h\n\n❯ Try "edit files"\n? for shortcuts'
        mock_tmux.get_history.return_value = output

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.COMPLETED

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_no_false_positive_during_processing(self, mock_tmux):
        output = "✶ Canoodling… (ctrl+c to interrupt · 49s)"
        mock_tmux.get_history.return_value = output

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.PROCESSING

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_no_false_positive_response_text_with_duration(self, mock_tmux):
        output = "● Response text mentions '2m 15s' duration\nctrl+c to interrupt"
        mock_tmux.get_history.return_value = output

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.PROCESSING

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_idle_not_completed(self, mock_tmux):
        output = '❯ Try "edit files"\n? for shortcuts'
        mock_tmux.get_history.return_value = output

        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        status = provider.get_status()

        assert status == TerminalStatus.IDLE

    @patch("cli_agent_orchestrator.providers.claude_code.tmux_client")
    def test_completion_requires_all_conditions(self, mock_tmux):
        output_no_timestamp = '❯ Try "edit files"\n? for shortcuts'
        mock_tmux.get_history.return_value = output_no_timestamp
        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        assert provider.get_status() == TerminalStatus.IDLE

        output_still_processing = (
            '✻ Cogitated for 52s\nctrl+c to interrupt\n❯ Try "edit files"'
        )
        mock_tmux.get_history.return_value = output_still_processing
        assert provider.get_status() == TerminalStatus.PROCESSING

        output_no_idle_prompt = "✻ Cogitated for 52s"
        mock_tmux.get_history.return_value = output_no_idle_prompt
        assert provider.get_status() == TerminalStatus.ERROR


class TestClaudeCodeProviderPatterns:
    def test_completion_pattern_matches_seconds(self):
        from cli_agent_orchestrator.providers.claude_code import COMPLETION_PATTERN

        assert re.search(COMPLETION_PATTERN, "Cogitated for 52s")
        assert re.search(COMPLETION_PATTERN, "Cogitated for 1s")
        assert re.search(COMPLETION_PATTERN, "Cogitated for 999s")

    def test_completion_pattern_matches_minutes(self):
        from cli_agent_orchestrator.providers.claude_code import COMPLETION_PATTERN

        assert re.search(COMPLETION_PATTERN, "Cogitated for 2m")
        assert re.search(COMPLETION_PATTERN, "Cogitated for 15m")

    def test_completion_pattern_matches_hours(self):
        from cli_agent_orchestrator.providers.claude_code import COMPLETION_PATTERN

        assert re.search(COMPLETION_PATTERN, "Cogitated for 1h")
        assert re.search(COMPLETION_PATTERN, "Cogitated for 24h")

    def test_completion_pattern_does_not_match_invalid(self):
        from cli_agent_orchestrator.providers.claude_code import COMPLETION_PATTERN

        assert not re.search(COMPLETION_PATTERN, "Cogitated for 2 minutes")
        assert not re.search(COMPLETION_PATTERN, "Took 52s to complete")
        assert not re.search(COMPLETION_PATTERN, "2m 15s")

    def test_processing_pattern(self):
        from cli_agent_orchestrator.providers.claude_code import PROCESSING_PATTERN

        assert re.search(PROCESSING_PATTERN, "ctrl+c to interrupt")
        assert re.search(PROCESSING_PATTERN, "esc to interrupt")
        assert re.search(PROCESSING_PATTERN, "ctrl+c  to  interrupt")

    def test_idle_prompt_pattern_with_ansi(self):
        from cli_agent_orchestrator.providers.claude_code import IDLE_PROMPT_PATTERN

        output = load_fixture("claude_code_idle_output.txt")
        assert re.search(IDLE_PROMPT_PATTERN, output)

    def test_waiting_user_answer_pattern(self):
        from cli_agent_orchestrator.providers.claude_code import (
            WAITING_USER_ANSWER_PATTERN,
        )

        assert re.search(WAITING_USER_ANSWER_PATTERN, "❯ 1. Yes")
        assert re.search(WAITING_USER_ANSWER_PATTERN, "❯ 2. No")
        assert re.search(WAITING_USER_ANSWER_PATTERN, " ❯ 1. Accept")

    def test_response_pattern_bullet_symbol(self):
        from cli_agent_orchestrator.providers.claude_code import RESPONSE_PATTERN

        assert re.search(RESPONSE_PATTERN, "● Ich erstelle die Datei test.txt")
        assert re.search(RESPONSE_PATTERN, "● Write(test.txt)")
        assert re.search(RESPONSE_PATTERN, "● Die Datei wurde erstellt")

    def test_response_pattern_with_ansi_codes(self):
        from cli_agent_orchestrator.providers.claude_code import RESPONSE_PATTERN

        assert re.search(RESPONSE_PATTERN, "\x1b[38;2;255;255;255m●\x1b[39m Text here")
        assert re.search(
            RESPONSE_PATTERN, "\x1b[38;2;78;186;101m●\x1b[39m Write(file.txt)"
        )
        assert re.search(RESPONSE_PATTERN, "●\x1b[39m Another response")


class TestClaudeCodeProviderEdgeCases:
    def test_exit_cli_command(self):
        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        exit_cmd = provider.exit_cli()

        assert exit_cmd == "/exit"

    def test_cleanup(self):
        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")
        provider._initialized = True

        provider.cleanup()

        assert provider._initialized is False

    def test_terminal_attributes(self):
        provider = ClaudeCodeProvider("test1234", "test-session", "window-0")

        assert provider.terminal_id == "test1234"
        assert provider.session_name == "test-session"
        assert provider.window_name == "window-0"
