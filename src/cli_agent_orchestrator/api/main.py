"""Single FastAPI entry point for all HTTP routes."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated, Dict, List, Optional
from importlib import resources
from pathlib import Path
import requests
import aiofiles
import json

from fastapi import FastAPI, HTTPException, Path as PathParam, Query, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, field_validator
from watchdog.observers.polling import PollingObserver

from cli_agent_orchestrator.clients.database import (
    create_inbox_message,
    get_inbox_messages,
    init_db,
    get_terminal_metadata,
)
from cli_agent_orchestrator.clients.tmux import tmux_client
from cli_agent_orchestrator.constants import (
    AGENT_CONTEXT_DIR,
    INBOX_POLLING_INTERVAL,
    KIRO_AGENTS_DIR,
    LOCAL_AGENT_STORE_DIR,
    Q_AGENTS_DIR,
    SERVER_HOST,
    SERVER_PORT,
    SERVER_VERSION,
    TERMINAL_LOG_DIR,
)
from cli_agent_orchestrator.models.kiro_agent import KiroAgentConfig
from cli_agent_orchestrator.models.provider import ProviderType
from cli_agent_orchestrator.models.q_agent import QAgentConfig
from cli_agent_orchestrator.utils.agent_profiles import load_agent_profile, list_installed_agents

from cli_agent_orchestrator.models.inbox import MessageStatus
from cli_agent_orchestrator.models.terminal import Terminal, TerminalId
from cli_agent_orchestrator.providers.manager import provider_manager
from cli_agent_orchestrator.services import (
    flow_service,
    inbox_service,
    session_service,
    terminal_service,
)
from cli_agent_orchestrator.services.cleanup_service import cleanup_old_data
from cli_agent_orchestrator.services.inbox_service import LogFileHandler
from cli_agent_orchestrator.services.terminal_service import OutputMode
from cli_agent_orchestrator.utils.logging import setup_logging
from cli_agent_orchestrator.utils.terminal import generate_session_name

logger = logging.getLogger(__name__)


async def flow_daemon():
    """Background task to check and execute flows."""
    logger.info("Flow daemon started")
    while True:
        try:
            flows = flow_service.get_flows_to_run()
            for flow in flows:
                try:
                    executed = flow_service.execute_flow(flow.name)
                    if executed:
                        logger.info(f"Flow '{flow.name}' executed successfully")
                    else:
                        logger.info(f"Flow '{flow.name}' skipped (execute=false)")
                except Exception as e:
                    logger.error(f"Flow '{flow.name}' failed: {e}")
        except Exception as e:
            logger.error(f"Flow daemon error: {e}")

        await asyncio.sleep(60)


# Response Models
class TerminalOutputResponse(BaseModel):
    output: str
    mode: str


class InstallAgentRequest(BaseModel):
    source_type: str = Field(..., description="Source type: 'built-in', 'file', or 'url'")
    name: Optional[str] = Field(None, description="Agent name (for built-in)")
    path: Optional[str] = Field(None, description="File path or URL")
    provider: str = Field(..., description="Provider to install for")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting CLI Agent Orchestrator server...")
    setup_logging()
    init_db()

    # Run cleanup in background
    asyncio.create_task(asyncio.to_thread(cleanup_old_data))

    # Start flow daemon as background task
    daemon_task = asyncio.create_task(flow_daemon())

    # Start inbox watcher
    inbox_observer = PollingObserver(timeout=INBOX_POLLING_INTERVAL)
    inbox_observer.schedule(LogFileHandler(), str(TERMINAL_LOG_DIR), recursive=False)
    inbox_observer.start()
    logger.info("Inbox watcher started (PollingObserver)")

    yield

    # Stop inbox observer
    inbox_observer.stop()
    inbox_observer.join()
    logger.info("Inbox watcher stopped")

    # Cancel daemon on shutdown
    daemon_task.cancel()
    try:
        await daemon_task
    except asyncio.CancelledError:
        pass

    logger.info("Shutting down CLI Agent Orchestrator server...")


app = FastAPI(
    title="CLI Agent Orchestrator",
    description="Simplified CLI Agent Orchestrator API",
    version=SERVER_VERSION,
    lifespan=lifespan,
)


@app.get("/agents")
async def list_agents() -> List[str]:
    """List all available agent profiles."""
    try:
        return list_installed_agents()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list agents: {str(e)}",
        )


@app.post("/agents/install")
async def install_agent(request: InstallAgentRequest) -> Dict:
    """Install an agent."""
    try:
        agent_name = request.name
        
        # Handle different source types
        if request.source_type == "url":
            if not request.path:
                raise ValueError("Path (URL) is required for url source")
            
            LOCAL_AGENT_STORE_DIR.mkdir(parents=True, exist_ok=True)
            response = requests.get(request.path)
            response.raise_for_status()
            content = response.text
            
            filename = Path(request.path).name
            if not filename.endswith(".md"):
                raise ValueError("URL must point to a .md file")
                
            dest_file = LOCAL_AGENT_STORE_DIR / filename
            dest_file.write_text(content)
            agent_name = dest_file.stem
            
        elif request.source_type == "file":
            if not request.path:
                raise ValueError("Path is required for file source")
                
            source_path = Path(request.path)
            if not source_path.exists():
                raise FileNotFoundError(f"Source file not found: {request.path}")
            if not source_path.suffix == ".md":
                raise ValueError("File must be a .md file")
                
            LOCAL_AGENT_STORE_DIR.mkdir(parents=True, exist_ok=True)
            dest_file = LOCAL_AGENT_STORE_DIR / source_path.name
            dest_file.write_text(source_path.read_text())
            agent_name = dest_file.stem
            
        elif request.source_type == "built-in":
            if not request.name:
                raise ValueError("Name is required for built-in source")
            agent_name = request.name
            
        else:
            raise ValueError(f"Invalid source type: {request.source_type}")

        # Load agent profile
        try:
            profile = load_agent_profile(agent_name)
        except Exception as e:
            raise ValueError(f"Failed to load agent profile '{agent_name}': {e}")

        # Ensure directories exist
        AGENT_CONTEXT_DIR.mkdir(parents=True, exist_ok=True)

        # Determine source for context file
        local_profile = LOCAL_AGENT_STORE_DIR / f"{agent_name}.md"
        if local_profile.exists():
            source_file = local_profile
        else:
            agent_store = resources.files("cli_agent_orchestrator.agent_store")
            source_file = agent_store / f"{agent_name}.md"
            if not source_file.is_file(): # Check if built-in exists
                 raise FileNotFoundError(f"Built-in agent '{agent_name}' not found")

        # Copy markdown file to agent-context directory
        dest_file = AGENT_CONTEXT_DIR / f"{profile.name}.md"
        with open(source_file, "r") as src:
            dest_file.write_text(src.read())

        # Build allowedTools
        allowed_tools = profile.allowedTools
        if allowed_tools is None:
            allowed_tools = ["@builtin", "fs_*", "execute_bash"]
            if profile.mcpServers:
                for server_name in profile.mcpServers.keys():
                    allowed_tools.append(f"@{server_name}")

        # Create agent config based on provider
        agent_file = None
        if request.provider == ProviderType.Q_CLI.value:
            Q_AGENTS_DIR.mkdir(parents=True, exist_ok=True)
            agent_config = QAgentConfig(
                name=profile.name,
                description=profile.description,
                tools=profile.tools if profile.tools is not None else ["*"],
                allowedTools=allowed_tools,
                resources=[f"file://{dest_file.absolute()}"],
                prompt=profile.prompt,
                mcpServers=profile.mcpServers,
                toolAliases=profile.toolAliases,
                toolsSettings=profile.toolsSettings,
                hooks=profile.hooks,
                model=profile.model,
            )
            safe_filename = profile.name.replace("/", "__")
            agent_file = Q_AGENTS_DIR / f"{safe_filename}.json"
            with open(agent_file, "w") as f:
                f.write(agent_config.model_dump_json(indent=2, exclude_none=True))

        elif request.provider == ProviderType.KIRO_CLI.value:
            KIRO_AGENTS_DIR.mkdir(parents=True, exist_ok=True)
            agent_config = KiroAgentConfig(
                name=profile.name,
                description=profile.description,
                tools=profile.tools if profile.tools is not None else ["*"],
                allowedTools=allowed_tools,
                resources=[f"file://{dest_file.absolute()}"],
                prompt=profile.prompt,
                mcpServers=profile.mcpServers,
                toolAliases=profile.toolAliases,
                toolsSettings=profile.toolsSettings,
                hooks=profile.hooks,
                model=profile.model,
            )
            safe_filename = profile.name.replace("/", "__")
            agent_file = KIRO_AGENTS_DIR / f"{safe_filename}.json"
            with open(agent_file, "w") as f:
                f.write(agent_config.model_dump_json(indent=2, exclude_none=True))

        return {
            "success": True,
            "agent_name": profile.name,
            "provider": request.provider,
            "file": str(agent_file) if agent_file else None
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Install failed: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "cli-agent-orchestrator"}


@app.post("/sessions", response_model=Terminal, status_code=status.HTTP_201_CREATED)
async def create_session(
    provider: str, agent_profile: str, session_name: Optional[str] = None
) -> Terminal:
    """Create a new session with exactly one terminal."""
    try:
        result = terminal_service.create_terminal(
            provider=provider,
            agent_profile=agent_profile,
            session_name=session_name,
            new_session=True,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}",
        )


@app.get("/sessions")
async def list_sessions() -> List[Dict]:
    try:
        return session_service.list_sessions()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list sessions: {str(e)}",
        )


@app.get("/sessions/{session_name}")
async def get_session(session_name: str) -> Dict:
    try:
        return session_service.get_session(session_name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get session: {str(e)}",
        )


@app.delete("/sessions/{session_name}")
async def delete_session(session_name: str) -> Dict:
    try:
        success = session_service.delete_session(session_name)
        return {"success": success}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}",
        )


@app.post(
    "/sessions/{session_name}/terminals",
    response_model=Terminal,
    status_code=status.HTTP_201_CREATED,
)
async def create_terminal_in_session(
    session_name: str, provider: str, agent_profile: str
) -> Terminal:
    """Create additional terminal in existing session."""
    try:
        result = terminal_service.create_terminal(
            provider=provider,
            agent_profile=agent_profile,
            session_name=session_name,
            new_session=False,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create terminal: {str(e)}",
        )


@app.get("/sessions/{session_name}/terminals")
async def list_terminals_in_session(session_name: str) -> List[Dict]:
    """List all terminals in a session."""
    try:
        from cli_agent_orchestrator.clients.database import list_terminals_by_session

        return list_terminals_by_session(session_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list terminals: {str(e)}",
        )


@app.get("/terminals/{terminal_id}", response_model=Terminal)
async def get_terminal(terminal_id: TerminalId) -> Terminal:
    try:
        terminal = terminal_service.get_terminal(terminal_id)
        return Terminal(**terminal)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get terminal: {str(e)}",
        )


@app.post("/terminals/{terminal_id}/input")
async def send_terminal_input(terminal_id: TerminalId, message: str) -> Dict:
    try:
        success = terminal_service.send_input(terminal_id, message)
        return {"success": success}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send input: {str(e)}",
        )


@app.get("/terminals/{terminal_id}/output", response_model=TerminalOutputResponse)
async def get_terminal_output(
    terminal_id: TerminalId, mode: OutputMode = OutputMode.FULL
) -> TerminalOutputResponse:
    try:
        output = terminal_service.get_output(terminal_id, mode)
        return TerminalOutputResponse(output=output, mode=mode)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get output: {str(e)}",
        )


@app.post("/terminals/{terminal_id}/exit")
async def exit_terminal(terminal_id: TerminalId) -> Dict:
    """Send provider-specific exit command to terminal."""
    try:
        provider = provider_manager.get_provider(terminal_id)
        if provider is None:
            raise ValueError(f"Provider not found for terminal {terminal_id}")
        exit_command = provider.exit_cli()
        terminal_service.send_input(terminal_id, exit_command)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to exit terminal: {str(e)}",
        )


@app.delete("/terminals/{terminal_id}")
async def delete_terminal(terminal_id: TerminalId) -> Dict:
    """Delete a terminal."""
    try:
        success = terminal_service.delete_terminal(terminal_id)
        return {"success": success}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete terminal: {str(e)}",
        )


@app.websocket("/terminals/{terminal_id}/ws")
async def websocket_endpoint(websocket: WebSocket, terminal_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connected: {terminal_id}")
    
    # Get terminal metadata to find log file and tmux info
    try:
        metadata = get_terminal_metadata(terminal_id)
        if not metadata:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        log_path = TERMINAL_LOG_DIR / f"{terminal_id}.log"
        session_name = metadata["tmux_session"]
        window_name = metadata["tmux_window"]
        
    except Exception as e:
        logger.error(f"WebSocket setup failed: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

import subprocess
import pty

# ... imports ...

@app.websocket("/terminals/{terminal_id}/ws")
async def websocket_endpoint(websocket: WebSocket, terminal_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connected: {terminal_id}")
    
    try:
        metadata = get_terminal_metadata(terminal_id)
        if not metadata:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        session_name = metadata["tmux_session"]
        window_name = metadata["tmux_window"]
        
    except Exception as e:
        logger.error(f"WebSocket setup failed: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    # Direct Tmux Attach via PTY
    # This bypasses file I/O and buffering completely.
    master_fd, slave_fd = pty.openpty()
    
    # Start tmux attach in read-only mode (-r)
    # We detach (-d)? No, we want to view.
    # We must ensure we attach to the specific window?
    # tmux attach -t session:window
    target = f"{session_name}:{window_name}"
    
    proc = subprocess.Popen(
        ['tmux', 'attach-session', '-t', target, '-r'],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        preexec_fn=os.setsid, # New session
        close_fds=True
    )
    os.close(slave_fd) # Close slave in parent

    # Helper to read from PTY master
    async def pty_reader():
        loop = asyncio.get_running_loop()
        try:
            while True:
                # Blocking read in executor to avoid blocking event loop
                data = await loop.run_in_executor(None, os.read, master_fd, 4096)
                if not data:
                    break
                await websocket.send_text(data.decode('utf-8', errors='ignore'))
        except OSError:
            pass # PTY closed
        except Exception as e:
            logger.error(f"PTY reader error: {e}")
        finally:
            # If PTY closes, kill process
            if proc.poll() is None:
                proc.terminate()

    reader_task = asyncio.create_task(pty_reader())

    # Try to open direct PTY for input (still the fastest way)
    tty_fd = None
    try:
        pane_tty = tmux_client.get_pane_tty(session_name, window_name)
        if pane_tty:
            tty_fd = os.open(pane_tty, os.O_WRONLY)
            logger.info(f"Opened direct input PTY: {pane_tty}")
    except Exception as e:
        logger.error(f"Failed to open input PTY: {e}")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if isinstance(message, dict) and "type" in message:
                    if message["type"] == "input":
                        if tty_fd:
                            try:
                                os.write(tty_fd, message["data"].encode())
                            except Exception:
                                tmux_client.send_keys(session_name, window_name, message["data"], enter=False)
                        else:
                            tmux_client.send_keys(session_name, window_name, message["data"], enter=False)
                    elif message["type"] == "resize":
                        cols = message.get("cols")
                        rows = message.get("rows")
                        if cols and rows:
                            # Resize both the tmux window AND our pty wrapper
                            tmux_client.resize_window(session_name, window_name, int(cols), int(rows))
                            try:
                                # Also resize our attach PTY to match
                                import termios
                                import struct
                                import fcntl
                                winsize = struct.pack("HHHH", int(rows), int(cols), 0, 0)
                                fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                            except Exception as e:
                                logger.error(f"Failed to resize attach PTY: {e}")

                else:
                    if tty_fd:
                        os.write(tty_fd, data.encode())
                    else:
                        tmux_client.send_keys(session_name, window_name, data, enter=False)
            except json.JSONDecodeError:
                if tty_fd:
                    os.write(tty_fd, data.encode())
                else:
                    tmux_client.send_keys(session_name, window_name, data, enter=False)
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected")
    finally:
        reader_task.cancel()
        if tty_fd:
            try: os.close(tty_fd)
            except: pass
        try: os.close(master_fd)
        except: pass
        if proc.poll() is None:
            proc.terminate()
        try: await reader_task
        except: pass


@app.post("/terminals/{receiver_id}/inbox/messages")
async def create_inbox_message_endpoint(
    receiver_id: TerminalId, sender_id: str, message: str
) -> Dict:
    """Create inbox message and attempt immediate delivery."""
    try:
        inbox_msg = create_inbox_message(sender_id, receiver_id, message)
        inbox_service.check_and_send_pending_messages(receiver_id)

        return {
            "success": True,
            "message_id": inbox_msg.id,
            "sender_id": inbox_msg.sender_id,
            "receiver_id": inbox_msg.receiver_id,
            "created_at": inbox_msg.created_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create inbox message: {str(e)}",
        )


@app.get("/terminals/{terminal_id}/inbox/messages")
async def get_inbox_messages_endpoint(
    terminal_id: TerminalId,
    limit: int = Query(default=10, le=100, description="Maximum number of messages to retrieve"),
    status: Optional[str] = Query(default=None, description="Filter by message status"),
) -> List[Dict]:
    """Get inbox messages for a terminal.

    Args:
        terminal_id: Terminal ID to get messages for
        limit: Maximum number of messages to return (default: 10, max: 100)
        status: Optional filter by message status ('pending', 'delivered', 'failed')

    Returns:
        List of inbox messages with sender_id, message, created_at, status
    """
    try:
        # Convert status filter if provided
        status_filter = None
        if status:
            try:
                status_filter = MessageStatus(status)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {status}. Valid values: pending, delivered, failed",
                )

        # Get messages using existing database function
        messages = get_inbox_messages(terminal_id, limit=limit, status=status_filter)

        # Convert to response format
        result = []
        for msg in messages:
            result.append(
                {
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "receiver_id": msg.receiver_id,
                    "message": msg.message,
                    "status": msg.status.value,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                }
            )

        return result

    except HTTPException:
        # Re-raise HTTPException (validation errors)
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve inbox messages: {str(e)}",
        )


def main():
    """Entry point for cao-server command."""
    import uvicorn

    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)


if __name__ == "__main__":
    main()
