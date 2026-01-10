import logging
from typing import Dict, Optional, List
from enum import Enum

logger = logging.getLogger(__name__)


class WorkflowExecutionStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class NodeExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowExecutionState:
    def __init__(self, workflow_id: str, session_name: str):
        self.workflow_id = workflow_id
        self.session_name = session_name
        self.status = WorkflowExecutionStatus.IDLE
        self.current_node_id: Optional[str] = None
        self.node_states: Dict[str, Dict] = {}
        self.spawned_terminals: Dict[str, str] = {}

    def to_dict(self) -> Dict:
        return {
            "workflow_id": self.workflow_id,
            "session_name": self.session_name,
            "status": self.status.value,
            "current_node_id": self.current_node_id,
            "node_states": self.node_states,
            "spawned_terminals": self.spawned_terminals,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "WorkflowExecutionState":
        state = cls(data["workflow_id"], data["session_name"])
        state.status = WorkflowExecutionStatus(data["status"])
        state.current_node_id = data.get("current_node_id")
        state.node_states = data.get("node_states", {})
        state.spawned_terminals = data.get("spawned_terminals", {})
        return state


_execution_states: Dict[str, WorkflowExecutionState] = {}


def create_execution_state(
    session_name: str, workflow_id: str
) -> WorkflowExecutionState:
    state = WorkflowExecutionState(workflow_id, session_name)
    _execution_states[session_name] = state
    logger.info(
        f"Created execution state for session {session_name}, workflow {workflow_id}"
    )
    return state


def get_execution_state(session_name: str) -> Optional[WorkflowExecutionState]:
    return _execution_states.get(session_name)


def update_node_state(
    session_name: str,
    node_id: str,
    status: NodeExecutionStatus,
    terminal_id: Optional[str] = None,
    output: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    state = get_execution_state(session_name)
    if not state:
        logger.warning(f"No execution state found for session {session_name}")
        return

    state.node_states[node_id] = {
        "status": status.value,
        "terminal_id": terminal_id,
        "output": output,
        "error": error,
    }

    if terminal_id:
        state.spawned_terminals[node_id] = terminal_id

    logger.info(
        f"Updated node {node_id} state to {status.value} in session {session_name}"
    )


def get_nodes_requiring_agents(session_name: str, workflow: Dict) -> List[Dict]:
    state = get_execution_state(session_name)
    if not state:
        return []

    nodes_to_spawn = []

    for node in workflow.get("nodes", []):
        node_id = node["id"]
        node_data = node.get("data", {})
        node_type = node_data.get("type")

        if node_type in ["agent_spawn", "handoff", "assign", "send_message"]:
            node_state = state.node_states.get(node_id, {})
            node_status = node_state.get("status", "pending")

            if state.current_node_id == node_id and node_status == "running":
                if node_id not in state.spawned_terminals:
                    nodes_to_spawn.append(
                        {
                            "node_id": node_id,
                            "agent_profile": node_data.get("config", {}).get(
                                "agentProfile"
                            ),
                            "provider": node_data.get("config", {}).get(
                                "provider", "q_cli"
                            ),
                            "message": node_data.get("config", {}).get("message"),
                        }
                    )

    return nodes_to_spawn


def cleanup_execution_state(session_name: str) -> None:
    if session_name in _execution_states:
        del _execution_states[session_name]
        logger.info(f"Cleaned up execution state for session {session_name}")
