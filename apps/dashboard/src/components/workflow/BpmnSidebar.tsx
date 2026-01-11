"use client";

import { DragEvent, useState } from 'react';
import { WorkflowNodeType } from '@/types/workflow';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Box from '@cloudscape-design/components/box';

interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  icon: string;
  color: string;
  description: string;
  category: 'Events' | 'Tasks' | 'Gateways';
}

const nodePalette: NodePaletteItem[] = [
  {
    type: WorkflowNodeType.START_EVENT,
    label: 'Start Event',
    icon: '▶',
    color: '#10b981',
    description: 'Workflow entry point',
    category: 'Events',
  },
  {
    type: WorkflowNodeType.END_EVENT,
    label: 'End Event',
    icon: '■',
    color: '#ef4444',
    description: 'Workflow termination',
    category: 'Events',
  },
  {
    type: WorkflowNodeType.SERVICE_TASK,
    label: 'Service Task',
    icon: '⚙️',
    color: '#667eea',
    description: 'Execute agent task',
    category: 'Tasks',
  },
  {
    type: WorkflowNodeType.EXCLUSIVE_GATEWAY,
    label: 'XOR Gateway',
    icon: '×',
    color: '#fbbf24',
    description: 'Choose ONE path',
    category: 'Gateways',
  },
  {
    type: WorkflowNodeType.PARALLEL_GATEWAY,
    label: 'AND Gateway',
    icon: '+',
    color: '#3b82f6',
    description: 'Execute ALL paths',
    category: 'Gateways',
  },
  {
    type: WorkflowNodeType.INCLUSIVE_GATEWAY,
    label: 'OR Gateway',
    icon: '○',
    color: '#8b5cf6',
    description: 'Execute ONE+ paths',
    category: 'Gateways',
  },
];

export function BpmnSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const onDragStart = (event: DragEvent, nodeType: WorkflowNodeType, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('nodeLabel', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredNodes = nodePalette.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['Events', 'Tasks', 'Gateways'] as const;
  const groupedNodes = categories.map(category => ({
    category,
    nodes: filteredNodes.filter(node => node.category === category),
  })).filter(group => group.nodes.length > 0);

  return (
    <div style={{
      width: '260px',
      background: '#0b1d2e',
      borderRight: '1px solid #2d3f4f',
      padding: '16px',
      overflowY: 'auto',
      height: '100%',
    }}>
      <Container
        header={
          <Header variant="h2" description="Drag nodes onto canvas">
            BPMN Elements
          </Header>
        }
      >
        <SpaceBetween size="m">
          <Input
            type="search"
            value={searchQuery}
            onChange={({ detail }) => setSearchQuery(detail.value)}
            placeholder="Search elements..."
            clearAriaLabel="Clear search"
          />
          
          {groupedNodes.map(({ category, nodes }) => (
            <div key={category}>
              <Box variant="h3" fontSize="body-s" color="text-label" padding={{ bottom: 'xs' }}>
                {category}
              </Box>
              <SpaceBetween size="s">
                {nodes.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type, item.label)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#122d3f',
                      border: '2px solid #2d3f4f',
                      borderRadius: '8px',
                      cursor: 'grab',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = item.color;
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2d3f4f';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: item.type === WorkflowNodeType.START_EVENT || item.type === WorkflowNodeType.END_EVENT ? '50%' : '4px',
                        background: `${item.color}20`,
                        border: `2px solid ${item.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        color: item.color,
                        fontWeight: 'bold',
                      }}>
                        {item.icon}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#f9f9f9',
                        flex: 1,
                      }}>
                        {item.label}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#9ba7b2',
                      marginLeft: '38px',
                    }}>
                      {item.description}
                    </div>
                  </button>
                ))}
              </SpaceBetween>
            </div>
          ))}
        </SpaceBetween>
      </Container>

      <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(66, 153, 225, 0.1)', borderRadius: '6px', fontSize: '11px', color: '#9ba7b2' }}>
        <strong style={{ color: '#4299e1' }}>💡 Tip:</strong> Drag elements onto the canvas, then double-click to configure
      </div>
    </div>
  );
}
