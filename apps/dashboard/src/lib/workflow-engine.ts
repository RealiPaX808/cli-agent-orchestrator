import { Workflow, WorkflowExecution, WorkflowExecutionStatus, WorkflowNodeExecution, WorkflowNodeType } from '@/types/workflow';
import { caoClient } from './api-client';

export class WorkflowEngine {
  private execution: WorkflowExecution;
  private workflow: Workflow;
  private onUpdate?: (execution: WorkflowExecution) => void;

  constructor(workflow: Workflow, onUpdate?: (execution: WorkflowExecution) => void) {
    this.workflow = workflow;
    this.onUpdate = onUpdate;
    this.execution = {
      workflowId: workflow.id,
      executionId: `exec-${Date.now()}`,
      status: WorkflowExecutionStatus.IDLE,
      nodes: new Map(),
    };
  }

  async execute(): Promise<WorkflowExecution> {
    this.execution.status = WorkflowExecutionStatus.RUNNING;
    this.execution.startedAt = new Date().toISOString();
    this.notifyUpdate();

    try {
      const sortedNodes = this.topologicalSort();
      
      for (const nodeId of sortedNodes) {
        const node = this.workflow.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        await this.executeNode(node.id);
      }

      this.execution.status = WorkflowExecutionStatus.COMPLETED;
      this.execution.completedAt = new Date().toISOString();
    } catch (error) {
      this.execution.status = WorkflowExecutionStatus.FAILED;
      this.execution.error = error instanceof Error ? error.message : String(error);
      this.execution.completedAt = new Date().toISOString();
    }

    this.notifyUpdate();
    return this.execution;
  }

  private async executeNode(nodeId: string): Promise<void> {
    const node = this.workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeExec: WorkflowNodeExecution = {
      nodeId,
      status: WorkflowExecutionStatus.RUNNING,
      startedAt: new Date().toISOString(),
    };

    this.execution.nodes.set(nodeId, nodeExec);
    this.execution.currentNodeId = nodeId;
    this.notifyUpdate();

    try {
      switch (node.data.type) {
        case WorkflowNodeType.AGENT_SPAWN:
          await this.executeAgentSpawn(nodeExec, node);
          break;
        case WorkflowNodeType.HANDOFF:
          await this.executeHandoff(nodeExec, node);
          break;
        case WorkflowNodeType.ASSIGN:
          await this.executeAssign(nodeExec, node);
          break;
        case WorkflowNodeType.SEND_MESSAGE:
          await this.executeSendMessage(nodeExec, node);
          break;
        default:
          nodeExec.output = `Node type ${node.data.type} not implemented`;
      }

      nodeExec.status = WorkflowExecutionStatus.COMPLETED;
      nodeExec.completedAt = new Date().toISOString();
    } catch (error) {
      nodeExec.status = WorkflowExecutionStatus.FAILED;
      nodeExec.error = error instanceof Error ? error.message : String(error);
      nodeExec.completedAt = new Date().toISOString();

      if (this.workflow.config.errorHandling === 'stop') {
        throw error;
      }
    }

    this.notifyUpdate();
  }

  private async executeAgentSpawn(nodeExec: WorkflowNodeExecution, node: any): Promise<void> {
    const { agentProfile, provider } = node.data.config;
    
    if (!agentProfile || !provider) {
      throw new Error('Agent profile and provider required for spawn');
    }

    const terminal = await caoClient.createSession(
      provider,
      agentProfile,
      `${this.workflow.name}-${node.data.label}`
    );

    nodeExec.terminalId = terminal.id;
    nodeExec.output = `Spawned terminal: ${terminal.id}`;
  }

  private async executeHandoff(nodeExec: WorkflowNodeExecution, node: any): Promise<void> {
    const sourceNodeId = this.workflow.edges.find(e => e.target === node.id)?.source;
    if (!sourceNodeId) {
      throw new Error('Handoff requires source node');
    }

    const sourceExec = this.execution.nodes.get(sourceNodeId);
    if (!sourceExec?.terminalId) {
      throw new Error('Source node has no terminal');
    }

    const { message, waitForCompletion } = node.data.config;
    
    await caoClient.sendTerminalInput(sourceExec.terminalId, message || '');
    
    if (waitForCompletion) {
      await this.waitForTerminalCompletion(sourceExec.terminalId);
    }

    nodeExec.output = `Handoff to ${sourceExec.terminalId}`;
  }

  private async executeAssign(nodeExec: WorkflowNodeExecution, node: any): Promise<void> {
    const { agentProfile, provider, message } = node.data.config;
    
    if (!agentProfile || !provider) {
      throw new Error('Agent profile and provider required for assign');
    }

    const terminal = await caoClient.createSession(
      provider,
      agentProfile,
      `${this.workflow.name}-${node.data.label}`
    );

    nodeExec.terminalId = terminal.id;

    if (message) {
      await caoClient.sendTerminalInput(terminal.id, message);
    }

    nodeExec.output = `Assigned to terminal: ${terminal.id}`;
  }

  private async executeSendMessage(nodeExec: WorkflowNodeExecution, node: any): Promise<void> {
    const targetNodeId = this.workflow.edges.find(e => e.source === node.id)?.target;
    if (!targetNodeId) {
      throw new Error('Send message requires target node');
    }

    const targetExec = this.execution.nodes.get(targetNodeId);
    if (!targetExec?.terminalId) {
      throw new Error('Target node has no terminal');
    }

    const { message } = node.data.config;
    await caoClient.sendTerminalInput(targetExec.terminalId, message || '');

    nodeExec.output = `Message sent to ${targetExec.terminalId}`;
  }

  private async waitForTerminalCompletion(terminalId: string, timeout: number = 300000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const terminal = await caoClient.getTerminal(terminalId);
      
      if (terminal.status === 'completed' || terminal.status === 'error') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Terminal completion timeout');
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const temp = new Set<string>();

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) {
        throw new Error('Workflow contains cycle');
      }
      if (visited.has(nodeId)) return;

      temp.add(nodeId);

      const outgoingEdges = this.workflow.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        visit(edge.target);
      }

      temp.delete(nodeId);
      visited.add(nodeId);
      result.unshift(nodeId);
    };

    const rootNodes = this.workflow.nodes.filter(node => {
      return !this.workflow.edges.some(edge => edge.target === node.id);
    });

    for (const node of rootNodes) {
      visit(node.id);
    }

    return result;
  }

  private notifyUpdate(): void {
    if (this.onUpdate) {
      this.onUpdate({ ...this.execution });
    }
  }

  getExecution(): WorkflowExecution {
    return { ...this.execution };
  }
}
