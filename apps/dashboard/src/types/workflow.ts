import { Node, Edge } from '@xyflow/react';
import { ProviderType } from './cao';

// Workflow Node Types
export enum WorkflowNodeType {
  AGENT_SPAWN = 'agent_spawn',
  HANDOFF = 'handoff',
  ASSIGN = 'assign',
  SEND_MESSAGE = 'send_message',
  DECISION = 'decision',
  INPUT = 'input',
  OUTPUT = 'output',
  WEBHOOK = 'webhook',
}

// Workflow Execution Status
export enum WorkflowExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Node Configuration
export interface NodeConfig extends Record<string, unknown> {
  agentProfile?: string;
  provider?: ProviderType;
  message?: string;
  waitForCompletion?: boolean;
  condition?: string; // For decision nodes
  timeout?: number;
  retries?: number;
  webhookUrl?: string; // For webhook nodes
  webhookMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // HTTP method
  webhookHeaders?: Record<string, string>; // Custom headers
  webhookPayload?: string; // Text to send as payload
}

// Workflow Node Data
export interface WorkflowNodeData extends Record<string, unknown> {
  id: string;
  type: WorkflowNodeType;
  label: string;
  config: NodeConfig;
  status?: WorkflowExecutionStatus;
  terminalId?: string; // Mapped terminal ID after spawn
  output?: string; // Execution output
}

// Workflow Edge Data
export interface WorkflowEdgeData extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string; // For conditional edges
}

// Typed Workflow Nodes and Edges
export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge<WorkflowEdgeData>;

// Workflow Configuration
export interface WorkflowConfig {
  autoExecute?: boolean;
  parallelExecution?: boolean;
  maxParallelNodes?: number;
  errorHandling?: 'stop' | 'continue' | 'retry';
}

// Complete Workflow Definition
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  config: WorkflowConfig;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

// Workflow Execution State
export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: WorkflowExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  nodes: Map<string, WorkflowNodeExecution>;
  currentNodeId?: string;
  error?: string;
}

// Node Execution State
export interface WorkflowNodeExecution {
  nodeId: string;
  status: WorkflowExecutionStatus;
  terminalId?: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

// Workflow Pattern (Template)
export interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;
  previewImage?: string;
}
