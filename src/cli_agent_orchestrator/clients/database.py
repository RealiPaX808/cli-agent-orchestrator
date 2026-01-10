"""Minimal database client with only terminal metadata."""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, declarative_base, sessionmaker

from cli_agent_orchestrator.constants import DATABASE_URL, DB_DIR, DEFAULT_PROVIDER
from cli_agent_orchestrator.models.flow import Flow
from cli_agent_orchestrator.models.inbox import InboxMessage, MessageStatus

logger = logging.getLogger(__name__)

Base: Any = declarative_base()


class TerminalModel(Base):
    """SQLAlchemy model for terminal metadata only."""

    __tablename__ = "terminals"

    id = Column(String, primary_key=True)  # "abc123ef"
    tmux_session = Column(String, nullable=False)  # "cao-session-name"
    tmux_window = Column(String, nullable=False)  # "window-name"
    provider = Column(String, nullable=False)  # "q_cli", "claude_code"
    agent_profile = Column(String)  # "developer", "reviewer" (optional)
    last_active = Column(DateTime, default=datetime.now)


class InboxModel(Base):
    """SQLAlchemy model for inbox messages."""

    __tablename__ = "inbox"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(String, nullable=False)
    receiver_id = Column(String, nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, nullable=False)  # MessageStatus enum value
    created_at = Column(DateTime, default=datetime.now)


class FlowModel(Base):
    """SQLAlchemy model for flow metadata."""

    __tablename__ = "flows"

    name = Column(String, primary_key=True)
    file_path = Column(String, nullable=False)
    schedule = Column(String, nullable=False)
    agent_profile = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    script = Column(String, nullable=True)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    enabled = Column(Boolean, default=True)


class WorkflowModel(Base):
    """SQLAlchemy model for workflow metadata."""

    __tablename__ = "workflows"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    config = Column(String, nullable=False)  # JSON string
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    version = Column(Integer, default=1)


class WorkflowNodeModel(Base):
    """SQLAlchemy model for workflow nodes."""

    __tablename__ = "workflow_nodes"

    id = Column(String, primary_key=True)
    workflow_id = Column(String, nullable=False)
    node_data = Column(String, nullable=False)  # JSON string containing all node data
    position_x = Column(Integer, nullable=False, default=0)
    position_y = Column(Integer, nullable=False, default=0)


class WorkflowEdgeModel(Base):
    """SQLAlchemy model for workflow edges."""

    __tablename__ = "workflow_edges"

    id = Column(String, primary_key=True)
    workflow_id = Column(String, nullable=False)
    source = Column(String, nullable=False)
    target = Column(String, nullable=False)
    edge_data = Column(String, nullable=True)  # JSON string containing edge metadata


class SessionWorkflowModel(Base):
    """SQLAlchemy model for session-workflow mapping."""

    __tablename__ = "session_workflows"

    session_name = Column(String, primary_key=True)
    workflow_id = Column(String, nullable=False)
    assigned_at = Column(DateTime, default=datetime.now)


# Module-level singletons
DB_DIR.mkdir(parents=True, exist_ok=True)
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)


def create_terminal(
    terminal_id: str,
    tmux_session: str,
    tmux_window: str,
    provider: str,
    agent_profile: Optional[str] = None,
) -> Dict[str, Any]:
    """Create terminal metadata record."""
    with SessionLocal() as db:
        terminal = TerminalModel(
            id=terminal_id,
            tmux_session=tmux_session,
            tmux_window=tmux_window,
            provider=provider,
            agent_profile=agent_profile,
        )
        db.add(terminal)
        db.commit()
        return {
            "id": terminal.id,
            "tmux_session": terminal.tmux_session,
            "tmux_window": terminal.tmux_window,
            "provider": terminal.provider,
            "agent_profile": terminal.agent_profile,
        }


def get_terminal_metadata(terminal_id: str) -> Optional[Dict[str, Any]]:
    """Get terminal metadata by ID."""
    with SessionLocal() as db:
        terminal = (
            db.query(TerminalModel).filter(TerminalModel.id == terminal_id).first()
        )
        if not terminal:
            logger.warning(
                f"Terminal metadata not found for terminal_id: {terminal_id}"
            )
            return None
        logger.debug(
            f"Retrieved terminal metadata for {terminal_id}: provider={terminal.provider}, session={terminal.tmux_session}"
        )
        return {
            "id": terminal.id,
            "tmux_session": terminal.tmux_session,
            "tmux_window": terminal.tmux_window,
            "provider": terminal.provider,
            "agent_profile": terminal.agent_profile,
            "last_active": terminal.last_active,
        }


def list_terminals_by_session(tmux_session: str) -> List[Dict[str, Any]]:
    """List all terminals in a tmux session."""
    with SessionLocal() as db:
        terminals = (
            db.query(TerminalModel)
            .filter(TerminalModel.tmux_session == tmux_session)
            .all()
        )
        return [
            {
                "id": t.id,
                "tmux_session": t.tmux_session,
                "tmux_window": t.tmux_window,
                "provider": t.provider,
                "agent_profile": t.agent_profile,
                "last_active": t.last_active,
            }
            for t in terminals
        ]


def update_last_active(terminal_id: str) -> bool:
    """Update last active timestamp."""
    with SessionLocal() as db:
        terminal = (
            db.query(TerminalModel).filter(TerminalModel.id == terminal_id).first()
        )
        if terminal:
            terminal.last_active = datetime.now()
            db.commit()
            return True
        return False


def delete_terminal(terminal_id: str) -> bool:
    """Delete terminal metadata."""
    with SessionLocal() as db:
        deleted = (
            db.query(TerminalModel).filter(TerminalModel.id == terminal_id).delete()
        )
        db.commit()
        return deleted > 0


def delete_terminals_by_session(tmux_session: str) -> int:
    """Delete all terminals in a session."""
    with SessionLocal() as db:
        deleted = (
            db.query(TerminalModel)
            .filter(TerminalModel.tmux_session == tmux_session)
            .delete()
        )
        db.commit()
        return deleted


def create_inbox_message(
    sender_id: str, receiver_id: str, message: str
) -> InboxMessage:
    """Create inbox message with status=MessageStatus.PENDING."""
    with SessionLocal() as db:
        inbox_msg = InboxModel(
            sender_id=sender_id,
            receiver_id=receiver_id,
            message=message,
            status=MessageStatus.PENDING.value,
        )
        db.add(inbox_msg)
        db.commit()
        db.refresh(inbox_msg)
        return InboxMessage(
            id=inbox_msg.id,
            sender_id=inbox_msg.sender_id,
            receiver_id=inbox_msg.receiver_id,
            message=inbox_msg.message,
            status=MessageStatus(inbox_msg.status),
            created_at=inbox_msg.created_at,
        )


def get_pending_messages(receiver_id: str, limit: int = 1) -> List[InboxMessage]:
    """Get pending messages ordered by created_at ASC (oldest first)."""
    return get_inbox_messages(receiver_id, limit=limit, status=MessageStatus.PENDING)


def get_inbox_messages(
    receiver_id: str, limit: int = 10, status: Optional[MessageStatus] = None
) -> List[InboxMessage]:
    """Get inbox messages with optional status filter ordered by created_at ASC (oldest first).

    Args:
        receiver_id: Terminal ID to get messages for
        limit: Maximum number of messages to return (default: 10)
        status: Optional filter by message status (None = all statuses)

    Returns:
        List of inbox messages ordered by creation time (oldest first)
    """
    with SessionLocal() as db:
        query = db.query(InboxModel).filter(InboxModel.receiver_id == receiver_id)

        if status is not None:
            query = query.filter(InboxModel.status == status.value)

        messages = query.order_by(InboxModel.created_at.asc()).limit(limit).all()

        return [
            InboxMessage(
                id=msg.id,
                sender_id=msg.sender_id,
                receiver_id=msg.receiver_id,
                message=msg.message,
                status=MessageStatus(msg.status),
                created_at=msg.created_at,
            )
            for msg in messages
        ]


def update_message_status(message_id: int, status: MessageStatus) -> bool:
    """Update message status to MessageStatus.DELIVERED or MessageStatus.FAILED."""
    with SessionLocal() as db:
        message = db.query(InboxModel).filter(InboxModel.id == message_id).first()
        if message:
            message.status = status.value
            db.commit()
            return True
        return False


# Flow database functions


def create_flow(
    name: str,
    file_path: str,
    schedule: str,
    agent_profile: str,
    provider: str,
    script: str,
    next_run: datetime,
) -> Flow:
    """Create flow record."""
    with SessionLocal() as db:
        flow = FlowModel(
            name=name,
            file_path=file_path,
            schedule=schedule,
            agent_profile=agent_profile,
            provider=provider,
            script=script,
            next_run=next_run,
        )
        db.add(flow)
        db.commit()
        db.refresh(flow)
        return Flow(
            name=flow.name,
            file_path=flow.file_path,
            schedule=flow.schedule,
            agent_profile=flow.agent_profile,
            provider=flow.provider,
            script=flow.script,
            last_run=flow.last_run,
            next_run=flow.next_run,
            enabled=flow.enabled,
        )


def get_flow(name: str) -> Optional[Flow]:
    """Get flow by name."""
    with SessionLocal() as db:
        flow = db.query(FlowModel).filter(FlowModel.name == name).first()
        if not flow:
            return None
        return Flow(
            name=flow.name,
            file_path=flow.file_path,
            schedule=flow.schedule,
            agent_profile=flow.agent_profile,
            provider=flow.provider,
            script=flow.script,
            last_run=flow.last_run,
            next_run=flow.next_run,
            enabled=flow.enabled,
        )


def list_flows() -> List[Flow]:
    """List all flows."""
    with SessionLocal() as db:
        flows = db.query(FlowModel).order_by(FlowModel.next_run).all()
        return [
            Flow(
                name=f.name,
                file_path=f.file_path,
                schedule=f.schedule,
                agent_profile=f.agent_profile,
                provider=f.provider,
                script=f.script,
                last_run=f.last_run,
                next_run=f.next_run,
                enabled=f.enabled,
            )
            for f in flows
        ]


def update_flow_run_times(name: str, last_run: datetime, next_run: datetime) -> bool:
    """Update flow run times after execution."""
    with SessionLocal() as db:
        flow = db.query(FlowModel).filter(FlowModel.name == name).first()
        if flow:
            flow.last_run = last_run
            flow.next_run = next_run
            db.commit()
            return True
        return False


def update_flow_enabled(
    name: str, enabled: bool, next_run: Optional[datetime] = None
) -> bool:
    """Update flow enabled status and optionally next_run."""
    with SessionLocal() as db:
        flow = db.query(FlowModel).filter(FlowModel.name == name).first()
        if flow:
            flow.enabled = enabled
            if next_run is not None:
                flow.next_run = next_run
            db.commit()
            return True
        return False


def delete_flow(name: str) -> bool:
    """Delete flow."""
    with SessionLocal() as db:
        deleted = db.query(FlowModel).filter(FlowModel.name == name).delete()
        db.commit()
        return deleted > 0


def get_flows_to_run() -> List[Flow]:
    """Get enabled flows where next_run <= now."""
    with SessionLocal() as db:
        now = datetime.now()
        flows = (
            db.query(FlowModel)
            .filter(FlowModel.enabled == True, FlowModel.next_run <= now)
            .all()
        )
        return [
            Flow(
                name=f.name,
                file_path=f.file_path,
                schedule=f.schedule,
                agent_profile=f.agent_profile,
                provider=f.provider,
                script=f.script,
                last_run=f.last_run,
                next_run=f.next_run,
                enabled=f.enabled,
            )
            for f in flows
        ]


def create_workflow(
    workflow_id: str,
    name: str,
    description: Optional[str],
    config: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Create workflow with nodes and edges."""
    with SessionLocal() as db:
        workflow = WorkflowModel(
            id=workflow_id,
            name=name,
            description=description,
            config=config,
            version=1,
        )
        db.add(workflow)

        for node in nodes:
            node_model = WorkflowNodeModel(
                id=node["id"],
                workflow_id=workflow_id,
                node_data=node["data"],
                position_x=node.get("position_x", 0),
                position_y=node.get("position_y", 0),
            )
            db.add(node_model)

        for edge in edges:
            edge_model = WorkflowEdgeModel(
                id=edge["id"],
                workflow_id=workflow_id,
                source=edge["source"],
                target=edge["target"],
                edge_data=edge.get("data"),
            )
            db.add(edge_model)

        db.commit()
        db.refresh(workflow)

        return {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "config": workflow.config,
            "created_at": workflow.created_at,
            "updated_at": workflow.updated_at,
            "version": workflow.version,
        }


def get_workflow(workflow_id: str) -> Optional[Dict[str, Any]]:
    """Get complete workflow with nodes and edges."""
    with SessionLocal() as db:
        workflow = (
            db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()
        )
        if not workflow:
            return None

        nodes = (
            db.query(WorkflowNodeModel)
            .filter(WorkflowNodeModel.workflow_id == workflow_id)
            .all()
        )
        edges = (
            db.query(WorkflowEdgeModel)
            .filter(WorkflowEdgeModel.workflow_id == workflow_id)
            .all()
        )

        return {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "config": workflow.config,
            "created_at": workflow.created_at,
            "updated_at": workflow.updated_at,
            "version": workflow.version,
            "nodes": [
                {
                    "id": n.id,
                    "data": n.node_data,
                    "position_x": n.position_x,
                    "position_y": n.position_y,
                }
                for n in nodes
            ],
            "edges": [
                {
                    "id": e.id,
                    "source": e.source,
                    "target": e.target,
                    "data": e.edge_data,
                }
                for e in edges
            ],
        }


def list_workflows() -> List[Dict[str, Any]]:
    """List all workflows (metadata only, without nodes/edges)."""
    with SessionLocal() as db:
        workflows = (
            db.query(WorkflowModel).order_by(WorkflowModel.updated_at.desc()).all()
        )
        result = []
        for w in workflows:
            node_count = (
                db.query(WorkflowNodeModel)
                .filter(WorkflowNodeModel.workflow_id == w.id)
                .count()
            )
            result.append(
                {
                    "id": w.id,
                    "name": w.name,
                    "description": w.description,
                    "config": w.config,
                    "created_at": w.created_at,
                    "updated_at": w.updated_at,
                    "version": w.version,
                    "node_count": node_count,
                }
            )
        return result


def update_workflow(
    workflow_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    config: Optional[str] = None,
    nodes: Optional[List[Dict[str, Any]]] = None,
    edges: Optional[List[Dict[str, Any]]] = None,
) -> bool:
    """Update workflow and optionally its nodes/edges."""
    with SessionLocal() as db:
        workflow = (
            db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()
        )
        if not workflow:
            return False

        if name is not None:
            workflow.name = name
        if description is not None:
            workflow.description = description
        if config is not None:
            workflow.config = config

        workflow.updated_at = datetime.now()
        workflow.version = (workflow.version or 1) + 1

        if nodes is not None:
            db.query(WorkflowNodeModel).filter(
                WorkflowNodeModel.workflow_id == workflow_id
            ).delete()
            for node in nodes:
                node_model = WorkflowNodeModel(
                    id=node["id"],
                    workflow_id=workflow_id,
                    node_data=node["data"],
                    position_x=node.get("position_x", 0),
                    position_y=node.get("position_y", 0),
                )
                db.add(node_model)

        if edges is not None:
            db.query(WorkflowEdgeModel).filter(
                WorkflowEdgeModel.workflow_id == workflow_id
            ).delete()
            for edge in edges:
                edge_model = WorkflowEdgeModel(
                    id=edge["id"],
                    workflow_id=workflow_id,
                    source=edge["source"],
                    target=edge["target"],
                    edge_data=edge.get("data"),
                )
                db.add(edge_model)

        db.commit()
        return True


def delete_workflow(workflow_id: str) -> bool:
    """Delete workflow and all associated nodes/edges."""
    with SessionLocal() as db:
        db.query(WorkflowNodeModel).filter(
            WorkflowNodeModel.workflow_id == workflow_id
        ).delete()
        db.query(WorkflowEdgeModel).filter(
            WorkflowEdgeModel.workflow_id == workflow_id
        ).delete()
        db.query(SessionWorkflowModel).filter(
            SessionWorkflowModel.workflow_id == workflow_id
        ).delete()

        deleted = (
            db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).delete()
        )
        db.commit()
        return deleted > 0


def assign_workflow_to_session(session_name: str, workflow_id: str) -> bool:
    """Assign workflow to session."""
    with SessionLocal() as db:
        existing = (
            db.query(SessionWorkflowModel)
            .filter(SessionWorkflowModel.session_name == session_name)
            .first()
        )

        if existing:
            existing.workflow_id = workflow_id
            existing.assigned_at = datetime.now()
        else:
            mapping = SessionWorkflowModel(
                session_name=session_name,
                workflow_id=workflow_id,
            )
            db.add(mapping)

        db.commit()
        return True


def get_session_workflow(session_name: str) -> Optional[str]:
    """Get workflow ID assigned to session."""
    with SessionLocal() as db:
        mapping = (
            db.query(SessionWorkflowModel)
            .filter(SessionWorkflowModel.session_name == session_name)
            .first()
        )

        if mapping:
            return mapping.workflow_id
        return None


def unassign_workflow_from_session(session_name: str) -> bool:
    """Remove workflow assignment from session."""
    with SessionLocal() as db:
        deleted = (
            db.query(SessionWorkflowModel)
            .filter(SessionWorkflowModel.session_name == session_name)
            .delete()
        )
        db.commit()
        return deleted > 0
