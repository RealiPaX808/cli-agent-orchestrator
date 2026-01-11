/**
 * WebSocket Protocol Type Definitions
 *
 * Defines the message contract for WebSocket communication between
 * the CLI Agent Orchestrator backend and frontend clients.
 */

// ============================================================================
// MESSAGE TYPE ENUMERATIONS
// ============================================================================

/**
 * Types of messages that can be sent over the WebSocket connection.
 * Client->Server: subscribe, unsubscribe, pong
 * Server->Client: event, heartbeat, ack, error
 */
export enum MessageType {
  // Client -> Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  PONG = 'pong',

  // Server -> Client
  EVENT = 'event',
  HEARTBEAT = 'heartbeat',
  ACK = 'ack',
  ERROR = 'error',
}

/**
 * WebSocket error codes
 */
export enum WSErrorCode {
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  AUTHORIZATION_FAILED = 'AUTHZ_FAILED',
  INVALID_SUBSCRIPTION = 'INVALID_SUB',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONNECTION_TIMEOUT = 'CONN_TIMEOUT',
}

// ============================================================================
// BASE MESSAGE INTERFACE
// ============================================================================

/**
 * Base interface for all WebSocket messages
 */
export interface BaseWebSocketMessage {
  /** Message type identifier */
  type: MessageType;
  /** Unique message ID for correlation */
  id: string;
  /** ISO 8601 timestamp when message was created */
  timestamp: string;
  /** Message payload (varies by type) */
  payload?: unknown;
}

// ============================================================================
// CLIENT -> SERVER MESSAGES
// ============================================================================

/**
 * Subscribe to one or more event channels
 */
export interface SubscribeMessage extends BaseWebSocketMessage {
  type: MessageType.SUBSCRIBE;
  payload: {
    /** List of channel names to subscribe to */
    channels: string[];
    /** Optional filter for events */
    filter?: EventFilter;
  };
}

/**
 * Unsubscribe from one or more event channels
 */
export interface UnsubscribeMessage extends BaseWebSocketMessage {
  type: MessageType.UNSUBSCRIBE;
  payload: {
    /** List of channel names to unsubscribe from */
    channels: string[];
  };
}

/**
 * Pong response to server heartbeat
 */
export interface PongMessage extends BaseWebSocketMessage {
  type: MessageType.PONG;
  payload: {
    /** Client timestamp for latency measurement */
    clientTime: string;
  };
}

// ============================================================================
// SERVER -> CLIENT MESSAGES
// ============================================================================

/**
 * Acknowledgment of successful subscription
 */
export interface SubscribeAckMessage extends BaseWebSocketMessage {
  type: MessageType.ACK;
  payload: {
    /** Unique subscription ID */
    subscriptionId: string;
    /** List of subscribed channels */
    channels: string[];
  };
}

/**
 * Event notification pushed to subscribed clients
 */
export interface EventMessage extends BaseWebSocketMessage {
  type: MessageType.EVENT;
  payload: BaseEvent;
}

/**
 * Heartbeat message sent every 30 seconds
 */
export interface HeartbeatMessage extends BaseWebSocketMessage {
  type: MessageType.HEARTBEAT;
  payload: {
    /** Server current time */
    serverTime: string;
  };
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseWebSocketMessage {
  type: MessageType.ERROR;
  payload: {
    /** Error code */
    code: WSErrorCode;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: unknown;
  };
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Re-import EventType from api.ts for convenience
 */
import { EventType } from './api';
export { EventType };

/**
 * Base event interface
 */
export interface BaseEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: EventType;
  /** Event timestamp */
  timestamp: string;
  /** Correlation ID for tracing related events */
  correlationId?: string;
  /** Causation ID for event chain tracking */
  causationId?: string;
}

/**
 * Event data for workflow execution started
 */
export interface WorkflowExecutionStartedEventData {
  workflowId: string;
  executionId: string;
  input?: Record<string, unknown>;
  config?: import('./workflow').WorkflowConfig;
}

/**
 * Event data for node execution started
 */
export interface NodeExecutionStartedEventData {
  executionId: string;
  nodeId: string;
  nodeType: import('./workflow').BPMNElementType;
  input?: Record<string, unknown>;
}

/**
 * Event data for agent spawned
 */
export interface AgentSpawnedEventData {
  executionId: string;
  nodeId: string;
  terminalId: string;
  provider: import('./cao').ProviderType;
  agentProfile: string;
}

/**
 * Event data for terminal output
 */
export interface TerminalOutputEventData {
  terminalId: string;
  output: string;
  timestamp: string;
}

/**
 * Complete event with typed data
 */
export interface TypedEvent<T = Record<string, unknown>> extends BaseEvent {
  data: T;
}

// ============================================================================
// CHANNEL DEFINITIONS
// ============================================================================

/**
 * Channel name patterns for subscriptions
 * Format: {resource}:{action}:{identifier}
 *
 * Examples:
 * - "sessions:*" - All session events
 * - "sessions:created" - New sessions
 * - "sessions:{sessionId}" - Events for specific session
 * - "workflows:{workflowId}" - Events for specific workflow
 * - "executions:{executionId}" - Events for specific execution
 * - "terminals:{terminalId}" - Output for specific terminal
 * - "system:metrics" - System metrics updates
 */
export type ChannelName =
  | `sessions:${string | '*'}`
  | `workflows:${string | '*'}`
  | `executions:${string | '*'}`
  | `terminals:${string | '*'}`
  | `tasks:${string | '*'}`
  | `agents:${string | '*'}`
  | 'system:metrics'
  | 'system:*';

/**
 * Validates if a string is a valid channel name
 */
export function isValidChannelName(channel: string): channel is ChannelName {
  const validPrefixes = ['sessions', 'workflows', 'executions', 'terminals', 'tasks', 'agents', 'system'];
  const [prefix] = channel.split(':');

  return validPrefixes.includes(prefix);
}

// ============================================================================
// EVENT FILTER
// ============================================================================

/**
 * Filter for event subscriptions
 */
export interface EventFilter {
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by workflow ID */
  workflowId?: string;
  /** Filter by execution ID */
  executionId?: string;
  /** Filter by event types */
  eventTypes?: EventType[];
}

// ============================================================================
// WEBSOCKET CLIENT STATE
// ============================================================================

/**
 * WebSocket connection state
 */
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Active subscription information
 */
export interface Subscription {
  /** Subscription ID from server */
  subscriptionId: string;
  /** Subscribed channels */
  channels: string[];
  /** Applied filter */
  filter?: EventFilter;
  /** When subscription was created */
  createdAt: string;
}

/**
 * WebSocket client state
 */
export interface WebSocketClientState {
  /** Current connection state */
  state: ConnectionState;
  /** Active subscriptions */
  subscriptions: Map<string, Subscription>;
  /** Last heartbeat received */
  lastHeartbeat?: string;
  /** Connection URL */
  url: string;
  /** Reconnection attempt count */
  reconnectAttempts: number;
}

// ============================================================================
// WEBSOCKET CLIENT CONFIG
// ============================================================================

/**
 * Configuration for WebSocket client
 */
export interface WebSocketClientConfig {
  /** WebSocket server URL */
  url: string;
  /** Authentication token */
  token: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Message handlers */
  onMessage?: (message: WebSocketMessage) => void;
  onEvent?: (event: BaseEvent) => void;
  onError?: (error: ErrorMessage) => void;
  onStateChange?: (state: ConnectionState) => void;
}

// ============================================================================
// MESSAGE TYPE GUARDS
// ============================================================================

/**
 * Type guard for SubscribeMessage
 */
export function isSubscribeMessage(msg: BaseWebSocketMessage): msg is SubscribeMessage {
  return msg.type === MessageType.SUBSCRIBE;
}

/**
 * Type guard for UnsubscribeMessage
 */
export function isUnsubscribeMessage(msg: BaseWebSocketMessage): msg is UnsubscribeMessage {
  return msg.type === MessageType.UNSUBSCRIBE;
}

/**
 * Type guard for EventMessage
 */
export function isEventMessage(msg: BaseWebSocketMessage): msg is EventMessage {
  return msg.type === MessageType.EVENT;
}

/**
 * Type guard for HeartbeatMessage
 */
export function isHeartbeatMessage(msg: BaseWebSocketMessage): msg is HeartbeatMessage {
  return msg.type === MessageType.HEARTBEAT;
}

/**
 * Type guard for ErrorMessage
 */
export function isErrorMessage(msg: BaseWebSocketMessage): msg is ErrorMessage {
  return msg.type === MessageType.ERROR;
}

/**
 * Type guard for SubscribeAckMessage
 */
export function isSubscribeAckMessage(msg: BaseWebSocketMessage): msg is SubscribeAckMessage {
  return msg.type === MessageType.ACK;
}

// ============================================================================
// UNION TYPE FOR ALL MESSAGES
// ============================================================================

/**
 * Union type of all possible WebSocket messages
 */
export type WebSocketMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | PongMessage
  | SubscribeAckMessage
  | EventMessage
  | HeartbeatMessage
  | ErrorMessage;

// ============================================================================
// EVENT FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a subscribe message
 */
export function createSubscribeMessage(
  channels: string[],
  filter?: EventFilter,
): SubscribeMessage {
  return {
    type: MessageType.SUBSCRIBE,
    id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    payload: {
      channels,
      filter,
    },
  };
}

/**
 * Create an unsubscribe message
 */
export function createUnsubscribeMessage(channels: string[]): UnsubscribeMessage {
  return {
    type: MessageType.UNSUBSCRIBE,
    id: `unsub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    payload: {
      channels,
    },
  };
}

/**
 * Create a pong message
 */
export function createPongMessage(): PongMessage {
  return {
    type: MessageType.PONG,
    id: `pong-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    payload: {
      clientTime: new Date().toISOString(),
    },
  };
}
