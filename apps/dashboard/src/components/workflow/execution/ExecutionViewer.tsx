"use client";

import { useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowAgentNode } from '../nodes/WorkflowAgentNode';
import { Workflow, WorkflowExecution, WorkflowExecutionStatus } from '@/types/workflow';
import { WorkflowEngine } from '@/lib/workflow-engine';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import ExpandableSection from '@cloudscape-design/components/expandable-section';

const nodeTypes = {
  agent_spawn: WorkflowAgentNode,
  handoff: WorkflowAgentNode,
  assign: WorkflowAgentNode,
  send_message: WorkflowAgentNode,
};

interface ExecutionViewerProps {
  workflow: Workflow;
}

export function ExecutionViewer({ workflow }: ExecutionViewerProps) {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const enrichedNodes = workflow.nodes.map(node => {
    const nodeExec = execution?.nodes.get(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        status: nodeExec?.status,
        terminalId: nodeExec?.terminalId,
        error: nodeExec?.error,
      },
    };
  });

  const handleExecute = useCallback(async () => {
    setIsRunning(true);
    
    const newEngine = new WorkflowEngine(workflow, (updatedExecution) => {
      setExecution(updatedExecution);
    });

    try {
      const result = await newEngine.execute();
      setExecution(result);
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [workflow]);

  const getExecutionStatusIndicator = () => {
    if (!execution) {
      return <StatusIndicator type="pending">Not started</StatusIndicator>;
    }

    switch (execution.status) {
      case WorkflowExecutionStatus.IDLE:
        return <StatusIndicator type="pending">Idle</StatusIndicator>;
      case WorkflowExecutionStatus.RUNNING:
        return <StatusIndicator type="in-progress">Running</StatusIndicator>;
      case WorkflowExecutionStatus.PAUSED:
        return <StatusIndicator type="warning">Paused</StatusIndicator>;
      case WorkflowExecutionStatus.COMPLETED:
        return <StatusIndicator type="success">Completed</StatusIndicator>;
      case WorkflowExecutionStatus.FAILED:
        return <StatusIndicator type="error">Failed</StatusIndicator>;
      default:
        return <StatusIndicator type="pending">Unknown</StatusIndicator>;
    }
  };

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getExecutionDuration = () => {
    if (!execution?.startedAt) return 'N/A';
    
    const start = new Date(execution.startedAt).getTime();
    const end = execution.completedAt 
      ? new Date(execution.completedAt).getTime() 
      : Date.now();
    
    const durationMs = end - start;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <SpaceBetween size="l">
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    onClick={handleExecute}
                    disabled={isRunning}
                    loading={isRunning}
                    variant="primary"
                    iconName="status-in-progress"
                  >
                    {execution ? 'Re-execute' : 'Execute'}
                  </Button>
                </SpaceBetween>
              }
            >
              Execution Status
            </Header>
          }
        >
          <ColumnLayout columns={4} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Status</Box>
              <div>{getExecutionStatusIndicator()}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Started At</Box>
              <div>{formatTimestamp(execution?.startedAt)}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Completed At</Box>
              <div>{formatTimestamp(execution?.completedAt)}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Duration</Box>
              <div>{getExecutionDuration()}</div>
            </div>
          </ColumnLayout>

          {execution?.error && (
            <Box margin={{ top: 'm' }} color="text-status-error">
              <strong>Error:</strong> {execution.error}
            </Box>
          )}
        </Container>

        <Container
          header={<Header variant="h2">Workflow Visualization</Header>}
        >
          <div style={{ height: '500px', position: 'relative' }}>
            <ReactFlow
              nodes={enrichedNodes}
              edges={workflow.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#2d3f4f" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </Container>

        {execution && execution.nodes.size > 0 && (
          <Container
            header={<Header variant="h2">Node Execution Details</Header>}
          >
            <SpaceBetween size="m">
              {Array.from(execution.nodes.entries()).map(([nodeId, nodeExec]) => {
                const node = workflow.nodes.find(n => n.id === nodeId);
                if (!node) return null;

                return (
                  <ExpandableSection
                    key={nodeId}
                    headerText={`${node.data.label} (${node.data.type})`}
                    variant="container"
                  >
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Status</Box>
                        <div>
                          {nodeExec.status === WorkflowExecutionStatus.RUNNING && (
                            <StatusIndicator type="in-progress">Running</StatusIndicator>
                          )}
                          {nodeExec.status === WorkflowExecutionStatus.COMPLETED && (
                            <StatusIndicator type="success">Completed</StatusIndicator>
                          )}
                          {nodeExec.status === WorkflowExecutionStatus.FAILED && (
                            <StatusIndicator type="error">Failed</StatusIndicator>
                          )}
                        </div>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Terminal ID</Box>
                        <div>{nodeExec.terminalId || 'N/A'}</div>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Started At</Box>
                        <div>{formatTimestamp(nodeExec.startedAt)}</div>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Completed At</Box>
                        <div>{formatTimestamp(nodeExec.completedAt)}</div>
                      </div>
                    </ColumnLayout>

                    {nodeExec.output && (
                      <Box margin={{ top: 'm' }}>
                        <Box variant="awsui-key-label">Output</Box>
                        <Box
                          padding="s"
                          margin={{ top: 'xs' }}
                        >
                          <code style={{ whiteSpace: 'pre-wrap' }}>{nodeExec.output}</code>
                        </Box>
                      </Box>
                    )}

                    {nodeExec.error && (
                      <Box margin={{ top: 'm' }} color="text-status-error">
                        <Box variant="awsui-key-label">Error</Box>
                        <Box
                          padding="s"
                          margin={{ top: 'xs' }}
                        >
                          <code style={{ whiteSpace: 'pre-wrap' }}>{nodeExec.error}</code>
                        </Box>
                      </Box>
                    )}
                  </ExpandableSection>
                );
              })}
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </div>
  );
}
