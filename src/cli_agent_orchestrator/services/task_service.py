"""Task service for task management."""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from cli_agent_orchestrator.clients.database import (
    assign_task as db_assign_task,
    create_task as db_create_task,
    create_terminal_state,
    get_task,
    get_task_assignments,
    get_terminal_state,
    list_tasks,
    update_task_assignment,
    update_task_status,
    update_terminal_state,
)

logger = logging.getLogger(__name__)


def generate_task_id() -> str:
    """Generate unique task ID."""
    return f"T-{uuid.uuid4().hex[:8].upper()}"


def create_task(
    title: str,
    description: str,
    task_type: str,
    workflow_id: Optional[str] = None,
    priority: int = 0,
    dependencies: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a new task."""
    task_id = generate_task_id()

    dependencies_json = json.dumps(dependencies) if dependencies else None
    metadata_json = json.dumps(metadata) if metadata else None

    task = db_create_task(
        task_id=task_id,
        title=title,
        description=description,
        task_type=task_type,
        workflow_id=workflow_id,
        priority=priority,
        status="PENDING",
        dependencies=dependencies_json,
        task_metadata=metadata_json,
    )

    logger.info(f"Created task {task_id}: {title}")
    return task


def assign_task_to_terminal(
    task_id: str, terminal_id: str, initial_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """Assign task to terminal and update terminal state."""
    task = get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    if task["status"] not in ["PENDING", "FAILED"]:
        raise ValueError(f"Task {task_id} is already {task['status']}")

    terminal_state = get_terminal_state(terminal_id)

    context_data = {
        "current_task_id": task_id,
        "task_title": task["title"],
        "task_type": task["task_type"],
        "assigned_at": datetime.now().isoformat(),
    }

    if terminal_state:
        update_terminal_state(
            terminal_id=terminal_id,
            context_data=json.dumps(context_data),
            initial_prompt=initial_prompt,
        )
    else:
        create_terminal_state(
            terminal_id=terminal_id,
            context_data=json.dumps(context_data),
            initial_prompt=initial_prompt,
        )

    assignment = db_assign_task(task_id, terminal_id, status="ASSIGNED")

    update_task_status(task_id, "ASSIGNED")

    logger.info(f"Assigned task {task_id} to terminal {terminal_id}")
    return assignment


def start_task(assignment_id: int) -> bool:
    """Mark task assignment as started."""
    success = update_task_assignment(
        assignment_id=assignment_id,
        status="IN_PROGRESS",
        started_at=datetime.now(),
    )

    if success:
        assignments = get_task_assignments()
        for a in assignments:
            if a["id"] == assignment_id:
                update_task_status(a["task_id"], "IN_PROGRESS")
                break

    return success


def complete_task(assignment_id: int, result: Optional[Dict[str, Any]] = None) -> bool:
    """Mark task assignment as completed."""
    result_json = json.dumps(result) if result else None

    success = update_task_assignment(
        assignment_id=assignment_id,
        status="COMPLETED",
        completed_at=datetime.now(),
        result=result_json,
    )

    if success:
        assignments = get_task_assignments()
        for a in assignments:
            if a["id"] == assignment_id:
                update_task_status(
                    a["task_id"], "COMPLETED", completed_at=datetime.now()
                )
                break

    return success


def fail_task(assignment_id: int, error_message: str) -> bool:
    """Mark task assignment as failed."""
    success = update_task_assignment(
        assignment_id=assignment_id,
        status="FAILED",
        completed_at=datetime.now(),
        error_message=error_message,
    )

    if success:
        assignments = get_task_assignments()
        for a in assignments:
            if a["id"] == assignment_id:
                update_task_status(a["task_id"], "FAILED")
                break

    return success


def get_pending_tasks(
    workflow_id: Optional[str] = None, task_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get all pending tasks."""
    return list_tasks(workflow_id=workflow_id, status="PENDING", task_type=task_type)


def get_terminal_current_task(terminal_id: str) -> Optional[Dict[str, Any]]:
    """Get current task assigned to terminal."""
    state = get_terminal_state(terminal_id)
    if not state or not state.get("context_data"):
        return None

    try:
        context = json.loads(state["context_data"])
        task_id = context.get("current_task_id")
        if task_id:
            return get_task(task_id)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse context_data for terminal {terminal_id}")

    return None
