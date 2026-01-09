"use client";

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { WorkflowExecutionStatus } from '@/types/workflow';

const colors = {
  bg: '#0b1d2e',
  bgHover: '#122d3f',
  border: '#2d3f4f',
  borderActive: '#4299e1',
  text: '#f9f9f9',
  textSecondary: '#9ba7b2',
  success: '#037f0c',
  warning: '#8c6700',
  error: '#d91515',
  info: '#0972d3',
};

const getStatusType = (status?: WorkflowExecutionStatus): 'success' | 'warning' | 'error' | 'info' | 'in-progress' | 'stopped' => {
  if (!status) return 'stopped';
  switch (status) {
    case WorkflowExecutionStatus.RUNNING:
      return 'in-progress';
    case WorkflowExecutionStatus.COMPLETED:
      return 'success';
    case WorkflowExecutionStatus.FAILED:
      return 'error';
    case WorkflowExecutionStatus.PAUSED:
      return 'warning';
    default:
      return 'stopped';
  }
};

export const WebhookNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as {
    label: string;
    status?: WorkflowExecutionStatus;
    config: {
      webhookUrl?: string;
      webhookMethod?: string;
      webhookPayload?: string;
    };
  };

  const statusType = getStatusType(nodeData.status);

  return (
    <div
      className="webhook-node"
      style={{
        padding: '14px 18px',
        minWidth: '200px',
        maxWidth: '260px',
        background: selected ? colors.bgHover : colors.bg,
        border: `2px solid ${selected ? colors.borderActive : colors.border}`,
        borderRadius: '10px',
        boxShadow: selected ? '0 0 0 3px rgba(66, 153, 225, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '10px',
          height: '10px',
          background: colors.borderActive,
          border: '2px solid #fff',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '20px' }}>🪝</span>
        <span
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {nodeData.label}
        </span>
      </div>

      {nodeData.status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <StatusIndicator type={statusType}>
            {nodeData.status}
          </StatusIndicator>
        </div>
      )}

      {nodeData.config.webhookUrl && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '5px',
            fontSize: '11px',
            color: colors.textSecondary,
          }}
        >
          <div style={{ fontWeight: '500', marginBottom: '2px' }}>URL:</div>
          <div style={{ 
            color: colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {nodeData.config.webhookUrl}
          </div>
        </div>
      )}

      {nodeData.config.webhookMethod && (
        <div
          style={{
            marginTop: '6px',
            padding: '4px 8px',
            background: 'rgba(66, 153, 225, 0.1)',
            border: '1px solid rgba(66, 153, 225, 0.3)',
            borderRadius: '4px',
            fontSize: '10px',
            color: colors.info,
            fontWeight: '500',
          }}
        >
          {nodeData.config.webhookMethod}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '10px',
          height: '10px',
          background: colors.borderActive,
          border: '2px solid #fff',
        }}
      />
    </div>
  );
});

WebhookNode.displayName = 'WebhookNode';
