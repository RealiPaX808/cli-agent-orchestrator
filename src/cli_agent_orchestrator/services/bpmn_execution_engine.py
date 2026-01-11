"""BPMN workflow execution engine with token-based semantics."""

import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional

from cli_agent_orchestrator.models.bpmn import (
    BPMNElement,
    BPMNElementType,
    BPMNEvent,
    BPMNGateway,
    BPMNProcess,
    BPMNTask,
    ExclusiveGateway,
    GatewayDirection,
    InclusiveGateway,
    ParallelGateway,
    ProcessInstance,
    ScriptTask,
    SequenceFlow,
    ServiceTask,
    Token,
    TokenState,
    UserTask,
)

logger = logging.getLogger(__name__)


class BPMNExecutionEngine:
    def __init__(
        self,
        process: BPMNProcess,
        session_name: str,
        terminal_service: Any,
        expression_evaluator: Any,
    ):
        self.process = process
        self.session_name = session_name
        self.terminal_service = terminal_service
        self.expression_evaluator = expression_evaluator

        instance_id = f"pi_{uuid.uuid4().hex[:8]}"
        self.instance = ProcessInstance(
            instance_id=instance_id,
            process_id=process.id,
            session_name=session_name,
            variables=process.process_variables.copy(),
        )

    async def execute(self) -> ProcessInstance:
        start_events = self.process.get_start_events()
        if not start_events:
            raise ValueError(f"Process {self.process.id} has no start events")

        if len(start_events) > 1:
            logger.warning(
                f"Process {self.process.id} has multiple start events, using first one"
            )

        start_event = start_events[0]

        initial_token = Token(
            id=f"token_{uuid.uuid4().hex[:8]}",
            current_element_id=start_event.id,
            state=TokenState.ACTIVE,
            data={},
        )
        self.instance.add_token(initial_token)

        outgoing_flows = self.process.get_outgoing_flows(start_event.id)
        if outgoing_flows:
            await self._move_token(initial_token, outgoing_flows[0])

        while self.instance.get_active_tokens():
            active_tokens = self.instance.get_active_tokens()
            for token in active_tokens:
                await self._execute_token(token)
                await asyncio.sleep(0.1)

        return self.instance

    async def _execute_token(self, token: Token) -> None:
        element = self.process.get_element(token.current_element_id)
        if not element:
            logger.error(f"Element {token.current_element_id} not found")
            token.state = TokenState.FAILED
            token.error = f"Element {token.current_element_id} not found"
            return

        logger.info(
            f"Executing token {token.id} at element {element.id} (type: {element.type})"
        )

        try:
            if element.type == BPMNElementType.END_EVENT:
                if isinstance(element, BPMNEvent):
                    await self._execute_end_event(token, element)
                else:
                    raise TypeError(
                        f"Element {element.id} should be BPMNEvent but is not"
                    )
            elif element.type == BPMNElementType.SERVICE_TASK:
                await self._execute_service_task(token, element)
            elif element.type == BPMNElementType.SCRIPT_TASK:
                await self._execute_script_task(token, element)
            elif element.type == BPMNElementType.USER_TASK:
                await self._execute_user_task(token, element)
            elif element.type == BPMNElementType.EXCLUSIVE_GATEWAY:
                await self._execute_exclusive_gateway(token, element)
            elif element.type == BPMNElementType.PARALLEL_GATEWAY:
                await self._execute_parallel_gateway(token, element)
            elif element.type == BPMNElementType.INCLUSIVE_GATEWAY:
                await self._execute_inclusive_gateway(token, element)
            else:
                outgoing_flows = self.process.get_outgoing_flows(element.id)
                if outgoing_flows:
                    await self._move_token(token, outgoing_flows[0])
                else:
                    token.state = TokenState.COMPLETED

        except Exception as e:
            logger.error(f"Error executing token {token.id} at {element.id}: {e}")
            token.state = TokenState.FAILED
            token.error = str(e)
            self.instance.element_states[element.id] = "failed"

    async def _execute_end_event(self, token: Token, element: BPMNEvent) -> None:
        logger.info(f"Token {token.id} reached end event {element.id}")
        token.state = TokenState.COMPLETED
        self.instance.element_states[element.id] = "completed"

    async def _execute_service_task(self, token: Token, element: BPMNElement) -> None:
        if not isinstance(element, ServiceTask):
            raise TypeError(f"Element {element.id} is not a ServiceTask")

        task: ServiceTask = element
        logger.info(f"Executing ServiceTask {task.id}: {task.name}")

        self.instance.element_states[task.id] = "running"

        rendered_task = self.expression_evaluator.render_template(
            task.task_template, {**self.instance.variables, **token.data}
        )

        terminal = self.terminal_service.create_terminal(
            agent_profile=task.agent_profile,
            provider=task.provider,
            session_name=self.session_name,
            new_session=False,
        )

        self.instance.terminal_mappings[task.id] = terminal.id
        self.terminal_service.send_direct_input(terminal.id, rendered_task)

        if task.wait_for_completion:
            output = await self._wait_for_terminal_completion(
                terminal.id, timeout=task.timeout
            )
            self.terminal_service.send_direct_input(terminal.id, "/exit")

            token.data["output"] = output
            self.instance.element_states[task.id] = "completed"

            outgoing_flows = self.process.get_outgoing_flows(task.id)
            if outgoing_flows:
                await self._move_token(token, outgoing_flows[0])
            else:
                token.state = TokenState.COMPLETED
        else:
            token.data["terminal_id"] = terminal.id
            self.instance.element_states[task.id] = "spawned"

            outgoing_flows = self.process.get_outgoing_flows(task.id)
            if outgoing_flows:
                await self._move_token(token, outgoing_flows[0])
            else:
                token.state = TokenState.COMPLETED

    async def _execute_script_task(self, token: Token, element: BPMNElement) -> None:
        if not isinstance(element, ScriptTask):
            raise TypeError(f"Element {element.id} is not a ScriptTask")

        task: ScriptTask = element
        logger.info(f"Executing ScriptTask {task.id}: {task.name}")

        self.instance.element_states[task.id] = "running"

        result = self.expression_evaluator.evaluate(
            task.script, {**self.instance.variables, **token.data}
        )

        token.data["output"] = result
        self.instance.element_states[task.id] = "completed"

        outgoing_flows = self.process.get_outgoing_flows(task.id)
        if outgoing_flows:
            await self._move_token(token, outgoing_flows[0])
        else:
            token.state = TokenState.COMPLETED

    async def _execute_user_task(self, token: Token, element: BPMNElement) -> None:
        if not isinstance(element, UserTask):
            raise TypeError(f"Element {element.id} is not a UserTask")

        task: UserTask = element
        logger.info(f"User task {task.id} requires manual action")

        token.state = TokenState.WAITING
        self.instance.element_states[task.id] = "waiting_for_user"

    async def _execute_exclusive_gateway(
        self, token: Token, element: BPMNElement
    ) -> None:
        if not isinstance(element, ExclusiveGateway):
            raise TypeError(f"Element {element.id} is not an ExclusiveGateway")

        gateway: ExclusiveGateway = element

        if gateway.direction == GatewayDirection.CONVERGING:
            await self._execute_gateway_join(token, gateway)
        elif gateway.direction == GatewayDirection.DIVERGING:
            await self._execute_xor_split(token, gateway)
        else:
            logger.warning(f"XOR gateway {gateway.id} has MIXED direction")
            await self._execute_xor_split(token, gateway)

    async def _execute_parallel_gateway(
        self, token: Token, element: BPMNElement
    ) -> None:
        if not isinstance(element, ParallelGateway):
            raise TypeError(f"Element {element.id} is not a ParallelGateway")

        gateway: ParallelGateway = element

        if gateway.direction == GatewayDirection.CONVERGING:
            await self._execute_gateway_join(token, gateway)
        elif gateway.direction == GatewayDirection.DIVERGING:
            await self._execute_and_split(token, gateway)
        else:
            logger.warning(f"AND gateway {gateway.id} has MIXED direction")
            await self._execute_and_split(token, gateway)

    async def _execute_inclusive_gateway(
        self, token: Token, element: BPMNElement
    ) -> None:
        if not isinstance(element, InclusiveGateway):
            raise TypeError(f"Element {element.id} is not an InclusiveGateway")

        gateway: InclusiveGateway = element

        if gateway.direction == GatewayDirection.CONVERGING:
            await self._execute_gateway_join(token, gateway)
        elif gateway.direction == GatewayDirection.DIVERGING:
            await self._execute_or_split(token, gateway)
        else:
            logger.warning(f"OR gateway {gateway.id} has MIXED direction")
            await self._execute_or_split(token, gateway)

    async def _execute_xor_split(self, token: Token, gateway: ExclusiveGateway) -> None:
        logger.info(f"XOR Split at {gateway.id}")

        outgoing_flows = self.process.get_outgoing_flows(gateway.id)
        if not outgoing_flows:
            token.state = TokenState.COMPLETED
            return

        selected_flow = None
        for flow in outgoing_flows:
            if flow.condition_expression:
                condition_result = self.expression_evaluator.evaluate(
                    flow.condition_expression, {**self.instance.variables, **token.data}
                )
                if condition_result:
                    selected_flow = flow
                    break

        if not selected_flow and gateway.default_flow:
            selected_flow = self.process.get_sequence_flow(gateway.default_flow)

        if not selected_flow and outgoing_flows:
            logger.warning(
                f"No condition matched at XOR gateway {gateway.id}, taking first flow"
            )
            selected_flow = outgoing_flows[0]

        if selected_flow:
            await self._move_token(token, selected_flow)
        else:
            logger.error(f"No outgoing flow available at XOR gateway {gateway.id}")
            token.state = TokenState.FAILED

    async def _execute_and_split(self, token: Token, gateway: ParallelGateway) -> None:
        logger.info(f"AND Split at {gateway.id}: spawning parallel tokens")

        outgoing_flows = self.process.get_outgoing_flows(gateway.id)
        if not outgoing_flows:
            token.state = TokenState.COMPLETED
            return

        token.state = TokenState.COMPLETED

        for flow in outgoing_flows:
            child_token = Token(
                id=f"token_{uuid.uuid4().hex[:8]}",
                current_element_id=gateway.id,
                state=TokenState.ACTIVE,
                data=token.data.copy(),
                parent_token_id=token.id,
            )
            self.instance.add_token(child_token)
            await self._move_token(child_token, flow)

    async def _execute_or_split(self, token: Token, gateway: InclusiveGateway) -> None:
        logger.info(f"OR Split at {gateway.id}: evaluating conditions")

        outgoing_flows = self.process.get_outgoing_flows(gateway.id)
        if not outgoing_flows:
            token.state = TokenState.COMPLETED
            return

        active_flows = []
        for flow in outgoing_flows:
            if flow.condition_expression:
                condition_result = self.expression_evaluator.evaluate(
                    flow.condition_expression, {**self.instance.variables, **token.data}
                )
                if condition_result:
                    active_flows.append(flow)
            elif flow.id == gateway.default_flow:
                active_flows.append(flow)

        if not active_flows:
            active_flows = outgoing_flows

        token.state = TokenState.COMPLETED

        for flow in active_flows:
            child_token = Token(
                id=f"token_{uuid.uuid4().hex[:8]}",
                current_element_id=gateway.id,
                state=TokenState.ACTIVE,
                data=token.data.copy(),
                parent_token_id=token.id,
            )
            self.instance.add_token(child_token)
            await self._move_token(child_token, flow)

    async def _execute_gateway_join(self, token: Token, gateway: BPMNGateway) -> None:
        logger.info(f"Gateway Join at {gateway.id}")

        incoming_flows = self.process.get_incoming_flows(gateway.id)
        tokens_at_gateway = self.instance.get_tokens_at_element(gateway.id)

        required_count = len(incoming_flows)
        arrived_count = len(tokens_at_gateway)

        logger.info(
            f"Join: {arrived_count}/{required_count} tokens arrived at {gateway.id}"
        )

        if arrived_count < required_count:
            token.state = TokenState.WAITING
            return

        combined_data = {}
        for t in tokens_at_gateway:
            combined_data.update(t.data)
            if t.id != token.id:
                t.state = TokenState.COMPLETED

        token.data = combined_data
        token.state = TokenState.ACTIVE

        outgoing_flows = self.process.get_outgoing_flows(gateway.id)
        if outgoing_flows:
            await self._move_token(token, outgoing_flows[0])
        else:
            token.state = TokenState.COMPLETED

    async def _move_token(self, token: Token, sequence_flow: SequenceFlow) -> None:
        target_element = self.process.get_element(sequence_flow.target_ref)
        if not target_element:
            raise ValueError(f"Target element {sequence_flow.target_ref} not found")

        logger.info(
            f"Moving token {token.id} from {token.current_element_id} to {target_element.id} via {sequence_flow.id}"
        )

        token.current_element_id = target_element.id

    async def _wait_for_terminal_completion(
        self, terminal_id: str, timeout: int = 600
    ) -> str:
        elapsed = 0
        check_interval = 2

        while elapsed < timeout:
            terminal_info = self.terminal_service.get_terminal_info(terminal_id)
            if not terminal_info:
                raise RuntimeError(f"Terminal {terminal_id} not found")

            status = terminal_info.get("status")
            if status == "COMPLETED":
                output = self.terminal_service.get_terminal_output(
                    terminal_id, mode="full"
                )
                return output.get("content", "")
            elif status == "ERROR":
                raise RuntimeError(f"Terminal {terminal_id} encountered an error")

            await asyncio.sleep(check_interval)
            elapsed += check_interval

        raise TimeoutError(
            f"Terminal {terminal_id} did not complete within {timeout} seconds"
        )
