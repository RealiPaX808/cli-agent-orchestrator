"""Workflow fixtures for testing."""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


@dataclass
class WorkflowNode:
    """Test fixture for workflow node."""
    id: str
    type: str
    label: str
    agent_profile: Optional[str] = None
    provider: str = "q_cli"
    task_template: Optional[str] = None
    position: Dict[str, int] = field(default_factory=lambda: {"x": 0, "y": 0})


@dataclass
class WorkflowEdge:
    """Test fixture for workflow edge."""
    id: str
    source: str
    target: str
    condition: Optional[str] = None


@dataclass
class WorkflowFixture:
    """Test fixture for complete workflow."""
    id: str
    name: str
    description: str
    nodes: List[WorkflowNode] = field(default_factory=list)
    edges: List[WorkflowEdge] = field(default_factory=list)
    config: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary format expected by API."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "config": self.config,
            "nodes": [
                {
                    "id": n.id,
                    "type": n.type,
                    "data": {
                        "label": n.label,
                        **({"agent_profile": n.agent_profile} if n.agent_profile else {}),
                        **({"provider": n.provider} if n.agent_profile else {}),
                        **({"task_template": n.task_template} if n.task_template else {})
                    },
                    "position": n.position
                }
                for n in self.nodes
            ],
            "edges": [
                {
                    "id": e.id,
                    "source": e.source,
                    "target": e.target,
                    "data": {"condition": e.condition} if e.condition else None
                }
                for e in self.edges
            ]
        }


class WorkflowFixtureManager:
    """Manages workflow fixtures for testing."""
    
    @staticmethod
    def create_simple_code_review_workflow() -> WorkflowFixture:
        """Create a simple code review workflow.
        
        Returns:
            WorkflowFixture for a basic code review process
        """
        return WorkflowFixture(
            id="workflow-code-review",
            name="Code Review Workflow",
            description="Simple code review with one reviewer",
            nodes=[
                WorkflowNode(id="start", type="startEvent", label="Start", position={"x": 100, "y": 100}),
                WorkflowNode(
                    id="review-task",
                    type="serviceTask",
                    label="Code Review",
                    agent_profile="code-reviewer",
                    provider="q_cli",
                    task_template="Review the following code and provide feedback",
                    position={"x": 300, "y": 100}
                ),
                WorkflowNode(id="end", type="endEvent", label="End", position={"x": 500, "y": 100})
            ],
            edges=[
                WorkflowEdge(id="e1", source="start", target="review-task"),
                WorkflowEdge(id="e2", source="review-task", target="end")
            ]
        )
    
    @staticmethod
    def create_parallel_review_workflow() -> WorkflowFixture:
        """Create a workflow with parallel review.
        
        Returns:
            WorkflowFixture with parallel reviewer tasks
        """
        return WorkflowFixture(
            id="workflow-parallel-review",
            name="Parallel Code Review",
            description="Code review with multiple parallel reviewers",
            nodes=[
                WorkflowNode(id="start", type="startEvent", label="Start", position={"x": 100, "y": 100}),
                WorkflowNode(id="gateway-split", type="parallelGateway", label="Split", position={"x": 250, "y": 100}),
                WorkflowNode(
                    id="review-1",
                    type="serviceTask",
                    label="Security Review",
                    agent_profile="security-reviewer",
                    provider="q_cli",
                    task_template="Review for security issues",
                    position={"x": 400, "y": 50}
                ),
                WorkflowNode(
                    id="review-2",
                    type="serviceTask",
                    label="Style Review",
                    agent_profile="style-reviewer",
                    provider="q_cli",
                    task_template="Review for code style",
                    position={"x": 400, "y": 150}
                ),
                WorkflowNode(id="gateway-join", type="parallelGateway", label="Join", position={"x": 550, "y": 100}),
                WorkflowNode(id="end", type="endEvent", label="End", position={"x": 700, "y": 100})
            ],
            edges=[
                WorkflowEdge(id="e1", source="start", target="gateway-split"),
                WorkflowEdge(id="e2", source="gateway-split", target="review-1"),
                WorkflowEdge(id="e3", source="gateway-split", target="review-2"),
                WorkflowEdge(id="e4", source="review-1", target="gateway-join"),
                WorkflowEdge(id="e5", source="review-2", target="gateway-join"),
                WorkflowEdge(id="e6", source="gateway-join", target="end")
            ]
        )
    
    @staticmethod
    def create_conditional_workflow() -> WorkflowFixture:
        """Create a workflow with conditional branching.
        
        Returns:
            WorkflowFixture with exclusive gateway for conditions
        """
        return WorkflowFixture(
            id="workflow-conditional",
            name="Conditional Workflow",
            description="Workflow with conditional branching based on code complexity",
            nodes=[
                WorkflowNode(id="start", type="startEvent", label="Start", position={"x": 100, "y": 100}),
                WorkflowNode(
                    id="analyze",
                    type="scriptTask",
                    label="Analyze Complexity",
                    task_template="analyze_code_complexity",
                    position={"x": 250, "y": 100}
                ),
                WorkflowNode(id="gateway", type="exclusiveGateway", label="Check Complexity", position={"x": 400, "y": 100}),
                WorkflowNode(
                    id="simple-review",
                    type="serviceTask",
                    label="Quick Review",
                    agent_profile="code-reviewer",
                    provider="q_cli",
                    task_template="Quick code review",
                    position={"x": 550, "y": 50}
                ),
                WorkflowNode(
                    id="detailed-review",
                    type="serviceTask",
                    label="Detailed Review",
                    agent_profile="senior-reviewer",
                    provider="q_cli",
                    task_template="Detailed code review with analysis",
                    position={"x": 550, "y": 150}
                ),
                WorkflowNode(id="end", type="endEvent", label="End", position={"x": 700, "y": 100})
            ],
            edges=[
                WorkflowEdge(id="e1", source="start", target="analyze"),
                WorkflowEdge(id="e2", source="analyze", target="gateway"),
                WorkflowEdge(id="e3", source="gateway", target="simple-review", condition="complexity < 10"),
                WorkflowEdge(id="e4", source="gateway", target="detailed-review", condition="complexity >= 10"),
                WorkflowEdge(id="e5", source="simple-review", target="end"),
                WorkflowEdge(id="e6", source="detailed-review", target="end")
            ]
        )
    
    @staticmethod
    def create_handoff_workflow() -> WorkflowFixture:
        """Create a workflow demonstrating agent handoff.
        
        Returns:
            WorkflowFixture with sequential agent handoffs
        """
        return WorkflowFixture(
            id="workflow-handoff",
            name="Agent Handoff Workflow",
            description="Sequential handoff between developer, reviewer, and tester",
            nodes=[
                WorkflowNode(id="start", type="startEvent", label="Start", position={"x": 100, "y": 100}),
                WorkflowNode(
                    id="dev-task",
                    type="serviceTask",
                    label="Development",
                    agent_profile="developer",
                    provider="q_cli",
                    task_template="Implement the feature according to specs",
                    position={"x": 250, "y": 100}
                ),
                WorkflowNode(
                    id="review-task",
                    type="serviceTask",
                    label="Review",
                    agent_profile="code-reviewer",
                    provider="q_cli",
                    task_template="Review the implementation",
                    position={"x": 400, "y": 100}
                ),
                WorkflowNode(
                    id="test-task",
                    type="serviceTask",
                    label="Testing",
                    agent_profile="tester",
                    provider="q_cli",
                    task_template="Write and run tests for the feature",
                    position={"x": 550, "y": 100}
                ),
                WorkflowNode(id="end", type="endEvent", label="Complete", position={"x": 700, "y": 100})
            ],
            edges=[
                WorkflowEdge(id="e1", source="start", target="dev-task"),
                WorkflowEdge(id="e2", source="dev-task", target="review-task"),
                WorkflowEdge(id="e3", source="review-task", target="test-task"),
                WorkflowEdge(id="e4", source="test-task", target="end")
            ]
        )
