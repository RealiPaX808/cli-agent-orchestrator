"use client";

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import Box from '@cloudscape-design/components/box';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { WorkflowExecutionStatus } from '@/types/workflow';

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

export const XorGateNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as {
    label: string;
    status?: WorkflowExecutionStatus;
    type: string;
  };

  const isSplit = nodeData.type === 'xor_split';
  const statusType = getStatusType(nodeData.status);

  return (
    <div style={{ position: 'relative' }}>
      <svg width="120" height="120" style={{ position: 'absolute', top: 0, left: 0 }} aria-label={`XOR ${isSplit ? 'Split' : 'Join'} Node`}>
        <title>{isSplit ? 'XOR Split Gateway' : 'XOR Join Gateway'}</title>
        <polygon
          points="60,10 110,60 60,110 10,60"
          fill={selected ? '#122d3f' : '#0b1d2e'}
          stroke={selected ? '#4299e1' : '#2d3f4f'}
          strokeWidth="2"
          style={{
            filter: selected ? 'drop-shadow(0 0 8px rgba(66, 153, 225, 0.4))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
          }}
        />
        <text
          x="60"
          y="55"
          textAnchor="middle"
          fill="#f9f9f9"
          fontSize="28"
        >
          ⚡
        </text>
        <text
          x="60"
          y="75"
          textAnchor="middle"
          fill="#9ba7b2"
          fontSize="10"
          fontWeight="600"
        >
          XOR
        </text>
      </svg>

      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: '10px',
            height: '10px',
            background: '#4299e1',
            border: '2px solid #fff',
            left: '10px',
          }}
        />
        
        {isSplit ? (
          <>
            <Handle
              type="source"
              position={Position.Top}
              id="out-top"
              style={{
                width: '10px',
                height: '10px',
                background: '#037f0c',
                border: '2px solid #fff',
                top: '10px',
              }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id="out-right"
              style={{
                width: '10px',
                height: '10px',
                background: '#037f0c',
                border: '2px solid #fff',
                right: '10px',
              }}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              id="out-bottom"
              style={{
                width: '10px',
                height: '10px',
                background: '#037f0c',
                border: '2px solid #fff',
                bottom: '10px',
              }}
            />
          </>
        ) : (
          <>
            <Handle
              type="target"
              position={Position.Top}
              id="in-top"
              style={{
                width: '10px',
                height: '10px',
                background: '#4299e1',
                border: '2px solid #fff',
                top: '10px',
              }}
            />
            <Handle
              type="target"
              position={Position.Bottom}
              id="in-bottom"
              style={{
                width: '10px',
                height: '10px',
                background: '#4299e1',
                border: '2px solid #fff',
                bottom: '10px',
              }}
            />
            <Handle
              type="source"
              position={Position.Right}
              style={{
                width: '10px',
                height: '10px',
                background: '#037f0c',
                border: '2px solid #fff',
                right: '10px',
              }}
            />
          </>
        )}
      </div>

      {nodeData.status && (
        <Box textAlign="center" margin={{ top: 'xs' }}>
          <StatusIndicator type={statusType}>
            {nodeData.status}
          </StatusIndicator>
        </Box>
      )}
    </div>
  );
});

XorGateNode.displayName = 'XorGateNode';
