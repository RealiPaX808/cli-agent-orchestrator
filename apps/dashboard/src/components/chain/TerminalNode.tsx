"use client";

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { ChainNodeType, ActivityState } from '@/types/chain';

// Cloudscape color palette
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
  processing: '#0073bb',
};

// Status to Cloudscape StatusIndicator type mapping
const getStatusType = (status?: string): 'success' | 'warning' | 'error' | 'info' | 'in-progress' | 'stopped' => {
  if (!status) return 'stopped';
  switch (status) {
    case ActivityState.ACTIVE:
    case 'processing':
      return 'in-progress';
    case ActivityState.COMPLETED:
    case 'completed':
      return 'success';
    case ActivityState.ERROR:
    case 'error':
      return 'error';
    case ActivityState.WAITING:
    case 'waiting_permission':
    case 'waiting_user_answer':
      return 'warning';
    default:
      return 'stopped';
  }
};

// Provider SVG icons as components
const QCliIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2L3 7v6l7 5 7-5V7l-7-5z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="3" fill="currentColor"/>
  </svg>
);

const KiroCliIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ClaudeCodeIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 4h14v12H3z" fill="none" stroke="currentColor" strokeWidth="1.5" rx="2"/>
    <path d="M6 8l2 2-2 2M12 8l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const OpenCodeIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 10h14M10 3v14" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const GeminiCliIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 3l-4 7h8l-4-7zM3 17l4-7h8l4 7H3z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const QwenCliIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 7h14M3 10h14M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const GhCopilotIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const DefaultIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 4h14v12H3z" fill="none" stroke="currentColor" strokeWidth="1.5" rx="2"/>
    <path d="M6 8h8M6 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const getProviderIcon = (provider?: string) => {
  const iconMap: Record<string, () => React.ReactElement> = {
    q_cli: QCliIcon,
    kiro_cli: KiroCliIcon,
    claude_code: ClaudeCodeIcon,
    opencode: OpenCodeIcon,
    gemini_cli: GeminiCliIcon,
    qwen_cli: QwenCliIcon,
    gh_copilot: GhCopilotIcon,
  };
  const IconComponent = iconMap[provider || ''] || DefaultIcon;
  return <IconComponent />;
};

export const TerminalNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as {
    label: string;
    type: string;
    status?: string;
    provider?: string;
    agentProfile?: string;
  };

  const isTerminal = nodeData.type === ChainNodeType.TERMINAL;
  const statusType = getStatusType(nodeData.status);

  return (
    <div
      className="chain-terminal-node"
      style={{
        padding: '12px 16px',
        minWidth: '180px',
        maxWidth: '240px',
        background: selected ? colors.bgHover : colors.bg,
        border: `2px solid ${selected ? colors.borderActive : colors.border}`,
        borderRadius: '8px',
        boxShadow: selected ? '0 0 0 3px rgba(66, 153, 225, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
    >
      {/* Input Handle */}
      {isTerminal && (
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
      )}

      {/* Header with icon and status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '18px', height: '18px', color: colors.textSecondary }}>
          {getProviderIcon(nodeData.provider)}
        </div>
        <span
          style={{
            fontSize: '13px',
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

      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background:
              statusType === 'in-progress'
                ? '#0073bb'
                : statusType === 'success'
                  ? '#037f0c'
                  : statusType === 'error'
                    ? '#d91515'
                    : statusType === 'warning'
                      ? '#8c6700'
                      : '#5f6b7a',
            animation: statusType === 'in-progress' ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
        />
        <StatusIndicator type={statusType}>
          {nodeData.status || 'idle'}
        </StatusIndicator>
      </div>

      {/* Agent profile badge */}
      {nodeData.agentProfile && (
        <div
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '4px',
            fontSize: '11px',
            color: colors.textSecondary,
          }}
        >
          {nodeData.agentProfile}
        </div>
      )}

      {/* Output Handle */}
      {isTerminal && (
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
      )}
    </div>
  );
});

TerminalNode.displayName = 'TerminalNode';
