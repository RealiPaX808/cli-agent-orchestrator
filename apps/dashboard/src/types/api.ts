/**
 * API Type Definitions for CLI Agent Orchestrator
 *
 * This file contains all TypeScript types used for API contracts between
 * frontend and backend. These types should be synchronized with the
 * backend API implementation.
 */

// ============================================================================
// PAGINATION & FILTERING
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface WorkflowFilter {
  status?: import('./workflow').WorkflowExecutionStatus;
  search?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
}

export interface SessionFilter {
  status?: import('./cao').SessionStatus;
  provider?: import('./cao').ProviderType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export interface ApiError {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId: string;
}

export enum ErrorCode {
  // Authentication & Authorization
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  AUTHORIZATION_FAILED = 'AUTHZ_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_BODY = 'MISSING_BODY',
  INVALID_PARAMS = 'INVALID_PARAMS',

  // Resources
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',

  // Operations
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  AGENT_SPAWN_FAILED = 'AGENT_SPAWN_FAILED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',

  // Rate Limiting
  RATE_LIMITED = 'RATE_LIMITED',

  // Internal
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export enum Role {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface LogoutResponse {
  success: boolean;
}

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface Task {
  id: string;
  workflowId: string;
  executionId: string;
  nodeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
  input?: Record<string, unknown>;
}

export interface CreateTaskRequest {
  workflowId: string;
  executionId?: string;
  nodeId: string;
  assignTo?: string;
  priority?: TaskPriority;
  input?: Record<string, unknown>;
}

export interface CreateTaskResponse {
  task: Task;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  result?: unknown;
  error?: string;
}

export interface UpdateTaskStatusResponse {
  task: Task;
}

export interface AssignTaskRequest {
  agentId: string;
}

export interface AssignTaskResponse {
  task: Task;
}

export interface ListTasksRequest extends PaginationParams {
  workflowId?: string;
  executionId?: string;
  status?: TaskStatus;
  assignedTo?: string;
  priority?: TaskPriority;
}

export interface ListTasksResponse extends PaginatedResponse<Task> {}

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

export interface ExecuteWorkflowRequest {
  workflowId: string;
  input?: Record<string, unknown>;
  config?: Partial<import('./workflow').WorkflowConfig>;
}

export interface ExecuteWorkflowResponse {
  executionId: string;
  workflowId: string;
  status: import('./workflow').WorkflowExecutionStatus;
  startedAt: string;
}

export interface ListExecutionsRequest extends PaginationParams {
  workflowId: string;
  status?: import('./workflow').WorkflowExecutionStatus;
}

export interface ListExecutionsResponse extends PaginatedResponse<import('./workflow').WorkflowExecution> {}

export interface GetExecutionResponse {
  execution: import('./workflow').WorkflowExecution;
  workflow: import('./workflow').Workflow;
}

export interface PauseExecutionResponse {
  executionId: string;
  status: 'paused';
}

export interface ResumeExecutionResponse {
  executionId: string;
  status: 'running';
}

export interface CancelExecutionRequest {
  reason?: string;
}

export interface CancelExecutionResponse {
  executionId: string;
  status: 'cancelled';
  reason: string;
}

// ============================================================================
// REAL-TIME OUTPUT
// ============================================================================

export interface TerminalOutputEvent {
  terminalId: string;
  timestamp: string;
  type: 'data' | 'status' | 'error';
  content: string;
  status?: import('./cao').TerminalStatus;
}

export interface StreamTerminalOutputRequest {
  terminalId: string;
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export interface Webhook {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface CreateWebhookResponse {
  webhook: Webhook;
}

export interface UpdateWebhookRequest extends Partial<CreateWebhookRequest> {}

export interface UpdateWebhookResponse {
  webhook: Webhook;
}

export interface DeleteWebhookResponse {
  success: boolean;
}

export interface ListWebhooksResponse {
  webhooks: Webhook[];
}

export interface ExecuteWebhookRequest {
  webhookUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: string;
  headers?: Record<string, string>;
}

export interface ExecuteWebhookResponse {
  status_code: number;
  response?: string;
  error?: string;
}

// ============================================================================
// EVENTS
// ============================================================================

export enum EventType {
  // Workflow Events
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_UPDATED = 'workflow.updated',
  WORKFLOW_DELETED = 'workflow.deleted',
  WORKFLOW_EXECUTION_STARTED = 'workflow.execution.started',
  WORKFLOW_EXECUTION_COMPLETED = 'workflow.execution.completed',
  WORKFLOW_EXECUTION_FAILED = 'workflow.execution.failed',
  WORKFLOW_EXECUTION_PAUSED = 'workflow.execution.paused',
  WORKFLOW_EXECUTION_RESUMED = 'workflow.execution.resumed',

  // Node Events
  NODE_EXECUTION_STARTED = 'node.execution.started',
  NODE_EXECUTION_COMPLETED = 'node.execution.completed',
  NODE_EXECUTION_FAILED = 'node.execution.failed',
  NODE_SKIPPED = 'node.skipped',

  // Agent Events
  AGENT_SPAWNED = 'agent.spawned',
  AGENT_TERMINATED = 'agent.terminated',
  AGENT_ASSIGNED = 'agent.assigned',
  AGENT_MESSAGE_SENT = 'agent.message_sent',
  AGENT_MESSAGE_RECEIVED = 'agent.message_received',

  // Session Events
  SESSION_CREATED = 'session.created',
  SESSION_DELETED = 'session.deleted',
  SESSION_ATTACHED = 'session.attached',
  SESSION_DETACHED = 'session.detached',

  // Terminal Events
  TERMINAL_CREATED = 'terminal.created',
  TERMINAL_DELETED = 'terminal.deleted',
  TERMINAL_STATUS_CHANGED = 'terminal.status_changed',
  TERMINAL_OUTPUT = 'terminal.output',

  // Task Events
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
}

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
}

export interface WorkflowExecutionStartedEvent extends BaseEvent {
  type: EventType.WORKFLOW_EXECUTION_STARTED;
  data: {
    workflowId: string;
    executionId: string;
    input?: Record<string, unknown>;
    config?: import('./workflow').WorkflowConfig;
  };
}

export interface NodeExecutionStartedEvent extends BaseEvent {
  type: EventType.NODE_EXECUTION_STARTED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: import('./workflow').BPMNElementType;
    input?: Record<string, unknown>;
  };
}

export interface AgentSpawnedEvent extends BaseEvent {
  type: EventType.AGENT_SPAWNED;
  data: {
    executionId: string;
    nodeId: string;
    terminalId: string;
    provider: import('./cao').ProviderType;
    agentProfile: string;
  };
}

export interface ListEventsRequest extends PaginationParams {
  sessionId?: string;
  workflowId?: string;
  executionId?: string;
  eventType?: EventType;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListEventsResponse extends PaginatedResponse<BaseEvent> {}

export interface Event extends BaseEvent {
  data: Record<string, unknown>;
}

// ============================================================================
// METRICS
// ============================================================================

export interface MetricsSummaryResponse {
  sessions: {
    total: number;
    active: number;
    byProvider: Record<import('./cao').ProviderType, number>;
  };
  workflows: {
    total: number;
    running: number;
    completedToday: number;
  };
  terminals: {
    total: number;
    active: number;
    byStatus: Record<import('./cao').TerminalStatus, number>;
  };
  system: {
    uptime: number;
    version: string;
  };
}

export interface WorkflowMetricsResponse {
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionAt?: string;
}

// ============================================================================
// WEBSOCKET PROTOCOL
// ============================================================================

export enum MessageType {
  // Client -> Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  ACK = 'ack',
  PONG = 'pong',

  // Server -> Client
  EVENT = 'event',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
}

export interface WebSocketMessage {
  type: MessageType;
  id: string;
  timestamp: string;
  payload?: unknown;
}

export interface SubscribeMessage extends WebSocketMessage {
  type: MessageType.SUBSCRIBE;
  payload: {
    channels: string[];
    filter?: EventFilter;
  };
}

export interface EventFilter {
  sessionId?: string;
  workflowId?: string;
  executionId?: string;
  eventTypes?: EventType[];
}

export interface SubscribeAckMessage extends WebSocketMessage {
  type: MessageType.ACK;
  payload: {
    subscriptionId: string;
    channels: string[];
  };
}

export interface EventMessage extends WebSocketMessage {
  type: MessageType.EVENT;
  payload: BaseEvent;
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: MessageType.HEARTBEAT;
  payload: {
    serverTime: string;
  };
}

export interface ErrorMessage extends WebSocketMessage {
  type: MessageType.ERROR;
  payload: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export enum WSErrorCode {
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  AUTHORIZATION_FAILED = 'AUTHZ_FAILED',
  INVALID_SUBSCRIPTION = 'INVALID_SUB',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

export interface RateLimitErrorResponse {
  error: string;
  code: ErrorCode.RATE_LIMITED;
  retryAfter: number;
}

// ============================================================================
// AGENT INSTALLATION
// ============================================================================

export interface InstallAgentRequest {
  source_type: 'built-in' | 'file' | 'url';
  name?: string;
  path?: string;
  provider: string;
}

export interface InstallAgentResponse {
  success: boolean;
  agent_name: string;
  message: string;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  // Re-export from other type files for convenience
  Session,
  Terminal,
  TerminalStatus,
  ProviderType,
  SessionStatus,
  TerminalOutputResponse,
  InboxMessage,
} from './cao';

export type {
  Workflow,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowConfig,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  WorkflowEdgeData,
  BPMNElementType,
  WorkflowPattern,
} from './workflow';

export type {
  ChainNode,
  ChainEdge,
  ChainNodeData,
  ChainEdgeData,
  AgentChain,
  ChainSummary,
  ChainNodeType,
  FlowDirection,
  ActivityState,
} from './chain';
