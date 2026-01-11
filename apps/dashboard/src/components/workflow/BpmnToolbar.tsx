"use client";

import { DragEvent } from 'react';
import { WorkflowNodeType } from '@/types/workflow';

interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  icon: string;
  color: string;
}

const nodePalette: NodePaletteItem[] = [
  {
    type: WorkflowNodeType.START_EVENT,
    label: 'Start',
    icon: '▶',
    color: '#10b981',
  },
  {
    type: WorkflowNodeType.SERVICE_TASK,
    label: 'Task',
    icon: '⚙️',
    color: '#667eea',
  },
  {
    type: WorkflowNodeType.EXCLUSIVE_GATEWAY,
    label: 'XOR',
    icon: '×',
    color: '#fbbf24',
  },
  {
    type: WorkflowNodeType.PARALLEL_GATEWAY,
    label: 'AND',
    icon: '+',
    color: '#3b82f6',
  },
  {
    type: WorkflowNodeType.INCLUSIVE_GATEWAY,
    label: 'OR',
    icon: '○',
    color: '#8b5cf6',
  },
  {
    type: WorkflowNodeType.END_EVENT,
    label: 'End',
    icon: '■',
    color: '#ef4444',
  },
];

export function BpmnToolbar() {
  const onDragStart = (event: DragEvent, nodeType: WorkflowNodeType, label: string) => {
    console.log('🎯 Drag started:', { type: nodeType, label });
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('nodeLabel', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      zIndex: 10,
      display: 'flex',
      gap: '8px',
      background: 'rgba(11, 29, 46, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #2d3f4f',
      borderRadius: '8px',
      padding: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    }}>
      {nodePalette.map((item) => (
        <button
          key={item.type}
          type="button"
          draggable
          onDragStart={(e) => onDragStart(e, item.type, item.label)}
          title={item.label}
          style={{
            width: '44px',
            height: '44px',
            background: '#122d3f',
            border: `2px solid ${item.color}40`,
            borderRadius: '6px',
            cursor: 'grab',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${item.color}20`;
            e.currentTarget.style.borderColor = item.color;
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 4px 8px ${item.color}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#122d3f';
            e.currentTarget.style.borderColor = `${item.color}40`;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{
            fontSize: '16px',
            color: item.color,
            fontWeight: 'bold',
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {item.icon}
          </div>
          <div style={{
            fontSize: '9px',
            color: '#9ba7b2',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            pointerEvents: 'none',
          }}>
            {item.label}
          </div>
        </button>
      ))}
    </div>
  );
}
