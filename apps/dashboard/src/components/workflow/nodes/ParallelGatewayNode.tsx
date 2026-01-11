"use client";

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { WorkflowExecutionStatus } from '@/types/workflow';

interface ParallelGatewayData extends Record<string, unknown> {
  label?: string;
  status?: WorkflowExecutionStatus;
  direction?: string;
}

const colors = {
  bg: '#0b1d2e',
  bgHover: '#122d3f',
  border: '#2d3f4f',
  borderActive: '#3b82f6',
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

const ParallelGatewayNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as ParallelGatewayData;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        padding: '14px 18px',
        minWidth: '180px',
        background: selected ? colors.bgHover : colors.bg,
        border: `2px solid ${selected ? colors.borderActive : colors.border}`,
        borderRadius: '10px',
        boxShadow: selected ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            transform: 'rotate(45deg)',
            background: 'rgba(59, 130, 246, 0.2)',
            border: '2px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ transform: 'rotate(-45deg)', fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>
              +
            </div>
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
            {nodeData.label || 'AND Gateway'}
          </span>
        </div>

        {nodeData.status && (
          <div style={{ marginBottom: '8px', pointerEvents: 'none' }}>
            <StatusIndicator type={getStatusType(nodeData.status)}>
              {nodeData.status}
            </StatusIndicator>
          </div>
        )}

        {nodeData.direction && (
          <div style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#3b82f6',
            fontWeight: '500',
            pointerEvents: 'none',
          }}>
            {nodeData.direction}
          </div>
        )}

        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{
            width: '10px',
            height: '10px',
            background: colors.borderActive,
            border: '2px solid #fff',
          }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{
            width: '10px',
            height: '10px',
            background: colors.borderActive,
            border: '2px solid #fff',
          }}
        />
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

export default memo(ParallelGatewayNode);
