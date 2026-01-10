"""Session service for session-level operations."""

import logging
from typing import Dict, List, Optional

from cli_agent_orchestrator.clients.database import (
    assign_workflow_to_session as db_assign_workflow,
    delete_terminals_by_session,
    get_session_workflow as db_get_session_workflow,
    list_terminals_by_session,
    unassign_workflow_from_session as db_unassign_workflow,
)
from cli_agent_orchestrator.clients.tmux import tmux_client
from cli_agent_orchestrator.constants import SESSION_PREFIX
from cli_agent_orchestrator.providers.manager import provider_manager

logger = logging.getLogger(__name__)


def list_sessions() -> List[Dict]:
    """List all sessions from tmux."""
    try:
        tmux_sessions = tmux_client.list_sessions()
        return [s for s in tmux_sessions if s["id"].startswith(SESSION_PREFIX)]
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        return []


def get_session(session_name: str) -> Dict:
    """Get session with terminals."""
    try:
        if not tmux_client.session_exists(session_name):
            raise ValueError(f"Session '{session_name}' not found")

        tmux_sessions = tmux_client.list_sessions()
        session_data = next((s for s in tmux_sessions if s["id"] == session_name), None)

        if not session_data:
            raise ValueError(f"Session '{session_name}' not found")

        terminals = list_terminals_by_session(session_name)
        return {"session": session_data, "terminals": terminals}

    except Exception as e:
        logger.error(f"Failed to get session {session_name}: {e}")
        raise


def delete_session(session_name: str) -> bool:
    """Delete session and cleanup."""
    try:
        if not tmux_client.session_exists(session_name):
            raise ValueError(f"Session '{session_name}' not found")

        terminals = list_terminals_by_session(session_name)

        for terminal in terminals:
            provider_manager.cleanup_provider(terminal["id"])

        tmux_client.kill_session(session_name)

        delete_terminals_by_session(session_name)

        db_unassign_workflow(session_name)

        logger.info(f"Deleted session: {session_name}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete session {session_name}: {e}")
        raise


def assign_workflow_to_session(session_name: str, workflow_id: str) -> None:
    if not tmux_client.session_exists(session_name):
        raise ValueError(f"Session '{session_name}' not found")
    db_assign_workflow(session_name, workflow_id)
    logger.info(f"Assigned workflow {workflow_id} to session {session_name}")


def get_session_workflow(session_name: str) -> Optional[str]:
    return db_get_session_workflow(session_name)
