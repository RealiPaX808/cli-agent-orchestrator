import { TerminalStatus, ProviderType } from './cao';
import { Node, Edge } from '@xyflow/react';

// Chain node types
export enum ChainNodeType {
  SESSION = 'session',
  TERMINAL = 'terminal',
  AGENT = 'agent',
  INPUT = 'input',
  OUTPUT = 'output',
}

// Data flow direction
export enum FlowDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  BIDIRECTIONAL = 'bidirectional',
}

// Activity state for visualization
export enum ActivityState {
  ACTIVE = 'active',       // Currently processing
  IDLE = 'idle',           // Waiting but available
  COMPLETED = 'completed', // Finished work
  ERROR = 'error',         // Error state
  WAITING = 'waiting',     // Waiting for permission/user input
}

// Extended node data for chain visualization
export interface ChainNodeData extends Record<string, unknown> {
  id: string;
  type: ChainNodeType;
  label: string;
  status?: TerminalStatus | ActivityState;
  provider?: ProviderType;
  agentProfile?: string;
  lastActive?: string;
  metadata?: Record<string, unknown>;
}

// Edge data for connections between nodes
export interface ChainEdgeData extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
  direction: FlowDirection;
  label?: string;
  active?: boolean; // Is data currently flowing?
  dataFlow?: {
    bytesTransferred?: number;
    lastTransfer?: string;
    transferRate?: number;
  };
}

// Complete chain structure
export interface AgentChain {
  sessionId: string;
  sessionName: string;
  nodes: ChainNodeData[];
  edges: ChainEdgeData[];
}

// Mini chain representation for dashboard overview
export interface ChainSummary {
  sessionId: string;
  sessionName: string;
  terminalCount: number;
  activeTerminals: number;
  status: 'healthy' | 'warning' | 'error' | 'idle';
  lastActivity: string;
}

// Animation state for interactive elements
export interface AnimationState {
  pulse?: boolean;    // Pulse effect for active nodes
  flow?: boolean;     // Flow animation for edges
  highlight?: string; // Node ID to highlight
}

// Properly typed React Flow types
export type ChainNode = Node<ChainNodeData>;
export type ChainEdge = Edge<ChainEdgeData> & ChainEdgeData;
