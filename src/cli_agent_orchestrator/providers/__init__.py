"""CLI tool providers package."""

from cli_agent_orchestrator.providers.base import BaseProvider
from cli_agent_orchestrator.providers.claude_code import ClaudeCodeProvider
from cli_agent_orchestrator.providers.kiro_cli import KiroCliProvider
from cli_agent_orchestrator.providers.q_cli import QCliProvider
from cli_agent_orchestrator.providers.opencode import OpenCodeProvider

try:
    from cli_agent_orchestrator.providers.gemini_cli import GeminiCliProvider
except ImportError:
    pass

try:
    from cli_agent_orchestrator.providers.qwen_cli import QwenCliProvider
except ImportError:
    pass

try:
    from cli_agent_orchestrator.providers.gh_copilot import GhCopilotProvider
except ImportError:
    pass

__all__ = [
    "BaseProvider",
    "ClaudeCodeProvider",
    "KiroCliProvider",
    "QCliProvider",
    "OpenCodeProvider",
    "GeminiCliProvider",
    "QwenCliProvider",
    "GhCopilotProvider",
]
