/**
 * Event System Type Definitions
 *
 * Comprehensive type definitions for the event-driven architecture
 * of the CLI Agent Orchestrator. Events are emitted during workflow
 * execution and can be consumed via WebSocket or retrieved from
 * the event history API.
 */

// ============================================================================
// EVENT TYPE ENUMERATION
// ============================================================================

/**
 * All event types emitted by the CLI Agent Orchestrator system.
 * Events follow a naming convention: {resource}.{action}
 */
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

/**
 * Event categories for grouping
 */
export enum EventCategory {
  WORKFLOW = 'workflow',
  NODE = 'node',
  AGENT = 'agent',
  SESSION = 'session',
  TERMINAL = 'terminal',
  TASK = 'task',
  SYSTEM = 'system',
}

/**
 * Get event category from event type
 */
export function getEventCategory(eventType: EventType): EventCategory {
  const prefix = eventType.split('.')[0];
  return prefix as EventCategory;
}

// ============================================================================
// BASE EVENT INTERFACE
// ============================================================================

/**
 * Base interface for all events in the system.
 * All events must extend this interface.
 */
export interface BaseEvent {
  /** Unique event identifier (UUID) */
  id: string;
  /** Event type identifier */
  type: EventType;
  /** Timestamp when event was created (ISO 8601) */
  timestamp: string;
  /** ID for correlating related events */
  correlationId?: string;
  /** ID of the event that caused this event (causality chain) */
  causationId?: string;
  /** Source of the event (service/component name) */
  source?: string;
  /** Event version for schema evolution */
  version?: number;
}

// ============================================================================
// SPECIFIC EVENT INTERFACES
// ============================================================================

// -------------------------------------------------------------------------
// Workflow Events
// -------------------------------------------------------------------------

/**
 * Event emitted when a new workflow is created
 */
export interface WorkflowCreatedEvent extends BaseEvent {
  type: EventType.WORKFLOW_CREATED;
  data: {
    workflowId: string;
    name: string;
    createdBy?: string;
  };
}

/**
 * Event emitted when a workflow is updated
 */
export interface WorkflowUpdatedEvent extends BaseEvent {
  type: EventType.WORKFLOW_UPDATED;
  data: {
    workflowId: string;
    changes: {
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }[];
    updatedBy?: string;
  };
}

/**
 * Event emitted when a workflow is deleted
 */
export interface WorkflowDeletedEvent extends BaseEvent {
  type: EventType.WORKFLOW_DELETED;
  data: {
    workflowId: string;
    name: string;
    deletedBy?: string;
  };
}

/**
 * Event emitted when workflow execution starts
 */
export interface WorkflowExecutionStartedEvent extends BaseEvent {
  type: EventType.WORKFLOW_EXECUTION_STARTED;
  data: {
    workflowId: string;
    executionId: string;
    input?: Record<string, unknown>;
    config?: import('./workflow').WorkflowConfig;
    startedBy?: string;
  };
}

/**
 * Event emitted when workflow execution completes successfully
 */
export interface WorkflowExecutionCompletedEvent extends BaseEvent {
  type: EventType.WORKFLOW_EXECUTION_COMPLETED;
  data: {
    workflowId: string;
    executionId: string;
    duration: number;
    nodesCompleted: number;
    nodesFailed: number;
    output?: Record<string, unknown>;
  };
}

/**
 * Event emitted when workflow execution fails
 */
export interface WorkflowExecutionFailedEvent extends BaseEvent {
  type: EventType.WORKFLOW_EXECUTION_FAILED;
  data: {
    workflowId: string;
    executionId: string;
    duration: number;
    error: string;
    failedNodeId?: string;
    nodesCompleted: number;
  };
}

/**
 * Event emitted when workflow execution is paused
 */
export interface WorkflowExecutionPausedEvent extends BaseEvent {
  type: EventType.WORKFLOW_EXECUTION_PAUSED;
  data: {
    workflowId: string;
    executionId: string;
    currentNodeId?: string;
    pausedBy?: string;
  };
}

/**
 * Event emitted when workflow execution is resumed
 */
export interface WorkflowExecutionResumedEvent extends BaseEvent {
  type: EventType.WORKFLOW_EXECUTION_RESUMED;
  data: {
    workflowId: string;
    executionId: string;
    resumedBy?: string;
  };
}

// -------------------------------------------------------------------------
// Node Events
// -------------------------------------------------------------------------

/**
 * Event emitted when a node execution starts
 */
export interface NodeExecutionStartedEvent extends BaseEvent {
  type: EventType.NODE_EXECUTION_STARTED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: import('./workflow').BPMNElementType;
    nodeLabel: string;
    input?: Record<string, unknown>;
  };
}

/**
 * Event emitted when a node execution completes
 */
export interface NodeExecutionCompletedEvent extends BaseEvent {
  type: EventType.NODE_EXECUTION_COMPLETED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: import('./workflow').BPMNElementType;
    duration: number;
    output?: string;
    terminalId?: string;
  };
}

/**
 * Event emitted when a node execution fails
 */
export interface NodeExecutionFailedEvent extends BaseEvent {
  type: EventType.NODE_EXECUTION_FAILED;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: import('./workflow').BPMNElementType;
    duration: number;
    error: string;
    errorDetails?: unknown;
  };
}

/**
 * Event emitted when a node is skipped (e.g., in a gateway branch not taken)
 */
export interface NodeSkippedEvent extends BaseEvent {
  type: EventType.NODE_SKIPPED;
  data: {
    executionId: string;
    nodeId: string;
    reason: string;
  };
}

// -------------------------------------------------------------------------
// Agent Events
// -------------------------------------------------------------------------

/**
 * Event emitted when a new agent terminal is spawned
 */
export interface AgentSpawnedEvent extends BaseEvent {
  type: EventType.AGENT_SPAWNED;
  data: {
    executionId: string;
    nodeId: string;
    terminalId: string;
    provider: import('./cao').ProviderType;
    agentProfile: string;
    sessionName: string;
  };
}

/**
 * Event emitted when an agent terminal is terminated
 */
export interface AgentTerminatedEvent extends BaseEvent {
  type: EventType.AGENT_TERMINATED;
  data: {
    terminalId: string;
    executionId?: string;
    nodeId?: string;
    reason: string;
  };
}

/**
 * Event emitted when a task is assigned to an agent
 */
export interface AgentAssignedEvent extends BaseEvent {
  type: EventType.AGENT_ASSIGNED;
  data: {
    taskId: string;
    terminalId: string;
    executionId: string;
    nodeId: string;
    taskDescription: string;
  };
}

/**
 * Event emitted when a message is sent to an agent
 */
export interface AgentMessageSentEvent extends BaseEvent {
  type: EventType.AGENT_MESSAGE_SENT;
  data: {
    terminalId: string;
    message: string;
    executionId?: string;
    nodeId?: string;
  };
}

/**
 * Event emitted when a message is received from an agent
 */
export interface AgentMessageReceivedEvent extends BaseEvent {
  type: EventType.AGENT_MESSAGE_RECEIVED;
  data: {
    terminalId: string;
    message: string;
    messageType: 'output' | 'error' | 'status';
    executionId?: string;
  };
}

// -------------------------------------------------------------------------
// Session Events
// -------------------------------------------------------------------------

/**
 * Event emitted when a new session is created
 */
export interface SessionCreatedEvent extends BaseEvent {
  type: EventType.SESSION_CREATED;
  data: {
    sessionId: string;
    sessionName: string;
    workflowId?: string;
    provider: import('./cao').ProviderType;
    createdBy?: string;
  };
}

/**
 * Event emitted when a session is deleted
 */
export interface SessionDeletedEvent extends BaseEvent {
  type: EventType.SESSION_DELETED;
  data: {
    sessionId: string;
    sessionName: string;
    terminalsTerminated: number;
    deletedBy?: string;
  };
}

/**
 * Event emitted when a client attaches to a session
 */
export interface SessionAttachedEvent extends BaseEvent {
  type: EventType.SESSION_ATTACHED;
  data: {
    sessionId: string;
    sessionName: string;
    attachedBy: string;
  };
}

/**
 * Event emitted when a client detaches from a session
 */
export interface SessionDetachedEvent extends BaseEvent {
  type: EventType.SESSION_DETACHED;
  data: {
    sessionId: string;
    sessionName: string;
    detachedBy: string;
  };
}

// -------------------------------------------------------------------------
// Terminal Events
// -------------------------------------------------------------------------

/**
 * Event emitted when a new terminal is created
 */
export interface TerminalCreatedEvent extends BaseEvent {
  type: EventType.TERMINAL_CREATED;
  data: {
    terminalId: string;
    sessionId: string;
    provider: import('./cao').ProviderType;
    agentProfile: string;
  };
}

/**
 * Event emitted when a terminal is deleted
 */
export interface TerminalDeletedEvent extends BaseEvent {
  type: EventType.TERMINAL_DELETED;
  data: {
    terminalId: string;
    sessionId: string;
    reason: string;
  };
}

/**
 * Event emitted when a terminal's status changes
 */
export interface TerminalStatusChangedEvent extends BaseEvent {
  type: EventType.TERMINAL_STATUS_CHANGED;
  data: {
    terminalId: string;
    sessionId: string;
    oldStatus: import('./cao').TerminalStatus;
    newStatus: import('./cao').TerminalStatus;
  };
}

/**
 * Event emitted when a terminal produces output
 */
export interface TerminalOutputEvent extends BaseEvent {
  type: EventType.TERMINAL_OUTPUT;
  data: {
    terminalId: string;
    sessionId: string;
    output: string;
    outputType: 'stdout' | 'stderr' | 'mixed';
    timestamp: string;
  };
}

// -------------------------------------------------------------------------
// Task Events
// -------------------------------------------------------------------------

/**
 * Event emitted when a task is created
 */
export interface TaskCreatedEvent extends BaseEvent {
  type: EventType.TASK_CREATED;
  data: {
    taskId: string;
    workflowId: string;
    executionId: string;
    nodeId: string;
    priority: import('./api').TaskPriority;
    input?: Record<string, unknown>;
  };
}

/**
 * Event emitted when a task is assigned to an agent
 */
export interface TaskAssignedEvent extends BaseEvent {
  type: EventType.TASK_ASSIGNED;
  data: {
    taskId: string;
    agentId: string;
    terminalId?: string;
    assignedBy?: string;
  };
}

/**
 * Event emitted when a task starts execution
 */
export interface TaskStartedEvent extends BaseEvent {
  type: EventType.TASK_STARTED;
  data: {
    taskId: string;
    agentId: string;
    terminalId: string;
  };
}

/**
 * Event emitted when a task completes successfully
 */
export interface TaskCompletedEvent extends BaseEvent {
  type: EventType.TASK_COMPLETED;
  data: {
    taskId: string;
    agentId: string;
    duration: number;
    result?: unknown;
  };
}

/**
 * Event emitted when a task fails
 */
export interface TaskFailedEvent extends BaseEvent {
  type: EventType.TASK_FAILED;
  data: {
    taskId: string;
    agentId: string;
    duration: number;
    error: string;
    errorDetails?: unknown;
  };
}

// ============================================================================
// EVENT UNION
// ============================================================================

/**
 * Union type of all possible events
 */
export type Event =
  // Workflow Events
  | WorkflowCreatedEvent
  | WorkflowUpdatedEvent
  | WorkflowDeletedEvent
  | WorkflowExecutionStartedEvent
  | WorkflowExecutionCompletedEvent
  | WorkflowExecutionFailedEvent
  | WorkflowExecutionPausedEvent
  | WorkflowExecutionResumedEvent
  // Node Events
  | NodeExecutionStartedEvent
  | NodeExecutionCompletedEvent
  | NodeExecutionFailedEvent
  | NodeSkippedEvent
  // Agent Events
  | AgentSpawnedEvent
  | AgentTerminatedEvent
  | AgentAssignedEvent
  | AgentMessageSentEvent
  | AgentMessageReceivedEvent
  // Session Events
  | SessionCreatedEvent
  | SessionDeletedEvent
  | SessionAttachedEvent
  | SessionDetachedEvent
  // Terminal Events
  | TerminalCreatedEvent
  | TerminalDeletedEvent
  | TerminalStatusChangedEvent
  | TerminalOutputEvent
  // Task Events
  | TaskCreatedEvent
  | TaskAssignedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent;

// ============================================================================
// EVENT STORE INTERFACES
// ============================================================================

/**
 * Event filter for querying the event store
 */
export interface EventStoreFilter {
  /** Filter by event types */
  eventTypes?: EventType[];
  /** Filter by event category */
  categories?: EventCategory[];
  /** Filter by workflow ID */
  workflowId?: string;
  /** Filter by execution ID */
  executionId?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by terminal ID */
  terminalId?: string;
  /** Filter by correlation ID */
  correlationId?: string;
  /** Filter by time range (start) */
  from?: string;
  /** Filter by time range (end) */
  to?: string;
}

/**
 * Event store query with pagination
 */
export interface EventStoreQuery extends EventStoreFilter {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort by field */
  sortBy?: 'timestamp' | 'id';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated event store response
 */
export interface EventStoreResponse {
  /** Array of events */
  events: Event[];
  /** Total number of events matching the filter */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrevious: boolean;
}

/**
 * Event statistics for a workflow execution
 */
export interface EventStatistics {
  /** Total number of events */
  total: number;
  /** Count by event type */
  byType: Partial<Record<EventType, number>>;
  /** Count by category */
  byCategory: Partial<Record<EventCategory, number>>;
  /** First event timestamp */
  firstEventAt?: string;
  /** Last event timestamp */
  lastEventAt?: string;
}

// ============================================================================
// EVENT LISTENER INTERFACES
// ============================================================================

/**
 * Event listener function
 */
export type EventListener<T extends Event = Event> = (event: T) => void | Promise<void>;

/**
 * Event listener options
 */
export interface EventListenerOptions {
  /** Whether to listen only once */
  once?: boolean;
  /** Filter for events to receive */
  filter?: EventStoreFilter;
  /** Priority for listener execution (higher = earlier) */
  priority?: number;
}

/**
 * Event subscription handle
 */
export interface EventSubscription {
  /** Unique subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe: () => void;
  /** Check if still subscribed */
  isSubscribed: () => boolean;
}

// ============================================================================
// EVENT TYPE GUARDS
// ============================================================================

/**
 * Check if event is a workflow event
 */
export function isWorkflowEvent(event: Event): event is WorkflowCreatedEvent | WorkflowUpdatedEvent | WorkflowDeletedEvent | WorkflowExecutionStartedEvent | WorkflowExecutionCompletedEvent | WorkflowExecutionFailedEvent | WorkflowExecutionPausedEvent | WorkflowExecutionResumedEvent {
  return event.type.startsWith('workflow.');
}

/**
 * Check if event is a node event
 */
export function isNodeEvent(event: Event): event is NodeExecutionStartedEvent | NodeExecutionCompletedEvent | NodeExecutionFailedEvent | NodeSkippedEvent {
  return event.type.startsWith('node.');
}

/**
 * Check if event is an agent event
 */
export function isAgentEvent(event: Event): event is AgentSpawnedEvent | AgentTerminatedEvent | AgentAssignedEvent | AgentMessageSentEvent | AgentMessageReceivedEvent {
  return event.type.startsWith('agent.');
}

/**
 * Check if event is a terminal event
 */
export function isTerminalEvent(event: Event): event is TerminalCreatedEvent | TerminalDeletedEvent | TerminalStatusChangedEvent | TerminalOutputEvent {
  return event.type.startsWith('terminal.');
}

/**
 * Check if event is a session event
 */
export function isSessionEvent(event: Event): event is SessionCreatedEvent | SessionDeletedEvent | SessionAttachedEvent | SessionDetachedEvent {
  return event.type.startsWith('session.');
}

/**
 * Check if event is a task event
 */
export function isTaskEvent(event: Event): event is TaskCreatedEvent | TaskAssignedEvent | TaskStartedEvent | TaskCompletedEvent | TaskFailedEvent {
  return event.type.startsWith('task.');
}

// ============================================================================
// EVENT FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a base event structure
 */
export function createBaseEvent(
  type: EventType,
  correlationId?: string,
  causationId?: string,
): Omit<BaseEvent, 'id' | 'timestamp'> {
  return {
    type,
    correlationId,
    causationId,
    source: 'cli-agent-orchestrator',
    version: 1,
  };
}

/**
 * Create event ID (UUID v4)
 */
export function createEventId(): string {
  return 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
}

/**
 * Create correlation ID for tracing related events
 */
export function createCorrelationId(): string {
  return 'corr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
}

// ============================================================================
// EVENT SERIALIZATION / DESERIALIZATION
// ============================================================================

/**
 * Serialize an event to JSON string
 */
export function serializeEvent(event: Event): string {
  return JSON.stringify(event);
}

/**
 * Deserialize an event from JSON string
 */
export function deserializeEvent(json: string): Event {
  return JSON.parse(json);
}

/**
 * Validate an event object
 */
export function isValidEvent(obj: unknown): obj is Event {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const event = obj as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    Object.values(EventType).includes(event.type as EventType) &&
    typeof event.timestamp === 'string' &&
    typeof event.data === 'object'
  );
}
