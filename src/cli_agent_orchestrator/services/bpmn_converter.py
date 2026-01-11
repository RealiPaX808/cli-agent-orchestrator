"""Convert ReactFlow workflow JSON to BPMN Process models."""

import logging
from typing import Any, Dict

from cli_agent_orchestrator.models.bpmn import (
    BPMNElement,
    BPMNElementType,
    BPMNEvent,
    BPMNProcess,
    ExclusiveGateway,
    GatewayDirection,
    InclusiveGateway,
    ParallelGateway,
    ScriptTask,
    SequenceFlow,
    ServiceTask,
    UserTask,
)

logger = logging.getLogger(__name__)


class WorkflowConversionError(Exception):
    """Raised when workflow conversion fails."""

    pass


def convert_workflow_to_bpmn(workflow_data: Dict[str, Any]) -> BPMNProcess:
    """
    Convert ReactFlow workflow JSON to BPMN Process.

    Args:
        workflow_data: Workflow dictionary containing id, name, nodes, edges

    Returns:
        BPMNProcess instance

    Raises:
        WorkflowConversionError: If conversion fails
    """
    if not workflow_data.get("id"):
        raise WorkflowConversionError("Workflow must have an 'id' field")

    if not workflow_data.get("nodes"):
        raise WorkflowConversionError("Workflow must have at least one node")

    process = BPMNProcess(
        id=workflow_data["id"],
        name=workflow_data.get("name", "Unnamed Workflow"),
        description=workflow_data.get("description"),
        process_variables=workflow_data.get("variables", {}),
    )

    for node in workflow_data["nodes"]:
        try:
            element = _convert_node_to_element(node)
            process.elements[element.id] = element
        except Exception as e:
            logger.error(f"Failed to convert node {node.get('id')}: {e}")
            raise WorkflowConversionError(
                f"Failed to convert node {node.get('id')}: {e}"
            ) from e

    for edge in workflow_data.get("edges", []):
        try:
            flow = _convert_edge_to_flow(edge)
            process.sequence_flows[flow.id] = flow
        except Exception as e:
            logger.error(f"Failed to convert edge {edge.get('id')}: {e}")
            raise WorkflowConversionError(
                f"Failed to convert edge {edge.get('id')}: {e}"
            ) from e

    _validate_process(process)

    logger.info(
        f"Converted workflow '{process.name}' with {len(process.elements)} elements "
        f"and {len(process.sequence_flows)} flows"
    )

    return process


def _convert_node_to_element(node: Dict[str, Any]) -> BPMNElement:
    """Convert ReactFlow node to BPMN element."""
    node_id = node.get("id")
    if not node_id:
        raise ValueError("Node must have an 'id' field")

    data = node.get("data", {})
    node_type = data.get("type")
    config = data.get("config", {})
    label = data.get("label", "")

    if not node_type:
        raise ValueError(f"Node {node_id} must have a 'type' field in data")

    element_type = _normalize_element_type(node_type)

    if element_type in (BPMNElementType.START_EVENT, BPMNElementType.END_EVENT):
        return BPMNEvent(id=node_id, type=element_type, name=label)

    if element_type == BPMNElementType.SERVICE_TASK:
        return ServiceTask(
            id=node_id,
            type=element_type,
            name=label,
            agent_profile=config.get("agentProfile", ""),
            provider=config.get("provider", "q_cli"),
            task_template=config.get("taskTemplate", ""),
            system_prompt=config.get("systemPrompt"),
            timeout=config.get("timeout", 600),
            wait_for_completion=config.get("waitForCompletion", True),
        )

    if element_type == BPMNElementType.SCRIPT_TASK:
        return ScriptTask(
            id=node_id,
            type=element_type,
            name=label,
            script_format=config.get("scriptFormat", "javascript"),
            script=config.get("script", ""),
        )

    if element_type == BPMNElementType.USER_TASK:
        return UserTask(
            id=node_id,
            type=element_type,
            name=label,
            assignee=config.get("assignee"),
            candidate_users=config.get("candidateUsers", []),
        )

    if element_type == BPMNElementType.EXCLUSIVE_GATEWAY:
        return ExclusiveGateway(
            id=node_id,
            type=element_type,
            name=label,
            direction=GatewayDirection(
                config.get("direction", GatewayDirection.DIVERGING.value)
            ),
            default_flow=config.get("defaultFlow"),
        )

    if element_type == BPMNElementType.PARALLEL_GATEWAY:
        return ParallelGateway(
            id=node_id,
            type=element_type,
            name=label,
            direction=GatewayDirection(
                config.get("direction", GatewayDirection.DIVERGING.value)
            ),
        )

    if element_type == BPMNElementType.INCLUSIVE_GATEWAY:
        return InclusiveGateway(
            id=node_id,
            type=element_type,
            name=label,
            direction=GatewayDirection(
                config.get("direction", GatewayDirection.DIVERGING.value)
            ),
        )

    raise ValueError(f"Unsupported element type: {element_type}")


def _convert_edge_to_flow(edge: Dict[str, Any]) -> SequenceFlow:
    """Convert ReactFlow edge to BPMN SequenceFlow."""
    edge_id = edge.get("id")
    source = edge.get("source")
    target = edge.get("target")

    if not edge_id or not source or not target:
        raise ValueError("Edge must have 'id', 'source', and 'target' fields")

    data = edge.get("data", {})

    return SequenceFlow(
        id=edge_id,
        source_ref=source,
        target_ref=target,
        name=data.get("label"),
        condition_expression=data.get("conditionExpression"),
    )


def _normalize_element_type(node_type: str) -> BPMNElementType:
    """
    Normalize legacy node types to BPMN element types.

    Maps old workflow node types to BPMN 2.0 standard types.
    """
    type_mapping = {
        "startEvent": BPMNElementType.START_EVENT,
        "endEvent": BPMNElementType.END_EVENT,
        "serviceTask": BPMNElementType.SERVICE_TASK,
        "scriptTask": BPMNElementType.SCRIPT_TASK,
        "userTask": BPMNElementType.USER_TASK,
        "exclusiveGateway": BPMNElementType.EXCLUSIVE_GATEWAY,
        "parallelGateway": BPMNElementType.PARALLEL_GATEWAY,
        "inclusiveGateway": BPMNElementType.INCLUSIVE_GATEWAY,
        "agent_spawn": BPMNElementType.SERVICE_TASK,
        "handoff": BPMNElementType.SERVICE_TASK,
        "assign": BPMNElementType.SERVICE_TASK,
        "send_message": BPMNElementType.SERVICE_TASK,
        "xor_split": BPMNElementType.EXCLUSIVE_GATEWAY,
        "xor_join": BPMNElementType.EXCLUSIVE_GATEWAY,
        "and_split": BPMNElementType.PARALLEL_GATEWAY,
        "and_join": BPMNElementType.PARALLEL_GATEWAY,
        "or_split": BPMNElementType.INCLUSIVE_GATEWAY,
        "or_join": BPMNElementType.INCLUSIVE_GATEWAY,
    }

    normalized = type_mapping.get(node_type)
    if not normalized:
        raise ValueError(
            f"Unknown node type '{node_type}'. Must be a valid BPMN element type."
        )

    return normalized


def _validate_process(process: BPMNProcess) -> None:
    """
    Validate BPMN process structure.

    Raises:
        WorkflowConversionError: If validation fails
    """
    start_events = process.get_start_events()
    if not start_events:
        raise WorkflowConversionError("Process must have at least one START_EVENT")

    end_events = process.get_end_events()
    if not end_events:
        raise WorkflowConversionError("Process must have at least one END_EVENT")

    for flow in process.sequence_flows.values():
        if not process.get_element(flow.source_ref):
            raise WorkflowConversionError(
                f"Sequence flow {flow.id} references non-existent source: {flow.source_ref}"
            )
        if not process.get_element(flow.target_ref):
            raise WorkflowConversionError(
                f"Sequence flow {flow.id} references non-existent target: {flow.target_ref}"
            )

    logger.info(
        f"Process validation passed: {len(start_events)} start events, "
        f"{len(end_events)} end events"
    )
