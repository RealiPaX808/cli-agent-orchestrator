"use client";

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes } from './index';
import { ChainNodeType, FlowDirection, ChainNode, ChainEdge } from '@/types/chain';
import { Session, Terminal, TerminalStatus } from '@/types/cao';

interface ChainVisualizationProps {
  session: Session & { terminals?: Terminal[] };
  onTerminalClick?: (terminal: Terminal) => void;
  readonly?: boolean;
  className?: string;
}

// Convert terminal to node
const terminalToNode = (terminal: Terminal, index: number): ChainNode => ({
  id: terminal.id,
  type: 'terminal',
  position: { x: 250 + (index % 3) * 280, y: 100 + Math.floor(index / 3) * 200 },
  data: {
    id: terminal.id,
    type: ChainNodeType.TERMINAL,
    label: terminal.name || terminal.id,
    status: terminal.status,
    provider: terminal.provider,
    agentProfile: terminal.agent_profile,
    lastActive: terminal.last_active,
  },
} as ChainNode);

// Convert session to node
const sessionToNode = (session: Session): ChainNode => ({
  id: `session-${session.id}`,
  type: 'session',
  position: { x: 50, y: 50 },
  data: {
    id: session.id,
    type: ChainNodeType.SESSION,
    label: session.name,
    metadata: {
      terminalCount: session.terminals?.length || 0,
      activeTerminals: session.terminals?.filter(t => t.status === TerminalStatus.PROCESSING).length || 0,
    },
  },
} as ChainNode);

// Create edges between terminals based on data flow
const createTerminalEdges = (terminals: Terminal[]): ChainEdge[] => {
  const edges: ChainEdge[] = [];
  const processingTerminals = terminals.filter(t => t.status === TerminalStatus.PROCESSING);

  for (let i = 0; i < terminals.length - 1; i++) {
    const isSourceActive = terminals[i].status === TerminalStatus.PROCESSING;
    const isTargetProcessing = terminals[i + 1].status === TerminalStatus.PROCESSING;

    edges.push({
      id: `edge-${terminals[i].id}-${terminals[i + 1].id}`,
      source: terminals[i].id,
      target: terminals[i + 1].id,
      type: 'dataflow',
      animated: isSourceActive,
      data: {
        id: `edge-${terminals[i].id}-${terminals[i + 1].id}`,
        source: terminals[i].id,
        target: terminals[i + 1].id,
        direction: FlowDirection.OUTGOING,
        active: isSourceActive && isTargetProcessing,
        label: isSourceActive ? 'Active' : undefined,
      },
      style: {
        stroke: isSourceActive ? '#4299e1' : '#4a5568',
        strokeWidth: 2,
      },
    } as ChainEdge);
  }

  // Connect session to first terminal
  if (terminals.length > 0) {
    edges.push({
      id: `edge-session-${terminals[0].id}`,
      source: `session-${terminals[0].session_name}`,
      target: terminals[0].id,
      type: 'dataflow',
      animated: processingTerminals.length > 0,
      data: {
        id: `edge-session-${terminals[0].id}`,
        source: `session-${terminals[0].session_name}`,
        target: terminals[0].id,
        direction: FlowDirection.OUTGOING,
        active: processingTerminals.length > 0,
      },
    } as ChainEdge);
  }

  return edges;
};

export const ChainVisualization = ({
  session,
  onTerminalClick,
  readonly = false,
  className,
}: ChainVisualizationProps) => {
  const terminals = session.terminals ?? [];

  // Create stable key for terminals to prevent unnecessary re-renders
  const terminalsKey = useMemo(
    () => `${terminals.length}-${terminals.map(t => t.id).join('-')}`,
    [terminals]
  );

  // Initial nodes
  const initialNodes: ChainNode[] = useMemo(() => {
    const nodes: ChainNode[] = [sessionToNode(session)];
    terminals.forEach((terminal, index) => {
      nodes.push(terminalToNode(terminal, index));
    });
    return nodes;
  }, [session.id, session.name, terminalsKey]);

  // Initial edges
  const initialEdges: ChainEdge[] = useMemo(() => {
    return createTerminalEdges(terminals);
  }, [terminalsKey]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => readonly || setEdges((eds: ChainEdge[]) => addEdge(params, eds) as ChainEdge[]),
    [readonly, setEdges]
  );

  const onNodeClick = useCallback(
    (_: unknown, node: ChainNode) => {
      if (node.type === 'terminal' && onTerminalClick) {
        const terminal = terminals.find(t => t.id === node.id);
        if (terminal) {
          onTerminalClick(terminal);
        }
      }
    },
    [terminals, onTerminalClick]
  );

  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <style>{`
        @keyframes dashFlow {
          from { stroke-dashoffset: 12; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .react-flow__edge-path {
          transition: stroke 0.3s ease, stroke-width 0.3s ease;
        }
        .react-flow__node {
          transition: transform 0.2s ease;
        }
        .react-flow__node.selected {
          z-index: 10;
        }
        .react-flow__handle {
          transition: all 0.2s ease;
        }
        .react-flow__minimap {
          background: #0b1d2e !important;
          border: 1px solid #2d3f4f !important;
        }
        .react-flow__minimap-mask {
          fill: #1a202c !important;
        }
        .react-flow__controls {
          button {
            background: #1a202c !important;
            border: 1px solid #2d3f4f !important;
            fill: #9ba7b2 !important;
          }
          button:hover {
            background: #2d3748 !important;
            border-color: #4299e1 !important;
          }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readonly ? undefined : onNodesChange}
        onEdgesChange={readonly ? undefined : onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          animated: false,
          style: { stroke: '#4a5568', strokeWidth: 2 },
        }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#2d3f4f"
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'session') return '#1a202c';
            const status = (node.data as any).status;
            if (status === TerminalStatus.PROCESSING) return '#0073bb';
            if (status === TerminalStatus.COMPLETED) return '#037f0c';
            if (status === TerminalStatus.ERROR) return '#d91515';
            return '#0b1d2e';
          }}
          maskColor="rgba(11, 29, 46, 0.6)"
        />
      </ReactFlow>
    </div>
  );
};
