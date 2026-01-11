# Robust API Analysis: CLI Agent Orchestrator
**Date:** 2025-01-11
**Version:** 1.0.0
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current API State](#current-api-state)
3. [Type System Analysis](#type-system-analysis)
4. [Required New Endpoints](#required-new-endpoints)
5. [Event-Driven Architecture](#event-driven-architecture)
6. [WebSocket Protocol Design](#websocket-protocol-design)
7. [Security Considerations](#security-considerations)
8. [Migration Path](#migration-path)

---

## Executive Summary

The CLI Agent Orchestrator (CAO) project is a workflow-based agent coordination system with a Next.js dashboard frontend. The current architecture consists of:

- **Frontend:** Next.js 16 dashboard using Cloudscape Design System
- **Backend Proxy:** API routes proxied through Next.js rewrites to `localhost:9889`
- **Type Safety:** TypeScript definitions for workflows, chains, and CAO entities
- **Workflow Engine:** Client-side BPMN-style workflow execution with token-based semantics

### Key Findings

| Area | Status | Priority |
|------|--------|----------|
| Type Definitions | Partial | High |
| API Client | Basic CRUD | High |
| Event System | Missing | Critical |
| WebSocket Support | Missing | Critical |
| Authentication | Not Implemented | Critical |
| Rate Limiting | Not Defined | Medium |
| Documentation | None | High |

---

## Current API State

### Existing API Client (`/apps/dashboard/src/lib/api-client.ts`)

The `CAOClient` class provides the following endpoints:

#### Sessions API

```typescript
// GET /api/sessions
async listSessions(): Promise<Session[]>

// GET /api/sessions/{name}
async getSession(name: string): Promise<Session>

// POST /api/sessions?provider={provider}&agent_profile={profile}&session_name={name}&workflow_id={id}
async createSession(
  provider: string,
  agentProfile: string,
  sessionName?: string,
  workflowId?: string
): Promise<Terminal>

// DELETE /api/sessions/{name}
async deleteSession(name: string): Promise<{ success: boolean }>
```

#### Workflows API

```typescript
// GET /api/workflows
async listWorkflows(): Promise<Workflow[]>

// GET /api/workflows/{id}
async getWorkflow(id: string): Promise<Workflow>

// POST /api/workflows
async createWorkflow(workflow: Workflow): Promise<Workflow>

// PUT /api/workflows/{id}
async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<{ success: boolean }>

// DELETE /api/workflows/{id}
async deleteWorkflow(id: string): Promise<{ success: boolean }>

// GET /api/sessions/{sessionName}/workflow
async getSessionWorkflow(sessionName: string): Promise<Workflow>
```

#### Terminals API

```typescript
// GET /api/sessions/{sessionName}/terminals
async listTerminals(sessionName: string): Promise<Terminal[]>

// GET /api/terminals/{id}
async getTerminal(id: string): Promise<Terminal>

// DELETE /api/terminals/{id}
async deleteTerminal(id: string): Promise<{ success: boolean }>

// GET /api/terminals/{id}/output?mode={full|last|stream}
async getTerminalOutput(id: string, mode: "full" | "last" | "stream"): Promise<TerminalOutputResponse>

// POST /api/terminals/{id}/input?message={message}
async sendTerminalInput(id: string, message: string): Promise<{ success: boolean }>

// GET /api/terminals/{terminalId}/inbox/messages
async getInboxMessages(terminalId: string): Promise<InboxMessage[]>
```

#### Agents API

```typescript
// GET /api/agents
async listAgents(): Promise<string[]>

// GET /api/agents/{agentName}/content
async getAgentContent(agentName: string): Promise<{ content: string }>

// GET /api/providers
async listProviders(): Promise<Array<{ value: string; label: string }>>

// POST /api/agents/install
async installAgent(request: {
  source_type: "built-in" | "file" | "url";
  name?: string;
  path?: string;
  provider: string;
}): Promise<{ success: boolean; agent_name: string; message: string }>
```

#### Webhooks API (Referenced but not in client)

```typescript
// POST /api/webhooks/execute
// Used by WebhookTrigger component
interface WebhookExecuteRequest {
  webhookUrl: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  payload: string;
}

interface WebhookExecuteResponse {
  status_code: number;
}
```

---

## Type System Analysis

### Existing Type Definitions

#### 1. CAO Types (`/apps/dashboard/src/types/cao.ts`)

```typescript
// Enums
enum TerminalStatus {
  IDLE = "idle",
  PROCESSING = "processing",
  COMPLETED = "completed",
  WAITING_PERMISSION = "waiting_permission",
  WAITING_USER_ANSWER = "waiting_user_answer",
  ERROR = "error",
}

enum ProviderType {
  Q_CLI = "q_cli",
  KIRO_CLI = "kiro_cli",
  CLAUDE_CODE = "claude_code",
  OPENCODE = "opencode",
  GEMINI_CLI = "gemini_cli",
  QWEN_CLI = "qwen_cli",
  GH_COPILOT = "gh_copilot",
}

enum SessionStatus {
  ACTIVE = "active",
  DETACHED = "detached",
  TERMINATED = "terminated",
}

// Core Entities
interface Terminal {
  id: string;
  name?: string;
  provider: ProviderType;
  session_name: string;
  agent_profile?: string;
  status?: TerminalStatus;
  last_active?: string;
}

interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  workflow_id?: string;
  execution_state?: Record<string, unknown>;
  terminals?: Terminal[];
}

interface TerminalOutputResponse {
  output: string;
  mode: string;
}

interface InboxMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  status: string;
  created_at: string;
}
```

#### 2. Workflow Types (`/apps/dashboard/src/types/workflow.ts`)

```typescript
// BPMN Element Types
enum BPMNElementType {
  START_EVENT = 'startEvent',
  END_EVENT = 'endEvent',
  SERVICE_TASK = 'serviceTask',
  SCRIPT_TASK = 'scriptTask',
  USER_TASK = 'userTask',
  EXCLUSIVE_GATEWAY = 'exclusiveGateway',
  PARALLEL_GATEWAY = 'parallelGateway',
  INCLUSIVE_GATEWAY = 'inclusiveGateway',
  SEQUENCE_FLOW = 'sequenceFlow',

  // Custom CAO Types
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

// Workflow Execution Status
enum WorkflowExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Node Configurations
interface ServiceTaskConfig {
  agentProfile: string;
  provider: ProviderType;
  taskTemplate: string;
  systemPrompt?: string;
  timeout?: number;
  waitForCompletion: boolean;
}

interface ScriptTaskConfig {
  scriptFormat: 'javascript' | 'python' | 'jinja2';
  script: string;
}

interface UserTaskConfig {
  assignee?: string;
  candidateUsers?: string[];
}

interface GatewayConfig {
  direction: GatewayDirection;
  defaultFlow?: string;
}

interface WebhookConfig {
  webhookUrl: string;
  webhookMethod: 'GET' | 'POST' | 'PUT' | 'DELETE';
  webhookPayload?: string;
  isPromptInput?: boolean;
}

// Core Workflow Types
interface WorkflowNodeData extends Record<string, unknown> {
  id: string;
  type: WorkflowNodeType;
  label: string;
  config: NodeConfig;
  status?: WorkflowExecutionStatus;
  terminalId?: string;
  output?: string;
}

interface WorkflowEdgeData extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
  label?: string;
  conditionExpression?: string;
}

interface WorkflowConfig {
  autoExecute?: boolean;
  parallelExecution?: boolean;
  maxParallelNodes?: number;
  errorHandling?: 'stop' | 'continue' | 'retry';
}

interface Workflow {
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

interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: WorkflowExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  nodes: Map<string, WorkflowNodeExecution>;
  currentNodeId?: string;
  error?: string;
}

interface WorkflowNodeExecution {
  nodeId: string;
  status: WorkflowExecutionStatus;
  terminalId?: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;
  previewImage?: string;
}
```

#### 3. Chain Types (`/apps/dashboard/src/types/chain.ts`)

```typescript
enum ChainNodeType {
  SESSION = 'session',
  TERMINAL = 'terminal',
  AGENT = 'agent',
  INPUT = 'input',
  OUTPUT = 'output',
}

enum FlowDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  BIDIRECTIONAL = 'bidirectional',
}

enum ActivityState {
  ACTIVE = 'active',
  IDLE = 'idle',
  COMPLETED = 'completed',
  ERROR = 'error',
  WAITING = 'waiting',
}

interface ChainNodeData extends Record<string, unknown> {
  id: string;
  type: ChainNodeType;
  label: string;
  status?: TerminalStatus | ActivityState;
  provider?: ProviderType;
  agentProfile?: string;
  lastActive?: string;
  metadata?: Record<string, unknown>;
}

interface ChainEdgeData extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
  direction: FlowDirection;
  label?: string;
  active?: boolean;
  dataFlow?: {
    bytesTransferred?: number;
    lastTransfer?: string;
    transferRate?: number;
  };
}

interface AgentChain {
  sessionId: string;
  sessionName: string;
  nodes: ChainNodeData[];
  edges: ChainEdgeData[];
}

interface ChainSummary {
  sessionId: string;
  sessionName: string;
  terminalCount: number;
  activeTerminals: number;
  status: 'healthy' | 'warning' | 'error' | 'idle';
  lastActivity: string;
}
```

### Missing Type Definitions

The following types are needed for a complete API contract:

```typescript
// Pagination
interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Filtering
interface WorkflowFilter {
  status?: WorkflowExecutionStatus;
  search?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
}

// API Error Response
interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId: string;
}

// Authentication
interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  createdAt: string;
}

// Task Management (New)
interface Task {
  id: string;
  workflowId: string;
  nodeId: string;
  status: TaskStatus;
  assignedTo?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
}

enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

---

## Required New Endpoints

### 1. Workflow Execution API

These endpoints are required for server-side workflow execution orchestration.

```typescript
// POST /api/workflows/{id}/execute
// Start workflow execution
interface ExecuteWorkflowRequest {
  workflowId: string;
  input?: Record<string, unknown>;
  config?: Partial<WorkflowConfig>;
}

interface ExecuteWorkflowResponse {
  executionId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startedAt: string;
}

// GET /api/workflows/{id}/executions
// List all executions for a workflow
interface ListExecutionsRequest extends PaginationParams {
  workflowId: string;
  status?: WorkflowExecutionStatus;
}

interface ListExecutionsResponse extends PaginatedResponse<WorkflowExecution> {}

// GET /api/executions/{executionId}
// Get specific execution details
interface GetExecutionResponse {
  execution: WorkflowExecution;
  workflow: Workflow;
}

// POST /api/executions/{executionId}/pause
// Pause a running execution
interface PauseExecutionResponse {
  executionId: string;
  status: 'paused';
}

// POST /api/executions/{executionId}/resume
// Resume a paused execution
interface ResumeExecutionResponse {
  executionId: string;
  status: 'running';
}

// POST /api/executions/{executionId}/cancel
// Cancel an execution
interface CancelExecutionRequest {
  reason?: string;
}

interface CancelExecutionResponse {
  executionId: string;
  status: 'cancelled';
  reason: string;
}
```

### 2. Real-time Terminal Output API

```typescript
// GET /api/terminals/{id}/output/stream
// Server-Sent Events stream for terminal output
// Response: text/event-stream
interface TerminalOutputEvent {
  terminalId: string;
  timestamp: string;
  type: 'data' | 'status' | 'error';
  content: string;
  status?: TerminalStatus;
}
```

### 3. Agent Task Management API

```typescript
// POST /api/tasks
// Create a new task
interface CreateTaskRequest {
  workflowId: string;
  nodeId: string;
  assignTo?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  input?: Record<string, unknown>;
}

interface CreateTaskResponse {
  task: Task;
}

// GET /api/tasks
// List tasks with filtering
interface ListTasksRequest extends PaginationParams {
  workflowId?: string;
  status?: TaskStatus;
  assignedTo?: string;
}

interface ListTasksResponse extends PaginatedResponse<Task> {}

// GET /api/tasks/{taskId}
// Get task details
interface GetTaskResponse {
  task: Task;
  execution?: WorkflowNodeExecution;
}

// PUT /api/tasks/{taskId}/status
// Update task status
interface UpdateTaskStatusRequest {
  status: TaskStatus;
  result?: unknown;
  error?: string;
}

interface UpdateTaskStatusResponse {
  task: Task;
}

// POST /api/tasks/{taskId}/assign
// Assign task to an agent
interface AssignTaskRequest {
  agentId: string;
}

interface AssignTaskResponse {
  task: Task;
}
```

### 4. Webhook Management API

```typescript
// GET /api/webhooks
// List all webhooks
interface ListWebhooksResponse {
  webhooks: Webhook[];
}

// POST /api/webhooks
// Create a new webhook
interface CreateWebhookRequest {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  enabled: boolean;
}

interface CreateWebhookResponse {
  webhook: Webhook;
}

// PUT /api/webhooks/{id}
// Update webhook
interface UpdateWebhookRequest extends Partial<CreateWebhookRequest> {}

interface UpdateWebhookResponse {
  webhook: Webhook;
}

// DELETE /api/webhooks/{id}
// Delete webhook
interface DeleteWebhookResponse {
  success: boolean;
}
```

### 5. Event History API

```typescript
// GET /api/events
// List events with filtering
interface ListEventsRequest extends PaginationParams {
  sessionId?: string;
  workflowId?: string;
  executionId?: string;
  eventType?: EventType;
  dateFrom?: string;
  dateTo?: string;
}

interface ListEventsResponse extends PaginatedResponse<Event> {}

// GET /api/events/{eventId}
// Get event details
interface GetEventResponse {
  event: Event;
}
```

### 6. Metrics and Analytics API

```typescript
// GET /api/metrics/summary
// Get system-wide metrics summary
interface MetricsSummaryResponse {
  sessions: {
    total: number;
    active: number;
    byProvider: Record<ProviderType, number>;
  };
  workflows: {
    total: number;
    running: number;
    completedToday: number;
  };
  terminals: {
    total: number;
    active: number;
    byStatus: Record<TerminalStatus, number>;
  };
  system: {
    uptime: number;
    version: string;
  };
}

// GET /api/metrics/workflows/{id}
// Get workflow-specific metrics
interface WorkflowMetricsResponse {
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionAt?: string;
}
```

### 7. Authentication API

```typescript
// POST /api/auth/login
interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// POST /api/auth/refresh
interface RefreshTokenRequest {
  refresh_token: string;
}

interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// POST /api/auth/logout
interface LogoutResponse {
  success: boolean;
}

// GET /api/auth/me
interface GetCurrentUserResponse {
  user: User;
}
```

---

## Event-Driven Architecture

### Event Types

The following event types should be emitted during workflow execution:

```typescript
// Base Event Interface
interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
}

// Event Type Enumeration
enum EventType {
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

// Specific Event Schemas
interface WorkflowExecutionStartedEvent extends BaseEvent {
  type: EventType.WORKFLOW_EXECUTION_STARTED;
  data: {
    workflowId: string;
    executionId: string;
    input?: Record<string, unknown>;
    config?: WorkflowConfig;
  };
}

interface NodeExecutionStartedEvent extends BaseEvent {
  type: EventType.NODE_EXECUTION_STARTED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: BPMNElementType;
    input?: Record<string, unknown>;
  };
}

interface AgentSpawnedEvent extends BaseEvent {
  type: EventType.AGENT_SPAWNED;
  data: {
    executionId: string;
    nodeId: string;
    terminalId: string;
    provider: ProviderType;
    agentProfile: string;
  };
}

interface TerminalOutputEvent extends BaseEvent {
  type: EventType.TERMINAL_OUTPUT;
  data: {
    terminalId: string;
    output: string;
    timestamp: string;
  };
}
```

### Event Publishing

Events should be published to:

1. **WebSocket clients** for real-time updates
2. **Event store** for audit/history
3. **Webhook subscribers** for external integrations

```typescript
interface EventPublisher {
  publish(event: BaseEvent): Promise<void>;
  publishBatch(events: BaseEvent[]): Promise<void>;
  subscribe(eventType: EventType, handler: (event: BaseEvent) => void): () => void;
}
```

---

## WebSocket Protocol Design

### Connection

```typescript
// URL: ws://localhost:9889/ws
// Upgrade from HTTP with authentication header

interface WebSocketMessage {
  type: MessageType;
  id: string;
  timestamp: string;
  payload: unknown;
}

enum MessageType {
  // Client -> Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  ACK = 'ack',

  // Server -> Client
  EVENT = 'event',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
}
```

### Subscribe Pattern

```typescript
// Client sends subscription request
interface SubscribeMessage extends WebSocketMessage {
  type: MessageType.SUBSCRIBE;
  payload: {
    channels: string[];
    filter?: EventFilter;
  };
}

interface EventFilter {
  sessionId?: string;
  workflowId?: string;
  executionId?: string;
  eventTypes?: EventType[];
}

// Server confirms subscription
interface SubscribeAckMessage extends WebSocketMessage {
  type: MessageType.ACK;
  payload: {
    subscriptionId: string;
    channels: string[];
  };
}

// Server pushes events
interface EventMessage extends WebSocketMessage {
  type: MessageType.EVENT;
  payload: BaseEvent;
}
```

### Channel Naming Convention

```
# Format: {resource}:{action}:{identifier}
sessions:*                    # All session events
sessions:created              # New sessions
sessions:{sessionId}          # Events for specific session
workflows:{workflowId}        # Events for specific workflow
executions:{executionId}      # Events for specific execution
terminals:{terminalId}        # Output for specific terminal
system:metrics                # System metrics updates
```

### Heartbeat

```typescript
// Server sends every 30 seconds
interface HeartbeatMessage extends WebSocketMessage {
  type: MessageType.HEARTBEAT;
  payload: {
    serverTime: string;
  };
}

// Client should respond with pong
interface PongMessage extends WebSocketMessage {
  type: MessageType.PONG;
  payload: {
    clientTime: string;
  };
}
```

### Error Handling

```typescript
interface ErrorMessage extends WebSocketMessage {
  type: MessageType.ERROR;
  payload: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

enum ErrorCode {
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  AUTHORIZATION_FAILED = 'AUTHZ_FAILED',
  INVALID_SUBSCRIPTION = 'INVALID_SUB',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

---

## Security Considerations

### Authentication

1. **JWT Bearer Tokens** for API authentication
2. **API Key** support for service-to-service communication
3. **WebSocket authentication** via token in handshake query parameter

```typescript
// Authentication Headers
interface AuthHeaders {
  Authorization: `Bearer ${string}`;
  'X-API-Key'?: string;
}

// WebSocket Connection with Auth
const ws = new WebSocket(`ws://localhost:9889/ws?token=${jwtToken}`);
```

### Authorization

Role-based access control (RBAC):

```typescript
enum Role {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

interface Permission {
  resource: 'sessions' | 'workflows' | 'terminals' | 'agents';
  actions: ('read' | 'create' | 'update' | 'delete')[];
}

const RolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    { resource: 'sessions', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'workflows', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'terminals', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'agents', actions: ['read', 'create', 'update', 'delete'] },
  ],
  [Role.OPERATOR]: [
    { resource: 'sessions', actions: ['read', 'create'] },
    { resource: 'workflows', actions: ['read', 'create', 'update'] },
    { resource: 'terminals', actions: ['read'] },
    { resource: 'agents', actions: ['read'] },
  ],
  [Role.VIEWER]: [
    { resource: 'sessions', actions: ['read'] },
    { resource: 'workflows', actions: ['read'] },
    { resource: 'terminals', actions: ['read'] },
    { resource: 'agents', actions: ['read'] },
  ],
};
```

### Rate Limiting

```typescript
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RateLimits: Record<string, RateLimitConfig> = {
  default: { windowMs: 60000, maxRequests: 100 },
  websocket: { windowMs: 60000, maxRequests: 300 },
  execute: { windowMs: 60000, maxRequests: 10 },
  webhook: { windowMs: 60000, maxRequests: 20 },
};
```

### Input Validation

All inputs should be validated using a schema (e.g., Zod):

```typescript
import { z } from 'zod';

const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  input: z.record(z.unknown()).optional(),
  config: z.object({
    autoExecute: z.boolean().optional(),
    parallelExecution: z.boolean().optional(),
    maxParallelNodes: z.number().min(1).max(100).optional(),
    errorHandling: z.enum(['stop', 'continue', 'retry']).optional(),
  }).optional(),
});
```

---

## Migration Path

### Phase 1: Foundation (Week 1-2)

1. Create comprehensive TypeScript type definitions
2. Implement authentication/authorization middleware
3. Add structured error responses
4. Set up API documentation (OpenAPI/Swagger)

### Phase 2: Execution API (Week 3-4)

1. Implement workflow execution endpoints
2. Add task management system
3. Create event store infrastructure
4. Implement basic webhook support

### Phase 3: Real-time (Week 5-6)

1. Implement WebSocket server
2. Add SSE endpoint for terminal output
3. Create subscription management
4. Add heartbeat/keep-alive logic

### Phase 4: Enhanced Features (Week 7-8)

1. Implement metrics/analytics API
2. Add pagination to all list endpoints
3. Create event history API
4. Add filtering and search capabilities

---

## Example Request/Response Bodies

### Execute Workflow

**Request:**
```http
POST /api/workflows/a1b2c3d4-e5f6-7890-abcd-ef1234567890/execute HTTP/1.1
Host: localhost:9889
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "input": {
    "prompt": "Analyze the codebase for security vulnerabilities",
    "repository": "https://github.com/example/repo"
  },
  "config": {
    "parallelExecution": true,
    "maxParallelNodes": 4,
    "errorHandling": "continue"
  }
}
```

**Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/executions/exec-1234567890-abcd-efgh

{
  "executionId": "exec-1234567890-abcd-efgh",
  "workflowId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "running",
  "startedAt": "2025-01-11T10:30:00.000Z",
  "workflow": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Security Analysis Pipeline",
    "description": "Multi-agent security analysis workflow"
  }
}
```

### Get Execution with Pagination

**Request:**
```http
GET /api/workflows/a1b2c3d4-e5f6-7890-abcd-ef1234567890/executions?page=1&limit=10&status=completed HTTP/1.1
Host: localhost:9889
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "executionId": "exec-1234567890-abcd-efgh",
      "workflowId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "completed",
      "startedAt": "2025-01-11T10:30:00.000Z",
      "completedAt": "2025-01-11T10:35:23.456Z",
      "nodes": {
        "node-1": {
          "nodeId": "node-1",
          "status": "completed",
          "terminalId": "term-abc123",
          "startedAt": "2025-01-11T10:30:05.000Z",
          "completedAt": "2025-01-11T10:32:15.000Z",
          "output": "Found 3 potential vulnerabilities..."
        }
      },
      "currentNodeId": null,
      "error": null
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "hasNext": true,
  "hasPrevious": false
}
```

### Error Response

**Request:**
```http
POST /api/workflows/invalid-id/execute HTTP/1.1
Host: localhost:9889
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Response:**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json
X-Request-ID: req-xyz789-abcd-efgh-1234

{
  "error": "Workflow not found",
  "code": "WORKFLOW_NOT_FOUND",
  "details": {
    "workflowId": "invalid-id",
    "suggestion": "Check the workflow ID or list available workflows"
  },
  "timestamp": "2025-01-11T10:30:00.000Z",
  "requestId": "req-xyz789-abcd-efgh-1234"
}
```

### WebSocket Message Flow

**Client:**
```json
{
  "type": "subscribe",
  "id": "sub-001",
  "timestamp": "2025-01-11T10:30:00.000Z",
  "payload": {
    "channels": ["workflows:a1b2c3d4-e5f6-7890-abcd-ef1234567890", "executions:*"],
    "filter": {
      "eventTypes": ["node.execution.started", "node.execution.completed", "agent.spawned"]
    }
  }
}
```

**Server (Ack):**
```json
{
  "type": "ack",
  "id": "ack-002",
  "timestamp": "2025-01-11T10:30:00.050Z",
  "payload": {
    "subscriptionId": "sub-xyz789",
    "channels": ["workflows:a1b2c3d4-e5f6-7890-abcd-ef1234567890", "executions:*"]
  }
}
```

**Server (Event):**
```json
{
  "type": "event",
  "id": "evt-003",
  "timestamp": "2025-01-11T10:30:05.123Z",
  "payload": {
    "id": "evt-abc123-def4-5678-90ab-cdef12345678",
    "type": "agent.spawned",
    "timestamp": "2025-01-11T10:30:05.100Z",
    "correlationId": "exec-1234567890-abcd-efgh",
    "data": {
      "executionId": "exec-1234567890-abcd-efgh",
      "nodeId": "node-1",
      "terminalId": "term-abc123",
      "provider": "claude_code",
      "agentProfile": "security-analyst"
    }
  }
}
```

---

## OpenAPI 3.1 Specification Summary

A complete OpenAPI specification should be generated based on the endpoints defined above. Key sections:

1. **Info**: Title, version, description
2. **Servers**: Development, staging, production URLs
3. **Security**: JWT Bearer authentication scheme
4. **Paths**: All endpoint definitions with:
   - Parameters (path, query, header)
   - Request body schemas
   - Response schemas (success and error)
   - Examples
5. **Components**: Reusable schemas for all types
6. **Tags**: Grouping by resource (sessions, workflows, terminals, etc.)

---

## Conclusion

This analysis provides a comprehensive foundation for building a robust API layer for the CLI Agent Orchestrator. Key recommendations:

1. **Prioritize WebSocket implementation** for real-time workflow execution updates
2. **Implement comprehensive error handling** with structured error responses
3. **Add authentication/authorization** before deploying to production
4. **Create OpenAPI specification** for API documentation and client generation
5. **Implement event store** for audit trail and debugging
6. **Add comprehensive testing** for all API endpoints

The existing type definitions provide a solid foundation, but need to be extended with:
- Pagination types
- Filter types
- Event schemas
- Authentication types
- Task management types

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-11
**Authors:** API Architecture Specialist
**Status:** Draft - Ready for Review
