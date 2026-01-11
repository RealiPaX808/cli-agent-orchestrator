"""Unit tests for session service."""

import pytest
from unittest.mock import Mock, patch, MagicMock

from cli_agent_orchestrator.services import session_service


class TestListSessions:
    """Test list_sessions function."""
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_list_sessions_success(self, mock_tmux):
        """Test successful session listing."""
        mock_tmux.list_sessions.return_value = [
            {"id": "cao-session-1", "name": "cao-session-1", "status": "active"},
            {"id": "cao-session-2", "name": "cao-session-2", "status": "detached"},
            {"id": "other-session", "name": "other-session", "status": "detached"},
        ]
        
        result = session_service.list_sessions()
        
        assert len(result) == 2
        assert all(s["id"].startswith("cao-") for s in result)
        assert result[0]["id"] == "cao-session-1"
        assert result[1]["id"] == "cao-session-2"
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_list_sessions_empty(self, mock_tmux):
        """Test listing when no sessions exist."""
        mock_tmux.list_sessions.return_value = []
        
        result = session_service.list_sessions()
        
        assert result == []
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_list_sessions_tmux_error(self, mock_tmux):
        """Test error handling when tmux fails."""
        mock_tmux.list_sessions.side_effect = Exception("Tmux error")
        
        result = session_service.list_sessions()
        
        assert result == []


class TestGetSession:
    """Test get_session function."""
    
    @patch("cli_agent_orchestrator.services.session_service.list_terminals_by_session")
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_get_session_success(self, mock_tmux, mock_list_terminals):
        """Test successful session retrieval."""
        mock_tmux.session_exists.return_value = True
        mock_tmux.list_sessions.return_value = [
            {"id": "cao-test", "name": "cao-test", "status": "active"}
        ]
        mock_list_terminals.return_value = [
            {
                "id": "term-1",
                "tmux_session": "cao-test",
                "tmux_window": "window-0",
                "provider": "q_cli",
                "agent_profile": "developer",
            }
        ]
        
        result = session_service.get_session("cao-test")
        
        assert result["session"]["id"] == "cao-test"
        assert len(result["terminals"]) == 1
        assert result["terminals"][0]["id"] == "term-1"
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_get_session_not_found(self, mock_tmux):
        """Test error when session doesn't exist."""
        mock_tmux.session_exists.return_value = False
        
        with pytest.raises(ValueError, match="not found"):
            session_service.get_session("nonexistent")


class TestDeleteSession:
    """Test delete_session function."""
    
    @patch("cli_agent_orchestrator.services.session_service.delete_terminals_by_session")
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    @patch("cli_agent_orchestrator.services.session_service.provider_manager")
    @patch("cli_agent_orchestrator.services.session_service.db_unassign_workflow")
    def test_delete_session_success(
        self, mock_unassign, mock_provider_mgr, mock_tmux, mock_delete_terms
    ):
        """Test successful session deletion."""
        mock_tmux.session_exists.return_value = True
        mock_delete_terms.return_value = [
            {
                "id": "term-1",
                "tmux_session": "cao-test",
                "tmux_window": "window-0",
            }
        ]
        
        result = session_service.delete_session("cao-test")
        
        assert result is True
        mock_provider_mgr.cleanup_provider.assert_called_once_with("term-1")
        mock_tmux.kill_session.assert_called_once_with("cao-test")
        mock_unassign.assert_called_once_with("cao-test")


class TestAssignWorkflowToSession:
    """Test assign_workflow_to_session function."""
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    @patch("cli_agent_orchestrator.services.session_service.db_assign_workflow")
    def test_assign_workflow_success(self, mock_db_assign, mock_tmux):
        """Test successful workflow assignment."""
        mock_tmux.session_exists.return_value = True
        
        result = session_service.assign_workflow_to_session("cao-test", "workflow-123")
        
        assert result is None
        mock_db_assign.assert_called_once_with("cao-test", "workflow-123")
    
    @patch("cli_agent_orchestrator.services.session_service.tmux_client")
    def test_assign_workflow_session_not_found(self, mock_tmux):
        """Test error when session doesn't exist."""
        mock_tmux.session_exists.return_value = False
        
        with pytest.raises(ValueError, match="not found"):
            session_service.assign_workflow_to_session("nonexistent", "workflow-123")


class TestGetSessionWorkflow:
    """Test get_session_workflow function."""
    
    @patch("cli_agent_orchestrator.services.session_service.db_get_session_workflow")
    def test_get_session_workflow_found(self, mock_db_get):
        """Test successful workflow retrieval."""
        mock_db_get.return_value = "workflow-123"
        
        result = session_service.get_session_workflow("cao-test")
        
        assert result == "workflow-123"
    
    @patch("cli_agent_orchestrator.services.session_service.db_get_session_workflow")
    def test_get_session_workflow_not_found(self, mock_db_get):
        """Test when no workflow assigned."""
        mock_db_get.return_value = None
        
        result = session_service.get_session_workflow("cao-test")
        
        assert result is None
