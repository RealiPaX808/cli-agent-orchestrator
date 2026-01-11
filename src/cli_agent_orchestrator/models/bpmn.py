"""BPMN 2.0 workflow models and types."""

import logging
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ============================================================================
# BPMN Element Types (BPMN 2.0 Standard)
# ============================================================================


class BPMNElementType(str, Enum):
    """BPMN 2.0 element types."""

    # Events
    START_EVENT = "startEvent"
    END_EVENT = "endEvent"
    INTERMEDIATE_THROW_EVENT = "intermediateThrowEvent"
    INTERMEDIATE_CATCH_EVENT = "intermediateCatchEvent"

    # Tasks
    SERVICE_TASK = "serviceTask"  # Agent CLI execution
    SCRIPT_TASK = "scriptTask"  # Expression evaluation
    USER_TASK = "userTask"  # Human approval
    MANUAL_TASK = "manualTask"  # Manual action (no automation)

    # Gateways
    EXCLUSIVE_GATEWAY = "exclusiveGateway"  # XOR - Choose ONE path
    PARALLEL_GATEWAY = "parallelGateway"  # AND - ALL paths
    INCLUSIVE_GATEWAY = "inclusiveGateway"  # OR - ONE+ paths
    EVENT_BASED_GATEWAY = "eventBasedGateway"  # Wait for events

    # Other
    SEQUENCE_FLOW = "sequenceFlow"  # Connection between elements


class GatewayDirection(str, Enum):
    """Gateway direction (BPMN 2.0)."""

    DIVERGING = "Diverging"  # Split: One incoming, multiple outgoing
    CONVERGING = "Converging"  # Join: Multiple incoming, one outgoing
    MIXED = "Mixed"  # Both split and join


class TokenState(str, Enum):
    """Token execution state."""

    ACTIVE = "active"  # Token is being processed
    WAITING = "waiting"  # Token is waiting (e.g., at gateway join)
    COMPLETED = "completed"  # Token reached end event
    FAILED = "failed"  # Token execution failed


# ============================================================================
# BPMN Elements
# ============================================================================


@dataclass
class BPMNElement:
    """Base BPMN element."""

    id: str
    type: BPMNElementType
    name: Optional[str] = None
    documentation: Optional[str] = None


@dataclass
class BPMNEvent(BPMNElement):
    """BPMN Event (Start/End/Intermediate)."""

    pass


@dataclass
class BPMNTask(BPMNElement):
    """BPMN Task."""

    # Input/Output mappings
    input_mappings: Dict[str, str] = field(default_factory=dict)
    output_mappings: Dict[str, str] = field(default_factory=dict)


@dataclass
class ServiceTask(BPMNTask):
    """Service Task - Agent CLI execution."""

    agent_profile: str = ""
    provider: str = "q_cli"
    task_template: str = ""  # Template with {{variables}}
    system_prompt: Optional[str] = None
    timeout: int = 600
    wait_for_completion: bool = True


@dataclass
class ScriptTask(BPMNTask):
    """Script Task - Expression evaluation."""

    script_format: str = "javascript"  # javascript, python, jinja2
    script: str = ""  # Expression to evaluate


@dataclass
class UserTask(BPMNTask):
    """User Task - Human approval."""

    assignee: Optional[str] = None
    candidate_users: List[str] = field(default_factory=list)


@dataclass
class BPMNGateway(BPMNElement):
    """BPMN Gateway."""

    direction: GatewayDirection = GatewayDirection.DIVERGING
    default_flow: Optional[str] = None  # Default sequence flow (for XOR)


@dataclass
class ExclusiveGateway(BPMNGateway):
    """Exclusive Gateway (XOR) - Choose ONE outgoing path based on conditions."""

    pass


@dataclass
class ParallelGateway(BPMNGateway):
    """Parallel Gateway (AND) - ALL outgoing paths execute in parallel."""

    pass


@dataclass
class InclusiveGateway(BPMNGateway):
    """Inclusive Gateway (OR) - ONE+ outgoing paths based on conditions."""

    pass


@dataclass
class SequenceFlow:
    """Sequence Flow - Connection between BPMN elements."""

    id: str
    source_ref: str  # Source element ID
    target_ref: str  # Target element ID
    name: Optional[str] = None
    condition_expression: Optional[str] = None  # Conditional flow


# ============================================================================
# BPMN Process
# ============================================================================


@dataclass
class BPMNProcess:
    """BPMN Process definition."""

    id: str
    name: str
    description: Optional[str] = None
    elements: Dict[str, BPMNElement] = field(default_factory=dict)
    sequence_flows: Dict[str, SequenceFlow] = field(default_factory=dict)
    process_variables: Dict[str, Any] = field(default_factory=dict)

    def get_element(self, element_id: str) -> Optional[BPMNElement]:
        """Get element by ID."""
        return self.elements.get(element_id)

    def get_sequence_flow(self, flow_id: str) -> Optional[SequenceFlow]:
        """Get sequence flow by ID."""
        return self.sequence_flows.get(flow_id)

    def get_outgoing_flows(self, element_id: str) -> List[SequenceFlow]:
        """Get all outgoing sequence flows from an element."""
        return [
            flow
            for flow in self.sequence_flows.values()
            if flow.source_ref == element_id
        ]

    def get_incoming_flows(self, element_id: str) -> List[SequenceFlow]:
        """Get all incoming sequence flows to an element."""
        return [
            flow
            for flow in self.sequence_flows.values()
            if flow.target_ref == element_id
        ]

    def get_start_events(self) -> List[BPMNEvent]:
        """Get all start events."""
        return [
            elem
            for elem in self.elements.values()
            if isinstance(elem, BPMNEvent) and elem.type == BPMNElementType.START_EVENT
        ]

    def get_end_events(self) -> List[BPMNEvent]:
        """Get all end events."""
        return [
            elem
            for elem in self.elements.values()
            if isinstance(elem, BPMNEvent) and elem.type == BPMNElementType.END_EVENT
        ]


# ============================================================================
# Token-based Execution
# ============================================================================


@dataclass
class Token:
    """Execution token (BPMN token semantics)."""

    id: str
    current_element_id: str
    state: TokenState = TokenState.ACTIVE
    data: Dict[str, Any] = field(default_factory=dict)  # Token payload
    parent_token_id: Optional[str] = None  # For parallel splits
    error: Optional[str] = None


@dataclass
class ProcessInstance:
    """BPMN process instance (runtime execution)."""

    instance_id: str
    process_id: str
    session_name: str
    tokens: Dict[str, Token] = field(default_factory=dict)
    element_states: Dict[str, str] = field(default_factory=dict)  # {element_id: status}
    terminal_mappings: Dict[str, str] = field(
        default_factory=dict
    )  # {element_id: terminal_id}
    variables: Dict[str, Any] = field(default_factory=dict)  # Process variables

    def add_token(self, token: Token) -> None:
        """Add a token to the process instance."""
        self.tokens[token.id] = token

    def get_active_tokens(self) -> List[Token]:
        """Get all active tokens."""
        return [t for t in self.tokens.values() if t.state == TokenState.ACTIVE]

    def get_tokens_at_element(self, element_id: str) -> List[Token]:
        """Get all tokens currently at a specific element."""
        return [t for t in self.tokens.values() if t.current_element_id == element_id]
