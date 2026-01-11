import { Node, Edge } from '@xyflow/react';
import { ProviderType } from './cao';

export enum BPMNElementType {
  START_EVENT = 'startEvent',
  END_EVENT = 'endEvent',
  SERVICE_TASK = 'serviceTask',
  SCRIPT_TASK = 'scriptTask',
  USER_TASK = 'userTask',
  EXCLUSIVE_GATEWAY = 'exclusiveGateway',
  PARALLEL_GATEWAY = 'parallelGateway',
  INCLUSIVE_GATEWAY = 'inclusiveGateway',
  SEQUENCE_FLOW = 'sequenceFlow',
  
  AGENT_SPAWN = 'agent_spawn',
  HANDOFF = 'handoff',
  ASSIGN = 'assign',
  SEND_MESSAGE = 'send_message',
  WEBHOOK = 'webhook',
  XOR_SPLIT = 'xor_split',
  XOR_JOIN = 'xor_join',
  AND_SPLIT = 'and_split',
  AND_JOIN = 'and_join',
  OR_SPLIT = 'or_split',
  OR_JOIN = 'or_join',
  DECISION = 'decision',
  INPUT = 'input',
  OUTPUT = 'output',
}

export enum GatewayDirection {
  DIVERGING = 'Diverging',
  CONVERGING = 'Converging',
  MIXED = 'Mixed',
}

export type WorkflowNodeType = BPMNElementType;
export const WorkflowNodeType = BPMNElementType;

// Workflow Execution Status
export enum WorkflowExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ServiceTaskConfig {
  agentProfile: string;
  provider: ProviderType;
  taskTemplate: string;
  systemPrompt?: string;
  timeout?: number;
  waitForCompletion: boolean;
}

export interface ScriptTaskConfig {
  scriptFormat: 'javascript' | 'python' | 'jinja2';
  script: string;
}

export interface UserTaskConfig {
  assignee?: string;
  candidateUsers?: string[];
}

export interface GatewayConfig {
  direction: GatewayDirection;
  defaultFlow?: string;
}

export interface WebhookConfig {
  webhookUrl: string;
  webhookMethod: 'GET' | 'POST' | 'PUT' | 'DELETE';
  webhookPayload?: string;
  isPromptInput?: boolean;
}

export interface LegacyAgentConfig {
  agentProfile?: string;
  provider?: ProviderType;
  message?: string;
  waitForCompletion?: boolean;
}

export type NodeConfig = ServiceTaskConfig | ScriptTaskConfig | UserTaskConfig | GatewayConfig | WebhookConfig | LegacyAgentConfig | Record<string, unknown>;

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

export interface WorkflowEdgeData extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
  label?: string;
  conditionExpression?: string;
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
