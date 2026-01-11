"""Task management API endpoints for CAO server."""

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, Path as PathParam, Query, status
from pydantic import BaseModel, Field

from cli_agent_orchestrator.clients.database import (
    create_task,
    create_terminal_state,
    delete_terminal_state,
    get_task,
    get_task_assignments,
    get_terminal_state,
    list_tasks,
    update_task_status,
    update_terminal_state,
)

logger = logging.getLogger(__name__)


class CreateTaskRequest(BaseModel):
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Task description")
    task_type: str = Field(..., description="Task type (CODE, REVIEW, TEST, ANALYZE)")
    workflow_id: Optional[str] = Field(None, description="Associated workflow ID")
    priority: int = Field(default=0, description="Task priority (higher = more urgent)")
    dependencies: Optional[List[str]] = Field(
        None, description="List of task IDs this task depends on"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Additional task metadata"
    )


class UpdateTaskStatusRequest(BaseModel):
    status: str = Field(
        ...,
        description="New status (PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, FAILED)",
    )
    error_message: Optional[str] = Field(
        None, description="Error message if status is FAILED"
    )


class AssignTaskRequest(BaseModel):
    terminal_id: str = Field(..., description="Terminal ID to assign the task to")
    initial_prompt: Optional[str] = Field(
        None, description="Custom initial prompt for the terminal"
    )


class UpdateAssignmentRequest(BaseModel):
    status: str = Field(
        ...,
        description="Assignment status (ASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, FAILED)",
    )
    result: Optional[Dict[str, Any]] = Field(None, description="Task result data")
    error_message: Optional[str] = Field(None, description="Error message if failed")


class CompleteAssignmentRequest(BaseModel):
    result: Optional[Dict[str, Any]] = Field(None, description="Task result data")


class FailAssignmentRequest(BaseModel):
    error_message: str = Field(..., description="Error message describing the failure")


class TerminalStateRequest(BaseModel):
    current_task_id: Optional[str] = Field(
        None, description="Currently assigned task ID (stored in context_data)"
    )
    checkpoints: Optional[List[Dict[str, Any]]] = Field(
        None, description="Progress checkpoints (stored in context_data)"
    )
    variables: Optional[Dict[str, Any]] = Field(None, description="Template variables")
    initial_prompt: Optional[str] = Field(None, description="Initial prompt override")
    context_data: Optional[Dict[str, Any]] = Field(
        None, description="Additional context data"
    )


def register_task_routes(app):
    """Register task management routes with FastAPI app."""

    @app.post("/tasks", status_code=status.HTTP_201_CREATED)
    async def create_task_endpoint(request: CreateTaskRequest) -> Dict[str, Any]:
        try:
            from cli_agent_orchestrator.services import task_service

            task = task_service.create_task(
                title=request.title,
                description=request.description,
                task_type=request.task_type,
                workflow_id=request.workflow_id,
                priority=request.priority,
                dependencies=request.dependencies,
                metadata=request.metadata,
            )
            return task
        except Exception as e:
            logger.exception("Failed to create task")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create task: {str(e)}",
            )

    @app.get("/tasks")
    async def list_tasks_endpoint(
        workflow_id: Optional[str] = Query(None, description="Filter by workflow ID"),
        task_status: Optional[str] = Query(None, description="Filter by status"),
        task_type: Optional[str] = Query(None, description="Filter by task type"),
    ) -> List[Dict[str, Any]]:
        try:
            tasks = list_tasks(
                workflow_id=workflow_id,
                status=task_status,
                task_type=task_type,
            )
            return tasks
        except Exception as e:
            logger.exception("Failed to list tasks")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to list tasks: {str(e)}",
            )

    @app.get("/tasks/{task_id}")
    async def get_task_endpoint(
        task_id: str = PathParam(..., description="Task ID"),
    ) -> Dict[str, Any]:
        try:
            task = get_task(task_id)
            if not task:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Task {task_id} not found",
                )
            return task
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to get task {task_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get task: {str(e)}",
            )

    @app.put("/tasks/{task_id}/status")
    async def update_task_status_endpoint(
        *,
        task_id: str = PathParam(..., description="Task ID"),
        request: UpdateTaskStatusRequest,
    ) -> Dict[str, Any]:
        try:
            success = update_task_status(
                task_id=task_id,
                status=request.status,
            )
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Task {task_id} not found",
                )

            task = get_task(task_id)
            if not task:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Task was updated but could not be retrieved",
                )
            return task
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to update task {task_id} status")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update task status: {str(e)}",
            )

    @app.delete("/tasks/{task_id}")
    async def delete_task_endpoint(
        *,
        task_id: str = PathParam(..., description="Task ID"),
    ) -> Dict[str, str]:
        try:
            success = update_task_status(task_id=task_id, status="CANCELLED")
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Task {task_id} not found",
                )
            return {"message": f"Task {task_id} cancelled successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to delete task {task_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete task: {str(e)}",
            )

    @app.post("/tasks/{task_id}/assign", status_code=status.HTTP_201_CREATED)
    async def assign_task_endpoint(
        *,
        task_id: str = PathParam(..., description="Task ID"),
        request: AssignTaskRequest,
    ) -> Dict[str, Any]:
        try:
            from cli_agent_orchestrator.services import task_service

            assignment = task_service.assign_task_to_terminal(
                task_id=task_id,
                terminal_id=request.terminal_id,
                initial_prompt=request.initial_prompt,
            )
            return assignment
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        except Exception as e:
            logger.exception(f"Failed to assign task {task_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to assign task: {str(e)}",
            )

    @app.put("/assignments/{assignment_id}/start")
    async def start_assignment_endpoint(assignment_id: int) -> Dict[str, Any]:
        try:
            from cli_agent_orchestrator.services import task_service

            success = task_service.start_task(assignment_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Assignment {assignment_id} not found",
                )

            assignments = get_task_assignments()
            assignment = next(
                (a for a in assignments if a["id"] == assignment_id), None
            )
            if not assignment:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Assignment was updated but could not be retrieved",
                )
            return assignment
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to start assignment {assignment_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start assignment: {str(e)}",
            )

    @app.put("/assignments/{assignment_id}/complete")
    async def complete_assignment_endpoint(
        assignment_id: int,
        request: CompleteAssignmentRequest,
    ) -> Dict[str, Any]:
        try:
            from cli_agent_orchestrator.services import task_service

            success = task_service.complete_task(
                assignment_id=assignment_id,
                result=request.result,
            )
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Assignment {assignment_id} not found",
                )

            assignments = get_task_assignments()
            assignment = next(
                (a for a in assignments if a["id"] == assignment_id), None
            )
            if not assignment:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Assignment was updated but could not be retrieved",
                )
            return assignment
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to complete assignment {assignment_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to complete assignment: {str(e)}",
            )

    @app.put("/assignments/{assignment_id}/fail")
    async def fail_assignment_endpoint(
        assignment_id: int,
        request: FailAssignmentRequest,
    ) -> Dict[str, Any]:
        try:
            from cli_agent_orchestrator.services import task_service

            success = task_service.fail_task(
                assignment_id=assignment_id,
                error_message=request.error_message,
            )
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Assignment {assignment_id} not found",
                )

            assignments = get_task_assignments()
            assignment = next(
                (a for a in assignments if a["id"] == assignment_id), None
            )
            if not assignment:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Assignment was updated but could not be retrieved",
                )
            return assignment
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to mark assignment {assignment_id} as failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to mark assignment as failed: {str(e)}",
            )

    @app.get("/terminals/{terminal_id}/task")
    async def get_terminal_task_endpoint(
        terminal_id: str = PathParam(..., description="Terminal ID"),
    ) -> Dict[str, Any]:
        try:
            from cli_agent_orchestrator.services import task_service

            assignment = task_service.get_terminal_current_task(terminal_id)
            if not assignment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No active task found for terminal {terminal_id}",
                )
            return assignment
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to get task for terminal {terminal_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get terminal task: {str(e)}",
            )

    @app.post("/terminals/{terminal_id}/state", status_code=status.HTTP_201_CREATED)
    async def create_or_update_terminal_state_endpoint(
        *,
        terminal_id: str = PathParam(..., description="Terminal ID"),
        request: TerminalStateRequest,
    ) -> Dict[str, Any]:
        try:
            existing_state = get_terminal_state(terminal_id)

            merged_context = request.context_data or {}
            if request.current_task_id is not None:
                merged_context["current_task_id"] = request.current_task_id
            if request.checkpoints is not None:
                merged_context["checkpoints"] = request.checkpoints

            context_json = json.dumps(merged_context) if merged_context else None
            variables_json = (
                json.dumps(request.variables) if request.variables else None
            )
            last_checkpoint_json = (
                json.dumps(request.checkpoints[-1]) if request.checkpoints else None
            )

            if existing_state:
                success = update_terminal_state(
                    terminal_id=terminal_id,
                    context_data=context_json,
                    variables=variables_json,
                    initial_prompt=request.initial_prompt,
                    last_checkpoint=last_checkpoint_json,
                )
                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to update terminal state",
                    )
                state = get_terminal_state(terminal_id)
                if not state:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Terminal state was updated but could not be retrieved",
                    )
            else:
                state = create_terminal_state(
                    terminal_id=terminal_id,
                    context_data=context_json,
                    variables=variables_json,
                    initial_prompt=request.initial_prompt,
                    last_checkpoint=last_checkpoint_json,
                )

            return state
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(
                f"Failed to create/update terminal state for {terminal_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create/update terminal state: {str(e)}",
            )

    @app.get("/terminals/{terminal_id}/state")
    async def get_terminal_state_endpoint(
        terminal_id: str = PathParam(..., description="Terminal ID"),
    ) -> Dict[str, Any]:
        try:
            state = get_terminal_state(terminal_id)
            if not state:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Terminal state for {terminal_id} not found",
                )

            expanded_state = dict(state)
            if state.get("context_data"):
                try:
                    context = json.loads(state["context_data"])
                    expanded_state["current_task_id"] = context.get("current_task_id")
                    expanded_state["checkpoints"] = context.get("checkpoints", [])
                    expanded_state["context_data"] = {
                        k: v
                        for k, v in context.items()
                        if k not in ("current_task_id", "checkpoints")
                    }
                except json.JSONDecodeError:
                    pass

            if state.get("variables"):
                try:
                    expanded_state["variables"] = json.loads(state["variables"])
                except json.JSONDecodeError:
                    pass

            return expanded_state
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to get terminal state for {terminal_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get terminal state: {str(e)}",
            )

    @app.delete("/terminals/{terminal_id}/state")
    async def delete_terminal_state_endpoint(
        terminal_id: str = PathParam(..., description="Terminal ID"),
    ) -> Dict[str, str]:
        try:
            success = delete_terminal_state(terminal_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Terminal state for {terminal_id} not found",
                )
            return {"message": f"Terminal state for {terminal_id} deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Failed to delete terminal state for {terminal_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete terminal state: {str(e)}",
            )
