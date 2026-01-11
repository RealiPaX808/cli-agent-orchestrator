"""Database fixtures for testing."""

import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from cli_agent_orchestrator.clients.database import (
    Base, TerminalModel, InboxModel, WorkflowModel,
    WorkflowNodeModel, WorkflowEdgeModel, FlowModel
)
from cli_agent_orchestrator.models.terminal import TerminalStatus
from cli_agent_orchestrator.models.inbox import MessageStatus


class DatabaseFixtureManager:
    """Manages test database fixtures."""
    
    def __init__(self, db_path: Optional[Path] = None):
        """Initialize the database fixture manager.
        
        Args:
            db_path: Path to database file. If None, uses in-memory database.
        """
        if db_path is None:
            self.db_url = "sqlite:///:memory:"
        else:
            self.db_url = f"sqlite:///{db_path}"
        
        self._engine = None
        self._session_factory = None
    
    def connect(self) -> None:
        """Create database connection and create tables."""
        self._engine = create_engine(self.db_url)
        Base.metadata.create_all(bind=self._engine)
        self._session_factory = sessionmaker(bind=self._engine)
    
    def disconnect(self) -> None:
        """Close database connection."""
        if self._engine:
            self._engine.dispose()
            self._engine = None
            self._session_factory = None
    
    def session(self):
        """Get a database session."""
        if not self._session_factory:
            self.connect()
        return self._session_factory()
    
    def cleanup(self) -> None:
        """Remove all test data from database."""
        with self.session() as db:
            db.query(InboxModel).filter(
                InboxModel.sender_id.like("test-%")
            ).delete()
            db.query(TerminalModel).filter(
                TerminalModel.id.like("test-%")
            ).delete()
            db.query(WorkflowModel).filter(
                WorkflowModel.id.like("test-%")
            ).delete()
            db.commit()
    
    # Terminal fixtures
    def create_terminal(
        self,
        terminal_id: str,
        tmux_session: str,
        tmux_window: str,
        provider: str = "q_cli",
        agent_profile: str = "developer"
    ) -> Dict:
        """Create a terminal fixture in the database."""
        with self.session() as db:
            terminal = TerminalModel(
                id=terminal_id,
                tmux_session=tmux_session,
                tmux_window=tmux_window,
                provider=provider,
                agent_profile=agent_profile
            )
            db.add(terminal)
            db.commit()
            db.refresh(terminal)
            
            return {
                "id": terminal.id,
                "tmux_session": terminal.tmux_session,
                "tmux_window": terminal.tmux_window,
                "provider": terminal.provider,
                "agent_profile": terminal.agent_profile,
                "last_active": terminal.last_active
            }
    
    def create_sample_terminals(self, count: int = 3) -> List[Dict]:
        """Create multiple sample terminals.
        
        Args:
            count: Number of terminals to create
            
        Returns:
            List of terminal dictionaries
        """
        terminals = []
        for i in range(count):
            terminal = self.create_terminal(
                terminal_id=f"test-term-{i:03d}",
                tmux_session=f"cao-test-session",
                tmux_window=f"window-{i}",
                provider="q_cli" if i % 2 == 0 else "claude_code",
                agent_profile="developer" if i % 2 == 0 else "reviewer"
            )
            terminals.append(terminal)
        return terminals
    
    # Inbox message fixtures
    def create_inbox_message(
        self,
        sender_id: str,
        receiver_id: str,
        message: str,
        status: MessageStatus = MessageStatus.PENDING
    ) -> Dict:
        """Create an inbox message fixture in the database."""
        with self.session() as db:
            inbox_msg = InboxModel(
                sender_id=sender_id,
                receiver_id=receiver_id,
                message=message,
                status=status.value
            )
            db.add(inbox_msg)
            db.commit()
            db.refresh(inbox_msg)
            
            return {
                "id": inbox_msg.id,
                "sender_id": inbox_msg.sender_id,
                "receiver_id": inbox_msg.receiver_id,
                "message": inbox_msg.message,
                "status": MessageStatus(inbox_msg.status),
                "created_at": inbox_msg.created_at
            }
    
    def create_message_conversation(
        self,
        sender_id: str,
        receiver_id: str,
        message_count: int = 3
    ) -> List[Dict]:
        """Create a conversation with multiple messages.
        
        Args:
            sender_id: Sender terminal ID
            receiver_id: Receiver terminal ID
            message_count: Number of messages to create
            
        Returns:
            List of message dictionaries
        """
        messages = []
        for i in range(message_count):
            status = MessageStatus.PENDING if i < message_count - 1 else MessageStatus.DELIVERED
            message = self.create_inbox_message(
                sender_id=sender_id,
                receiver_id=receiver_id,
                message=f"Test message {i + 1}",
                status=status
            )
            messages.append(message)
        return messages
