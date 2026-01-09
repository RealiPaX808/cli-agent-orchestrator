"use client";

import { useState, useCallback } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowAgentNode } from './nodes/WorkflowAgentNode';
import { WebhookNode } from './nodes/WebhookNode';
import { Workflow, WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@/types/workflow';
import { ProviderType } from '@/types/cao';
import { WorkflowStorage } from '@/lib/workflow-storage';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import Textarea from '@cloudscape-design/components/textarea';

const nodeTypes = {
  agent_spawn: WorkflowAgentNode,
  handoff: WorkflowAgentNode,
  assign: WorkflowAgentNode,
  send_message: WorkflowAgentNode,
  webhook: WebhookNode,
};

interface WorkflowEditorProps {
  workflowId?: string;
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow>(() => {
    if (workflowId) {
      return WorkflowStorage.getWorkflow(workflowId) || createEmptyWorkflow();
    }
    return createEmptyWorkflow();
  });

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

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds) as WorkflowEdge[]),
    [setEdges]
  );

  const handleAddNode = () => {
    setShowNodeConfig(true);
  };

  const handleCreateNode = () => {
    const config: any = {};
    
    if (selectedNodeType === WorkflowNodeType.WEBHOOK) {
      config.webhookUrl = webhookUrl;
      config.webhookMethod = webhookMethod;
      config.webhookPayload = webhookPayload;
    } else {
      config.agentProfile = agentProfile;
      config.provider = provider || undefined;
    }

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
    setShowNodeConfig(false);
    setNodeName('');
    setAgentProfile('');
    setProvider('');
    setWebhookUrl('');
    setWebhookMethod('POST');
    setWebhookPayload('');
  };

  const handleSave = () => {
    const updatedWorkflow: Workflow = {
      ...workflow,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };

    WorkflowStorage.saveWorkflow(updatedWorkflow);
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

  const handleExecute = () => {
    handleSave();
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
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
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

      <Modal
        visible={showNodeConfig}
        onDismiss={() => setShowNodeConfig(false)}
        header="Add Node"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowNodeConfig(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateNode}>
                Create
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
          ) : (
            <>
              <FormField label="Agent Profile">
                <Input
                  value={agentProfile}
                  onChange={({ detail }) => setAgentProfile(detail.value)}
                  placeholder="e.g., developer, reviewer"
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
