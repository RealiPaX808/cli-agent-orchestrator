"use client";

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { WorkflowExecutionStatus } from '@/types/workflow';

interface ServiceTaskData extends Record<string, unknown> {
  label?: string;
  agentProfile?: string;
  provider?: string;
  status?: WorkflowExecutionStatus;
}

const ServiceTaskNode = ({ data }: { data: ServiceTaskData }) => {
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
        return 'info';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: '2px solid #5a67d8',
        borderRadius: '8px',
        minWidth: '180px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', fontWeight: '500', pointerEvents: 'none' }}>
          SERVICE TASK
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', pointerEvents: 'none' }}>
          {data.label || 'Unnamed Task'}
        </div>
        {data.agentProfile && (
          <div style={{ fontSize: '12px', opacity: 0.9, pointerEvents: 'none' }}>
            Agent: {data.agentProfile}
          </div>
        )}
        {data.status && (
          <div style={{ marginTop: '8px', pointerEvents: 'none' }}>
            <StatusIndicator type={getStatusType(data.status)}>{data.status}</StatusIndicator>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
};

export default memo(ServiceTaskNode);
