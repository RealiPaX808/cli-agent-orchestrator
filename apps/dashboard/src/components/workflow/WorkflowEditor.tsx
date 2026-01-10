"use client";

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Connection,
  Panel,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowAgentNode } from './nodes/WorkflowAgentNode';
import { WebhookNode } from './nodes/WebhookNode';
import { XorGateNode } from './nodes/XorGateNode';
import { AndGateNode } from './nodes/AndGateNode';
import { OrGateNode } from './nodes/OrGateNode';
import { Workflow, WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@/types/workflow';
import { ProviderType } from '@/types/cao';
import { WorkflowStorage } from '@/lib/workflow-storage';
import { caoClient } from '@/lib/api-client';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import Textarea from '@cloudscape-design/components/textarea';
import Checkbox from '@cloudscape-design/components/checkbox';

const nodeTypes = {
  agent_spawn: WorkflowAgentNode,
  handoff: WorkflowAgentNode,
  assign: WorkflowAgentNode,
  send_message: WorkflowAgentNode,
  webhook: WebhookNode,
  xor_split: XorGateNode,
  xor_join: XorGateNode,
  and_split: AndGateNode,
  and_join: AndGateNode,
  or_split: OrGateNode,
  or_join: OrGateNode,
};

interface WorkflowEditorProps {
  workflowId?: string;
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow>(createEmptyWorkflow());

  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [selectedNodeType, setSelectedNodeType] = useState<WorkflowNodeType>(WorkflowNodeType.AGENT_SPAWN);
  const [nodeName, setNodeName] = useState('');
  const [agentProfile, setAgentProfile] = useState('');
  const [provider, setProvider] = useState<ProviderType | ''>('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMethod, setWebhookMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');
  const [webhookPayload, setWebhookPayload] = useState('');
  const [isPromptInput, setIsPromptInput] = useState(false);
  const [showDeleteEdgeModal, setShowDeleteEdgeModal] = useState(false);
  const [edgeToDelete, setEdgeToDelete] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);

  useEffect(() => {
    const loadWorkflow = async () => {
      if (workflowId) {
        const loadedWorkflow = await WorkflowStorage.getWorkflow(workflowId);
        if (loadedWorkflow) {
          setWorkflow(loadedWorkflow);
          setNodes(loadedWorkflow.nodes);
          setEdges(loadedWorkflow.edges);
        } else {
          const newWorkflow = createEmptyWorkflow();
          newWorkflow.id = workflowId;
          setWorkflow(newWorkflow);
        }
      }
    };
    loadWorkflow();
  }, [workflowId, setNodes, setEdges]);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agents = await caoClient.listAgents();
        setAvailableAgents(agents);
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    };
    loadAgents();
  }, []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds) as WorkflowEdge[]),
    [setEdges]
  );

  const handleEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setEdgeToDelete(edge.id);
    setShowDeleteEdgeModal(true);
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }, []);

  const handleDeleteEdge = useCallback(() => {
    if (edgeToDelete) {
      setEdges((eds) => eds.filter((e) => e.id !== edgeToDelete));
      setEdgeToDelete(null);
      setShowDeleteEdgeModal(false);
    }
  }, [edgeToDelete, setEdges]);

  const handleDeleteEdgeFromContextMenu = useCallback(() => {
    if (contextMenu) {
      setEdges((eds) => eds.filter((e) => e.id !== contextMenu.edgeId));
      setContextMenu(null);
    }
  }, [contextMenu, setEdges]);

  const handleAddNode = () => {
    setEditingNodeId(null);
    setNodeName('');
    setAgentProfile('');
    setProvider('');
    setWebhookUrl('');
    setWebhookMethod('POST');
    setWebhookPayload('');
    setIsPromptInput(false);
    setSelectedNodeType(WorkflowNodeType.AGENT_SPAWN);
    setShowNodeConfig(true);
  };

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: WorkflowNode) => {
    setEditingNodeId(node.id);
    setSelectedNodeType(node.data.type);
    setNodeName(node.data.label);
    
    if (node.data.type === WorkflowNodeType.WEBHOOK) {
      setWebhookUrl(node.data.config.webhookUrl || '');
      setWebhookMethod(node.data.config.webhookMethod || 'POST');
      setWebhookPayload(node.data.config.webhookPayload || '');
      setIsPromptInput(node.data.config.isPromptInput || false);
    } else {
      setAgentProfile(node.data.config.agentProfile || '');
      setProvider((node.data.config.provider as ProviderType) || '');
    }
    
    setShowNodeConfig(true);
  }, []);

  const handleCreateNode = () => {
    const config: any = {};
    
    const isQualityGate = [
      WorkflowNodeType.XOR_SPLIT,
      WorkflowNodeType.XOR_JOIN,
      WorkflowNodeType.AND_SPLIT,
      WorkflowNodeType.AND_JOIN,
      WorkflowNodeType.OR_SPLIT,
      WorkflowNodeType.OR_JOIN,
    ].includes(selectedNodeType);

    if (selectedNodeType === WorkflowNodeType.WEBHOOK) {
      config.webhookUrl = webhookUrl;
      config.webhookMethod = webhookMethod;
      config.webhookPayload = webhookPayload;
      config.isPromptInput = isPromptInput;
    } else if (!isQualityGate) {
      config.agentProfile = agentProfile;
      config.provider = provider || undefined;
    }

    if (editingNodeId) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === editingNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  type: selectedNodeType,
                  label: nodeName || 'New Node',
                  config,
                },
              }
            : n
        )
      );
    } else {
      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: selectedNodeType,
        position: { x: 250, y: 100 },
        data: {
          id: `node-${Date.now()}`,
          type: selectedNodeType,
          label: nodeName || 'New Node',
          config,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    }

    setShowNodeConfig(false);
    setEditingNodeId(null);
    setNodeName('');
    setAgentProfile('');
    setProvider('');
    setWebhookUrl('');
    setWebhookMethod('POST');
    setWebhookPayload('');
    setIsPromptInput(false);
  };

  const handleSave = async () => {
    const updatedWorkflow: Workflow = {
      ...workflow,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };

    await WorkflowStorage.saveWorkflow(updatedWorkflow);
    setWorkflow(updatedWorkflow);
  };

  const handleExport = () => {
    const json = WorkflowStorage.exportWorkflow({ ...workflow, nodes, edges });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecute = async () => {
    await handleSave();
    router.push(`/workflows/${workflow.id}/execute`);
  };

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onEdgeContextMenu={handleEdgeContextMenu}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#4299e1', strokeWidth: 2 },
          markerEnd: {
            type: 'arrowclosed',
            color: '#4299e1',
            width: 20,
            height: 20,
          },
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#2d3f4f" />
        <Controls />
        
        <Panel position="top-right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={handleAddNode} iconName="add-plus">
              Add Node
            </Button>
            <Button onClick={handleSave} iconName="upload">
              Save
            </Button>
            <Button onClick={handleExport} iconName="download">
              Export
            </Button>
            <Button variant="primary" onClick={handleExecute} iconName="status-in-progress">
              Execute
            </Button>
          </SpaceBetween>
        </Panel>
      </ReactFlow>

      {contextMenu && (
        <>
          <button
            type="button"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'default',
              zIndex: 999,
            }}
            onClick={() => setContextMenu(null)}
            aria-label="Close context menu"
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '4px 0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
            }}
          >
            <button
              type="button"
              style={{
                width: '100%',
                padding: '8px 16px',
                border: 'none',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left',
              }}
              onClick={handleDeleteEdgeFromContextMenu}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
            >
              Delete Connection
            </button>
          </div>
        </>
      )}

      <Modal
        visible={showDeleteEdgeModal}
        onDismiss={() => setShowDeleteEdgeModal(false)}
        header="Delete Connection"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowDeleteEdgeModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDeleteEdge}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Box variant="p">
          Are you sure you want to delete this connection?
        </Box>
      </Modal>

      <Modal
        visible={showNodeConfig}
        onDismiss={() => setShowNodeConfig(false)}
        header={editingNodeId ? "Edit Node" : "Add Node"}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowNodeConfig(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateNode}>
                {editingNodeId ? 'Update' : 'Create'}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <FormField label="Node Type">
            <Select
              selectedOption={{ label: selectedNodeType, value: selectedNodeType }}
              onChange={({ detail }) => setSelectedNodeType(detail.selectedOption.value as WorkflowNodeType)}
              options={[
                { label: 'Agent Spawn', value: WorkflowNodeType.AGENT_SPAWN },
                { label: 'Handoff', value: WorkflowNodeType.HANDOFF },
                { label: 'Assign', value: WorkflowNodeType.ASSIGN },
                { label: 'Send Message', value: WorkflowNodeType.SEND_MESSAGE },
                { label: 'Webhook', value: WorkflowNodeType.WEBHOOK },
                { label: 'XOR Split (Choose ONE path)', value: WorkflowNodeType.XOR_SPLIT },
                { label: 'XOR Join (Merge ONE path)', value: WorkflowNodeType.XOR_JOIN },
                { label: 'AND Split (Execute ALL paths)', value: WorkflowNodeType.AND_SPLIT },
                { label: 'AND Join (Wait for ALL paths)', value: WorkflowNodeType.AND_JOIN },
                { label: 'OR Split (Execute ONE+ paths)', value: WorkflowNodeType.OR_SPLIT },
                { label: 'OR Join (Wait for active paths)', value: WorkflowNodeType.OR_JOIN },
              ]}
            />
          </FormField>

          <FormField label="Node Name">
            <Input
              value={nodeName}
              onChange={({ detail }) => setNodeName(detail.value)}
              placeholder="Enter node name"
            />
          </FormField>

          {selectedNodeType === WorkflowNodeType.WEBHOOK ? (
            <>
              <FormField label="Webhook URL">
                <Input
                  value={webhookUrl}
                  onChange={({ detail }) => setWebhookUrl(detail.value)}
                  placeholder="https://example.com/webhook"
                />
              </FormField>

              <FormField label="HTTP Method">
                <Select
                  selectedOption={{ label: webhookMethod, value: webhookMethod }}
                  onChange={({ detail }) => setWebhookMethod(detail.selectedOption.value as 'GET' | 'POST' | 'PUT' | 'DELETE')}
                  options={[
                    { label: 'GET', value: 'GET' },
                    { label: 'POST', value: 'POST' },
                    { label: 'PUT', value: 'PUT' },
                    { label: 'DELETE', value: 'DELETE' },
                  ]}
                />
              </FormField>

              <FormField label="Payload" description="Text to send as request body">
                <Textarea
                  value={webhookPayload}
                  onChange={({ detail }) => setWebhookPayload(detail.value)}
                  placeholder="Enter payload text..."
                  rows={4}
                />
              </FormField>
            </>
          ) : ![
            WorkflowNodeType.XOR_SPLIT,
            WorkflowNodeType.XOR_JOIN,
            WorkflowNodeType.AND_SPLIT,
            WorkflowNodeType.AND_JOIN,
            WorkflowNodeType.OR_SPLIT,
            WorkflowNodeType.OR_JOIN,
          ].includes(selectedNodeType) ? (
            <>
              <FormField label="Agent Profile">
                <Select
                  selectedOption={
                    agentProfile
                      ? { label: agentProfile, value: agentProfile }
                      : null
                  }
                  onChange={({ detail }) =>
                    setAgentProfile(detail.selectedOption?.value || '')
                  }
                  options={availableAgents.map((agent) => ({
                    label: agent,
                    value: agent,
                  }))}
                  placeholder="Select agent profile"
                  expandToViewport={true}
                />
              </FormField>

              <FormField label="Provider">
                <Select
                  selectedOption={provider ? { label: provider, value: provider } : null}
                  onChange={({ detail }) => setProvider((detail.selectedOption.value as ProviderType) || '')}
                  options={[
                    { label: 'Q CLI', value: 'q_cli' },
                    { label: 'Kiro CLI', value: 'kiro_cli' },
                    { label: 'Claude Code', value: 'claude_code' },
                    { label: 'OpenCode', value: 'opencode' },
                    { label: 'Gemini CLI', value: 'gemini_cli' },
                    { label: 'Qwen CLI', value: 'qwen_cli' },
                    { label: 'GitHub Copilot', value: 'gh_copilot' },
                  ]}
                  placeholder="Select provider"
                />
              </FormField>
            </>
          ) : null}

          {selectedNodeType === WorkflowNodeType.WEBHOOK && (
            <FormField label="Options">
              <Checkbox
                checked={isPromptInput}
                onChange={({ detail }) => setIsPromptInput(detail.checked)}
              >
                Enable Prompt Input for this node
              </Checkbox>
            </FormField>
          )}
        </SpaceBetween>
      </Modal>
    </div>
  );
}

function createEmptyWorkflow(): Workflow {
  return {
    id: `workflow-${Date.now()}`,
    name: 'New Workflow',
    description: '',
    nodes: [],
    edges: [],
    config: {
      errorHandling: 'stop',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
