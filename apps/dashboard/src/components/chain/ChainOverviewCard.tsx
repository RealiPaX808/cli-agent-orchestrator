"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './index';
import { ChainNodeType, ChainNode, ChainEdge } from '@/types/chain';
import { Node as ReactFlowNode } from '@xyflow/react';
import { Session, TerminalStatus, ProviderType } from '@/types/cao';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Workflow } from '@/types/workflow';
import { caoClient } from '@/lib/api-client';

interface ChainOverviewCardProps {
  sessions: Session[];
  className?: string;
}

// Create terminal nodes for a single session - NO session node, only terminals
const createTerminalNodes = (session: Session): ChainNode[] => {
  const nodes: ChainNode[] = [];
  const terminals = session.terminals ?? [];

  // Position terminals in a tree/grid layout
  terminals.forEach((terminal, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    nodes.push({
      id: terminal.id,
      type: 'terminal',
      position: { x: 50 + col * 160, y: 50 + row * 140 },
      data: {
        id: terminal.id,
        type: ChainNodeType.TERMINAL,
        label: (terminal.name || terminal.id).length > 18
          ? (terminal.name || terminal.id).slice(0, 18) + '...'
          : (terminal.name || terminal.id),
        status: terminal.status,
        provider: terminal.provider,
      },
    } as ChainNode);
  });

  return nodes;
};

// Create edges between sequential terminals
const createTerminalEdges = (session: Session): ChainEdge[] => {
  const edges: ChainEdge[] = [];
  const terminals = session.terminals ?? [];

  // Create edges between consecutive terminals to show the chain
  for (let i = 0; i < terminals.length - 1; i++) {
    const from = terminals[i];
    const to = terminals[i + 1];

    // Animate edge if either terminal is processing
    const isAnimated = from.status === TerminalStatus.PROCESSING || to.status === TerminalStatus.PROCESSING;
    const strokeColor = isAnimated ? '#4299e1' : '#2d3f4f';

    edges.push({
      id: `edge-${from.id}-${to.id}`,
      source: from.id,
      target: to.id,
      type: 'default',
      animated: isAnimated,
      data: {
        id: `edge-${from.id}-${to.id}`,
        source: from.id,
        target: to.id,
        direction: 'outgoing' as const,
      },
      style: {
        stroke: strokeColor,
        strokeWidth: 2,
      },
    } as ChainEdge);
  }

  return edges;
};

export const ChainOverviewCard = ({ sessions, className }: ChainOverviewCardProps) => {
  const router = useRouter();
  // State for selected session
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);

  // Update selected session index when sessions change
  useMemo(() => {
    if (sessions.length === 0) {
      setSelectedSessionIndex(0);
    } else if (selectedSessionIndex >= sessions.length) {
      setSelectedSessionIndex(sessions.length - 1);
    }
  }, [sessions, selectedSessionIndex]);

  const selectedSession = sessions[selectedSessionIndex];

  useEffect(() => {
    if (!selectedSession) {
      setWorkflow(null);
      return;
    }

    const loadWorkflow = async () => {
      try {
        const sessionWorkflow = await caoClient.getSessionWorkflow(selectedSession.name);
        setWorkflow(sessionWorkflow);
      } catch (error) {
        // Session has no workflow assigned - this is normal, not an error
        setWorkflow(null);
      }
    };

    loadWorkflow();
  }, [selectedSession]);

  // Create nodes and edges from workflow OR fallback to terminal layout
  const initialNodes = useMemo(() => {
    if (!selectedSession) return [];
    
    // If workflow exists and has nodes, use workflow nodes
    if (workflow && workflow.nodes.length > 0) {
      // Convert workflow nodes to chain nodes
      return workflow.nodes.map(node => ({
        id: node.id,
        type: 'terminal',
        position: node.position,
        data: {
          id: node.id,
          type: ChainNodeType.TERMINAL,
          label: node.data.label,
          status: TerminalStatus.IDLE,
          provider: ('provider' in node.data.config ? node.data.config.provider : 'q_cli') as ProviderType,
        },
      } as ChainNode));
    }
    
    // Fallback to terminal grid layout
    return createTerminalNodes(selectedSession);
  }, [selectedSession, workflow]);

  const initialEdges = useMemo(() => {
    if (!selectedSession) return [];
    
    // If workflow exists and has edges, use workflow edges
    if (workflow && workflow.edges.length > 0) {
      return workflow.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'default',
        animated: false,
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          direction: 'outgoing' as const,
        },
        style: {
          stroke: '#2d3f4f',
          strokeWidth: 2,
        },
      } as ChainEdge));
    }
    
    // Fallback to sequential terminal edges
    return createTerminalEdges(selectedSession);
  }, [selectedSession, workflow]);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onNodeClick = useCallback(
    (_: unknown, node: ReactFlowNode) => {
      if (node.type === 'terminal') {
        const terminalId = node.id;
        router.push(`/terminals/${terminalId}`);
      }
    },
    [router]
  );

  if (sessions.length === 0) {
    return (
      <div className={className} style={{ padding: '40px', textAlign: 'center', color: '#9ba7b2' }}>
        No active sessions to visualize
      </div>
    );
  }

  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: '450px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .chain-overview-card .react-flow__edge-path {
          stroke-width: 2px;
        }
        .chain-overview-card .react-flow__node {
          cursor: pointer;
          transition: filter 0.15s ease;
        }
        .chain-overview-card .react-flow__node:hover {
          filter: brightness(1.3);
        }
      `}</style>

      {/* Session Switcher - Button Group */}
      <div style={{
        padding: '12px 16px',
        background: '#0f1722',
        borderBottom: '1px solid #2d3f4f',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <span style={{ color: '#9ba7b2', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}>
          Session:
        </span>

        <SpaceBetween direction="horizontal" size="xs">
          {sessions.map((session, index) => (
            <Button
              key={session.id}
              variant={index === selectedSessionIndex ? 'primary' : 'normal'}
              onClick={() => setSelectedSessionIndex(index)}
            >
              {session.name}
            </Button>
          ))}
        </SpaceBetween>

        {selectedSession && (
          <>
            <span style={{
              marginLeft: 'auto',
              color: '#9ba7b2',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}>
              {workflow && workflow.nodes.length > 0 
                ? `${workflow.nodes.length} workflow node${workflow.nodes.length !== 1 ? 's' : ''}` 
                : `${selectedSession.terminals?.length || 0} terminal${(selectedSession.terminals?.length || 0) !== 1 ? 's' : ''}`
              }
            </span>
            {workflow && workflow.nodes.length > 0 && (
              <Button
                iconName="edit"
                variant="inline-link"
                onClick={() => router.push(`/workflows/${workflow.id}`)}
              >
                Edit Workflow
              </Button>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 1, minHeight: '350px' }}>
        {selectedSession && (nodes.length > 0 || (workflow && workflow.nodes.length > 0)) ? (
          <ReactFlow<ChainNode, ChainEdge>
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            defaultEdgeOptions={{
              animated: false,
              style: { stroke: '#2d3f4f', strokeWidth: 2 },
            }}
            minZoom={0.3}
            maxZoom={1.5}
            panOnScroll
            zoomOnScroll={false}
            className="chain-overview-card"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={12}
              size={1}
              color="#2d3f4f"
            />
          </ReactFlow>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#9ba7b2',
            gap: '12px',
          }}>
            <div>No workflow configured for this session</div>
            {selectedSession && (
              <Button
                variant="primary"
                iconName="add-plus"
                onClick={() => router.push(`/workflows/session-${selectedSession.name}`)}
              >
                Create Workflow
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
