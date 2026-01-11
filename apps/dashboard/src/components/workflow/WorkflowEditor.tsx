"use client";

import { useState, useCallback, useEffect, useRef, DragEvent } from 'react';
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
  ReactFlowInstance,
  XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BpmnToolbar } from './BpmnToolbar';
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

import { WorkflowAgentNode } from './nodes/WorkflowAgentNode';
import { WebhookNode } from './nodes/WebhookNode';
import { XorGateNode } from './nodes/XorGateNode';
import { AndGateNode } from './nodes/AndGateNode';
import { OrGateNode } from './nodes/OrGateNode';
import StartEventNode from './nodes/StartEventNode';
import EndEventNode from './nodes/EndEventNode';
import ServiceTaskNode from './nodes/ServiceTaskNode';
import ExclusiveGatewayNode from './nodes/ExclusiveGatewayNode';
import ParallelGatewayNode from './nodes/ParallelGatewayNode';

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
  startEvent: StartEventNode,
  endEvent: EndEventNode,
  serviceTask: ServiceTaskNode,
  exclusiveGateway: ExclusiveGatewayNode,
  parallelGateway: ParallelGatewayNode,
};

interface WorkflowEditorProps {
  workflowId?: string;
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow>(createEmptyWorkflow());
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [taskTemplate, setTaskTemplate] = useState('');
  const [waitForCompletion, setWaitForCompletion] = useState(true);
  const [direction, setDirection] = useState<'Diverging' | 'Converging'>('Diverging');

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

  const handleReactFlowInit = useCallback((instance: ReactFlowInstance) => {
    console.log('✅ ReactFlow initialized');
    setReactFlowInstance(instance);
  }, []);

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



  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: WorkflowNode) => {
    console.log('🖱️ Node double-clicked:', { id: node.id, type: node.data.type, label: node.data.label });
    setEditingNodeId(node.id);
    setSelectedNodeType(node.data.type);
    setNodeName(node.data.label);
    
    const config = node.data.config as Record<string, any>;
    
    if (node.data.type === WorkflowNodeType.START_EVENT) {
      setIsPromptInput(config.webhookEnabled || false);
      setWebhookUrl(config.webhookUrl || '');
    } else if (node.data.type === WorkflowNodeType.WEBHOOK) {
      setWebhookUrl(config.webhookUrl || '');
      setWebhookMethod(config.webhookMethod || 'POST');
      setWebhookPayload(config.webhookPayload || '');
      setIsPromptInput(config.isPromptInput || false);
    } else if (node.data.type === WorkflowNodeType.SERVICE_TASK) {
      setAgentProfile(config.agentProfile || '');
      setProvider((config.provider as ProviderType) || '');
      setTaskTemplate(config.taskTemplate || '');
      setWaitForCompletion(config.waitForCompletion !== false);
    } else if ([WorkflowNodeType.EXCLUSIVE_GATEWAY, WorkflowNodeType.PARALLEL_GATEWAY, WorkflowNodeType.INCLUSIVE_GATEWAY].includes(node.data.type)) {
      setDirection(config.direction || 'Diverging');
    } else {
      setAgentProfile(config.agentProfile || '');
      setProvider((config.provider as ProviderType) || '');
    }
    
    setShowNodeConfig(true);
  }, []);

  const handleCreateNode = () => {
    const config: any = {};
    
    const isGateway = [
      WorkflowNodeType.EXCLUSIVE_GATEWAY,
      WorkflowNodeType.PARALLEL_GATEWAY,
      WorkflowNodeType.INCLUSIVE_GATEWAY,
      // Legacy types
      WorkflowNodeType.XOR_SPLIT,
      WorkflowNodeType.XOR_JOIN,
      WorkflowNodeType.AND_SPLIT,
      WorkflowNodeType.AND_JOIN,
      WorkflowNodeType.OR_SPLIT,
      WorkflowNodeType.OR_JOIN,
    ].includes(selectedNodeType);

    const isEvent = [
      WorkflowNodeType.START_EVENT,
      WorkflowNodeType.END_EVENT,
    ].includes(selectedNodeType);

    if (selectedNodeType === WorkflowNodeType.START_EVENT) {
      config.webhookEnabled = isPromptInput;
      if (isPromptInput) {
        config.webhookUrl = webhookUrl;
      }
    } else if (selectedNodeType === WorkflowNodeType.SERVICE_TASK) {
      config.agentProfile = agentProfile;
      config.provider = provider || undefined;
      config.taskTemplate = taskTemplate;
      config.waitForCompletion = waitForCompletion;
    } else if (selectedNodeType === WorkflowNodeType.WEBHOOK) {
      config.webhookUrl = webhookUrl;
      config.webhookMethod = webhookMethod;
      config.webhookPayload = webhookPayload;
      config.isPromptInput = isPromptInput;
    } else if (isGateway) {
      config.direction = direction;
    } else if (!isEvent) {
      // Legacy node types or other task types
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
    setTaskTemplate('');
    setWaitForCompletion(true);
    setDirection('Diverging');
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

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    console.log('🔄 Drag over canvas');
    setIsDragging(true);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);

      console.log('📍 Drop event:', {
        hasWrapper: !!reactFlowWrapper.current,
        hasInstance: !!reactFlowInstance,
        clientX: event.clientX,
        clientY: event.clientY,
      });

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        console.error('❌ Drop failed: ReactFlow not ready', {
          wrapper: !!reactFlowWrapper.current,
          instance: !!reactFlowInstance,
        });
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
      const label = event.dataTransfer.getData('nodeLabel');

      console.log('📦 Extracted data:', { type, label });

      if (!type) {
        console.error('❌ Drop failed: No node type in dataTransfer');
        return;
      }

      const position: XYPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      console.log('✅ Creating node at position:', position);

      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: {
          id: `node-${Date.now()}`,
          type,
          label: label || 'New Node',
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
      console.log('✅ Node created successfully');
    },
    [reactFlowInstance, setNodes]
  );

  return (
    <div style={{ 
      display: 'flex', 
      width: '100%', 
      height: isFullscreen ? '100vh' : '600px',
      position: isFullscreen ? 'fixed' : 'relative',
      top: isFullscreen ? 0 : 'auto',
      left: isFullscreen ? 0 : 'auto',
      zIndex: isFullscreen ? 50 : 'auto',
      background: '#ffffff',
    }}>      
      <div 
        ref={reactFlowWrapper}
        style={{ 
          flex: 1, 
          position: 'relative',
          outline: isDragging ? '2px dashed #10b981' : 'none',
          outlineOffset: '-4px',
          backgroundColor: isDragging ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <BpmnToolbar />
        <ReactFlow
          nodes={nodes as any}
          edges={edges as any}
          onNodesChange={onNodesChange as any}
          onEdgesChange={onEdgesChange as any}
          onConnect={onConnect}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onEdgeContextMenu={handleEdgeContextMenu}
          onNodeDoubleClick={handleNodeDoubleClick as any}
          onInit={handleReactFlowInit}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { 
            stroke: '#6b7280', 
            strokeWidth: 2.5,
          },
          markerEnd: {
            type: 'arrowclosed',
            color: '#6b7280',
            width: 20,
            height: 20,
          },
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
        <Controls />
        
        <Panel position="top-right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              iconName={isFullscreen ? "resize-area" : "expand"}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
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
      </div>

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
                { label: 'Start Event', value: WorkflowNodeType.START_EVENT },
                { label: 'End Event', value: WorkflowNodeType.END_EVENT },
                { label: 'Service Task (Agent)', value: WorkflowNodeType.SERVICE_TASK },
                { label: 'Script Task', value: WorkflowNodeType.SCRIPT_TASK },
                { label: 'User Task', value: WorkflowNodeType.USER_TASK },
                { label: 'Exclusive Gateway (XOR)', value: WorkflowNodeType.EXCLUSIVE_GATEWAY },
                { label: 'Parallel Gateway (AND)', value: WorkflowNodeType.PARALLEL_GATEWAY },
                { label: 'Inclusive Gateway (OR)', value: WorkflowNodeType.INCLUSIVE_GATEWAY },
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

          {selectedNodeType === WorkflowNodeType.START_EVENT || selectedNodeType === WorkflowNodeType.END_EVENT ? (
            <>
              <Box variant="p" color="text-body-secondary">
                {selectedNodeType === WorkflowNodeType.START_EVENT 
                  ? 'Configure how this workflow can be triggered'
                  : 'No configuration needed for this node type.'}
              </Box>
              
              {selectedNodeType === WorkflowNodeType.START_EVENT && (
                <>
                  <FormField label="Webhook Trigger">
                    <Checkbox
                      checked={isPromptInput}
                      onChange={({ detail }) => setIsPromptInput(detail.checked)}
                    >
                      Enable webhook trigger
                    </Checkbox>
                  </FormField>
                  
                  {isPromptInput && (
                    <FormField 
                      label="Webhook URL" 
                      description="This workflow will be triggered when a POST request is made to this URL"
                    >
                      <Input
                        value={webhookUrl}
                        onChange={({ detail }) => setWebhookUrl(detail.value)}
                        placeholder="/webhooks/my-workflow-trigger"
                      />
                    </FormField>
                  )}
                </>
              )}
            </>
          ) : selectedNodeType === WorkflowNodeType.SERVICE_TASK ? (
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

              <FormField 
                label="Task Template" 
                description="Use {{previousOutput}} for dynamic content from previous nodes"
              >
                <Textarea
                  value={taskTemplate}
                  onChange={({ detail }) => setTaskTemplate(detail.value)}
                  placeholder="Enter task template (supports Jinja2 syntax)..."
                  rows={4}
                />
              </FormField>

              <FormField label="Options">
                <Checkbox
                  checked={waitForCompletion}
                  onChange={({ detail }) => setWaitForCompletion(detail.checked)}
                >
                  Wait for agent to complete task
                </Checkbox>
              </FormField>
            </>
          ) : [WorkflowNodeType.EXCLUSIVE_GATEWAY, WorkflowNodeType.PARALLEL_GATEWAY, WorkflowNodeType.INCLUSIVE_GATEWAY].includes(selectedNodeType) ? (
            <FormField label="Gateway Direction">
              <Select
                selectedOption={{ label: direction, value: direction }}
                onChange={({ detail }) => setDirection(detail.selectedOption.value as 'Diverging' | 'Converging')}
                options={[
                  { label: 'Diverging', value: 'Diverging' },
                  { label: 'Converging', value: 'Converging' },
                ]}
              />
            </FormField>
          ) : selectedNodeType === WorkflowNodeType.WEBHOOK ? (
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
