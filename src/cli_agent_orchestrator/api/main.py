"""Single FastAPI entry point for all HTTP routes."""

import asyncio
import fcntl
import json
import logging
import os
import pty
import select
import struct
import subprocess
import termios
from contextlib import asynccontextmanager
from importlib import resources
from pathlib import Path
from typing import Annotated, Dict, List, Optional

import aiofiles
import requests

from fastapi import (
    FastAPI,
    HTTPException,
    Path as PathParam,
    Query,
    status,
    WebSocket,
    WebSocketDisconnect,
)
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
    SESSION_PREFIX,
    TERMINAL_LOG_DIR,
)
from cli_agent_orchestrator.models.kiro_agent import KiroAgentConfig
from cli_agent_orchestrator.models.provider import ProviderType
from cli_agent_orchestrator.models.q_agent import QAgentConfig
from cli_agent_orchestrator.utils.agent_profiles import (
    load_agent_profile,
    list_installed_agents,
)

from cli_agent_orchestrator.models.inbox import MessageStatus
from cli_agent_orchestrator.models.terminal import Terminal, TerminalId, TerminalStatus
from cli_agent_orchestrator.providers.manager import provider_manager
from cli_agent_orchestrator.services import (
    flow_service,
    inbox_service,
    session_service,
    terminal_service,
    workflow_execution_service,
)
from cli_agent_orchestrator.services.cleanup_service import cleanup_old_data
from cli_agent_orchestrator.services.inbox_service import LogFileHandler
from cli_agent_orchestrator.services.terminal_service import OutputMode
from cli_agent_orchestrator.utils.logging import setup_logging
from cli_agent_orchestrator.utils.terminal import generate_session_name

logger = logging.getLogger(__name__)


class WebhookExecuteRequest(BaseModel):
    webhookUrl: str = Field(..., description="The webhook URL to send the request to")
    method: str = Field(
        default="POST", description="HTTP method (GET, POST, PUT, DELETE)"
    )
    payload: str = Field(..., description="Text payload to send to the webhook")
    headers: Optional[Dict[str, str]] = Field(
        default=None, description="Optional HTTP headers"
    )

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        allowed_methods = ["GET", "POST", "PUT", "DELETE"]
        if v.upper() not in allowed_methods:
            raise ValueError(f"Method must be one of {allowed_methods}")
        return v.upper()


class WebhookExecuteResponse(BaseModel):
    status_code: int
    response_body: str
    success: bool


class PromptOptimizeRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to optimize")
    webhook_url: str = Field(
        ..., description="The n8n webhook URL to use for optimization"
    )


class PromptOptimizeResponse(BaseModel):
    optimized_prompt: str
    original_prompt: str


class PromptSubmitRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to submit to the session")


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
    source_type: str = Field(
        ..., description="Source type: 'built-in', 'file', 'url', or 'content'"
    )
    name: Optional[str] = Field(None, description="Agent name (for built-in)")
    path: Optional[str] = Field(None, description="File path or URL")
    content: Optional[str] = Field(
        None, description="Markdown content (for content type)"
    )
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


@app.get("/agents/{agent_name}/content")
async def get_agent_content(agent_name: str) -> Dict[str, str]:
    try:
        local_profile = LOCAL_AGENT_STORE_DIR / f"{agent_name}.md"
        if local_profile.exists():
            return {"content": local_profile.read_text()}

        agent_store = resources.files("cli_agent_orchestrator.agent_store")
        profile_file = agent_store / f"{agent_name}.md"

        if not profile_file.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent '{agent_name}' not found",
            )

        return {"content": profile_file.read_text()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get agent content: {str(e)}",
        )


@app.get("/providers")
async def list_providers() -> List[Dict[str, str]]:
    """List all available providers."""
    try:
        return [
            {"value": provider.value, "label": provider.name.replace("_", " ").title()}
            for provider in ProviderType
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list providers: {str(e)}",
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

        elif request.source_type == "content":
            if not request.content:
                raise ValueError("Content is required for content source")
            if not request.name:
                raise ValueError("Name is required for content source")

            LOCAL_AGENT_STORE_DIR.mkdir(parents=True, exist_ok=True)
            dest_file = LOCAL_AGENT_STORE_DIR / f"{request.name}.md"
            dest_file.write_text(request.content)
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
            if not source_file.is_file():  # Check if built-in exists
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
            "file": str(agent_file) if agent_file else None,
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Install failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "cli-agent-orchestrator"}


@app.post("/sessions", response_model=Terminal, status_code=status.HTTP_201_CREATED)
async def create_session(
    provider: str,
    agent_profile: str,
    session_name: Optional[str] = None,
    workflow_id: Optional[str] = None,
) -> Terminal:
    """Create a new session with exactly one terminal. If workflow_id is provided, create empty session without terminal."""
    try:
        if workflow_id:
            if session_name:
                session_name_to_use = (
                    session_name
                    if session_name.startswith(SESSION_PREFIX)
                    else f"{SESSION_PREFIX}{session_name}"
                )
            else:
                session_name_to_use = generate_session_name()
            if not tmux_client.session_exists(session_name_to_use):
                tmux_client.create_session(
                    session_name=session_name_to_use,
                    window_name="workflow-init",
                    terminal_id="workflow-placeholder",
                )
            session_service.assign_workflow_to_session(session_name_to_use, workflow_id)
            return Terminal(
                id="workflow-placeholder",
                name="workflow-init",
                session_name=session_name_to_use,
                provider=ProviderType.CLAUDE_CODE,
                agent_profile="workflow",
                status=TerminalStatus.IDLE,
            )
        else:
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
    """Clean PTY-Bridge WebSocket endpoint for xterm.js.

    Architecture:
    - Creates own PTY (master/slave) for isolation
    - Spawns 'tmux attach' in the slave PTY
    - Input: WebSocket → write to PTY master
    - Output: read from PTY master → WebSocket
    - No file polling, 0ms latency
    """
    await websocket.accept()
    logger.info(f"WebSocket connected: {terminal_id}")

    # Get terminal metadata
    try:
        metadata = get_terminal_metadata(terminal_id)
        if not metadata:
            logger.error(f"Terminal {terminal_id} not found")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        session_name = metadata["tmux_session"]
        window_name = metadata["tmux_window"]

    except Exception as e:
        logger.error(f"WebSocket setup failed: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    # Create PTY for tmux attach subprocess
    master_fd, slave_fd = pty.openpty()

    # Start tmux attach (WITHOUT -r flag, we need full interaction)
    target = f"{session_name}:{window_name}"
    proc = subprocess.Popen(
        ["tmux", "attach-session", "-t", target],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        preexec_fn=os.setsid,  # New session for clean process management
        close_fds=True,
    )
    os.close(slave_fd)  # Close slave in parent
    logger.info(f"PTY created for {target}, master_fd={master_fd}, pid={proc.pid}")

    # Make master_fd non-blocking for asyncio compatibility
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    # Output reader: PTY Master → WebSocket
    async def pty_to_websocket():
        loop = asyncio.get_running_loop()
        try:
            while True:
                try:
                    # Use select in executor for non-blocking read
                    readable, _, _ = await loop.run_in_executor(
                        None, select.select, [master_fd], [], [], 0.1
                    )

                    if not readable:
                        # Check if process died
                        if proc.poll() is not None:
                            logger.info(
                                f"PTY process exited with code {proc.returncode}"
                            )
                            break
                        continue

                    # Read available data
                    data = os.read(master_fd, 4096)
                    if not data:
                        logger.info("PTY closed (EOF)")
                        break

                    # Send to WebSocket
                    await websocket.send_text(data.decode("utf-8", errors="replace"))

                except OSError as e:
                    logger.error(f"PTY read error: {e}")
                    break
                except Exception as e:
                    logger.error(f"Unexpected error in PTY reader: {e}")
                    break
        finally:
            logger.info("PTY reader shutting down")
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()

    reader_task = asyncio.create_task(pty_to_websocket())

    # Input handler: WebSocket → PTY Master
    try:
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)

                if isinstance(message, dict) and "type" in message:
                    if message["type"] == "input":
                        # Write input to PTY master
                        input_data = message["data"].encode("utf-8")
                        os.write(master_fd, input_data)

                    elif message["type"] == "resize":
                        cols = int(message.get("cols", 80))
                        rows = int(message.get("rows", 24))

                        winsize = struct.pack("HHHH", rows, cols, 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

                        try:
                            subprocess.run(
                                [
                                    "tmux",
                                    "refresh-client",
                                    "-t",
                                    f"{session_name}:{window_name}",
                                ],
                                check=False,
                                timeout=1,
                            )

                            await asyncio.sleep(0.05)

                            tmux_client.resize_window(
                                session_name, window_name, cols, rows
                            )
                            logger.info(f"Resized PTY and tmux window to {cols}x{rows}")
                        except Exception as e:
                            logger.error(f"Failed to resize tmux window: {e}")
                            logger.info(
                                f"PTY resized to {cols}x{rows} (tmux resize failed)"
                            )
                else:
                    # Fallback: treat as raw input
                    os.write(master_fd, data.encode("utf-8"))

            except json.JSONDecodeError:
                # Not JSON, treat as raw input
                os.write(master_fd, data.encode("utf-8"))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {terminal_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Cleanup
        logger.info("Cleaning up PTY resources")
        reader_task.cancel()

        try:
            os.close(master_fd)
        except:
            pass

        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()

        try:
            await reader_task
        except asyncio.CancelledError:
            pass


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
    limit: int = Query(
        default=10, le=100, description="Maximum number of messages to retrieve"
    ),
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
                    "created_at": msg.created_at.isoformat()
                    if msg.created_at
                    else None,
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


@app.post("/webhooks/execute", response_model=WebhookExecuteResponse)
async def execute_webhook(request: WebhookExecuteRequest) -> WebhookExecuteResponse:
    """Execute a webhook request with the provided configuration.

    Args:
        request: Webhook configuration including URL, method, payload, and headers

    Returns:
        WebhookExecuteResponse with status code, response body, and success flag

    Raises:
        HTTPException: If webhook execution fails
    """
    try:
        headers = request.headers or {}
        headers.setdefault("Content-Type", "text/plain")

        response = requests.request(
            method=request.method,
            url=request.webhookUrl,
            data=request.payload,
            headers=headers,
            timeout=30,
        )

        return WebhookExecuteResponse(
            status_code=response.status_code,
            response_body=response.text,
            success=200 <= response.status_code < 300,
        )

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Webhook request timed out after 30 seconds",
        )
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to connect to webhook URL",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Webhook execution failed: {str(e)}",
        )


@app.post("/prompt/optimize", response_model=PromptOptimizeResponse)
async def optimize_prompt(request: PromptOptimizeRequest) -> PromptOptimizeResponse:
    """Optimize a prompt using n8n webhook.

    Args:
        request: Prompt optimization request with webhook_url

    Returns:
        PromptOptimizeResponse with optimized and original prompts
    """
    try:
        payload = {"prompt": request.prompt}

        response = requests.post(
            request.webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if not response.ok:
            error_detail = f"Webhook returned status {response.status_code}"
            try:
                error_body = response.json()
                if "message" in error_body:
                    error_detail = error_body["message"]
                if "hint" in error_body:
                    error_detail += f" - {error_body['hint']}"
            except Exception:
                error_detail += f" - {response.text[:200]}"

            raise Exception(error_detail)

        try:
            result = response.json()
        except ValueError as e:
            raise Exception(
                f"Webhook returned invalid JSON. Response: {response.text[:200]}"
            )

        if isinstance(result, list) and len(result) > 0:
            result = result[0]

        optimized_prompt = result.get("optimized_prompt")
        if not optimized_prompt:
            if "body" in result and "prompt" in result.get("body", {}):
                optimized_prompt = result["body"]["prompt"]
            else:
                optimized_prompt = request.prompt

        return PromptOptimizeResponse(
            optimized_prompt=optimized_prompt, original_prompt=request.prompt
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Prompt optimization timed out after 30 seconds",
        )
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to connect to n8n webhook. Is n8n running?",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize prompt: {str(e)}",
        )


@app.post("/sessions/{session_name}/prompt")
async def submit_session_prompt(
    session_name: str, request: PromptSubmitRequest
) -> Dict:
    """Submit a prompt to a session for execution.

    Args:
        session_name: Name of the session
        request: Prompt submission request

    Returns:
        Success message with session info
    """
    try:
        session = session_service.get_session(session_name)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_name}' not found",
            )

        logger.info(
            f"Prompt submitted to session '{session_name}': {request.prompt[:100]}..."
        )

        return {
            "success": True,
            "session_name": session_name,
            "message": "Prompt submitted successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit prompt: {str(e)}",
        )


class WorkflowAssignRequest(BaseModel):
    workflow_id: str = Field(..., description="Workflow ID to assign")
    workflow_data: dict = Field(..., description="Complete workflow definition")


@app.post("/sessions/{session_name}/workflow/assign")
async def assign_workflow_to_session(
    session_name: str, request: WorkflowAssignRequest
) -> Dict:
    try:
        if not tmux_client.session_exists(session_name):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_name}' not found",
            )

        state = workflow_execution_service.create_execution_state(
            session_name, request.workflow_id
        )

        return {
            "success": True,
            "session_name": session_name,
            "workflow_id": request.workflow_id,
            "execution_state": state.to_dict(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign workflow: {str(e)}",
        )


@app.get("/sessions/{session_name}/workflow/state")
async def get_workflow_execution_state(session_name: str) -> Dict:
    try:
        state = workflow_execution_service.get_execution_state(session_name)
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No workflow assigned to session '{session_name}'",
            )

        return state.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get execution state: {str(e)}",
        )


@app.post("/sessions/{session_name}/workflow/start")
async def start_workflow_execution(session_name: str, workflow_data: dict) -> Dict:
    try:
        state = workflow_execution_service.get_execution_state(session_name)
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No workflow assigned to session '{session_name}'",
            )

        state.status = workflow_execution_service.WorkflowExecutionStatus.RUNNING

        nodes_to_spawn = workflow_execution_service.get_nodes_requiring_agents(
            session_name, workflow_data
        )

        spawned_agents = []
        for node_info in nodes_to_spawn:
            result = terminal_service.create_terminal(
                provider=node_info["provider"],
                agent_profile=node_info["agent_profile"],
                session_name=session_name,
                new_session=False,
            )

            workflow_execution_service.update_node_state(
                session_name,
                node_info["node_id"],
                workflow_execution_service.NodeExecutionStatus.RUNNING,
                terminal_id=result.id,
            )

            spawned_agents.append(
                {
                    "node_id": node_info["node_id"],
                    "terminal_id": result.id,
                    "agent_profile": node_info["agent_profile"],
                }
            )

        return {
            "success": True,
            "status": state.status.value,
            "spawned_agents": spawned_agents,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start workflow: {str(e)}",
        )


def main():
    """Entry point for cao-server command."""
    import uvicorn

    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)


if __name__ == "__main__":
    main()
