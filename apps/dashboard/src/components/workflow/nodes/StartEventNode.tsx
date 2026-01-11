"use client";

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { WorkflowExecutionStatus } from '@/types/workflow';

interface StartEventData extends Record<string, unknown> {
  label?: string;
  status?: WorkflowExecutionStatus;
  config?: {
    webhookUrl?: string;
    webhookEnabled?: boolean;
  };
}

const colors = {
  bg: '#0b1d2e',
  bgHover: '#122d3f',
  border: '#2d3f4f',
  borderActive: '#10b981',
  text: '#f9f9f9',
  textSecondary: '#9ba7b2',
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
    default:
      return 'stopped';
  }
};

const StartEventNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as StartEventData;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        padding: '14px 18px',
        minWidth: '160px',
        background: selected ? colors.bgHover : colors.bg,
        border: `2px solid ${selected ? colors.borderActive : colors.border}`,
        borderRadius: '10px',
        boxShadow: selected ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2px solid #10b981',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            pointerEvents: 'none',
          }}>
            ▶
          </div>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            pointerEvents: 'none',
          }}>
            {nodeData.label || 'Start'}
          </span>
        </div>

        {nodeData.status && (
          <div style={{ marginBottom: '8px', pointerEvents: 'none' }}>
            <StatusIndicator type={getStatusType(nodeData.status)}>
              {nodeData.status}
            </StatusIndicator>
          </div>
        )}

        {nodeData.config?.webhookEnabled && (
          <div style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#10b981',
            fontWeight: '500',
            pointerEvents: 'none',
          }}>
            🔗 Webhook
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{
            width: '10px',
            height: '10px',
            background: colors.borderActive,
            border: '2px solid #fff',
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{
            width: '10px',
            height: '10px',
            background: colors.borderActive,
            border: '2px solid #fff',
          }}
        />
      </div>
    </div>
  );
};

export default memo(StartEventNode);
