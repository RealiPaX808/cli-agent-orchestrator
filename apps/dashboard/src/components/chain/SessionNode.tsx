"use client";

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ChainNodeType } from '@/types/chain';

// Cloudscape color palette
const colors = {
  bg: '#1a202c',
  bgHover: '#2d3748',
  border: '#4a5568',
  borderActive: '#63b3ed',
  text: '#f7fafc',
  textSecondary: '#a0aec0',
  accent: '#4299e1',
};

export const SessionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as {
    label: string;
    type: string;
    id: string;
    metadata?: Record<string, unknown>;
  };

  const isSession = nodeData.type === ChainNodeType.SESSION;

  return (
    <div
      className="chain-session-node"
      style={{
        padding: '16px 20px',
        minWidth: '200px',
        maxWidth: '280px',
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgHover} 100%)`,
        border: `2px solid ${selected ? colors.borderActive : colors.border}`,
        borderRadius: '12px',
        boxShadow: selected
          ? '0 0 0 4px rgba(99, 179, 237, 0.15), 0 4px 12px rgba(0, 0, 0, 0.4)'
          : '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative gradient accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${colors.accent}, #63b3ed, ${colors.accent})`,
          backgroundSize: '200% 100%',
          animation: selected ? 'shimmer 2s linear infinite' : 'none',
        }}
      />

      {/* Input Handle */}
      {isSession && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            width: '12px',
            height: '12px',
            background: colors.accent,
            border: '2px solid #fff',
            top: '-6px',
          }}
        />
      )}

      {/* Session icon and name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ color: colors.accent }}
        >
          <rect
            x="2"
            y="3"
            width="16"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="6" cy="8" r="1.5" fill="currentColor" />
          <path
            d="M2 13h4l2-3 2 4 2-2 2 3h2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: '14px',
            fontWeight: '700',
            color: colors.text,
            letterSpacing: '0.3px',
          }}
        >
          {nodeData.label}
        </span>
      </div>

      {/* Session ID */}
      {nodeData.id && (
        <div
          style={{
            fontSize: '11px',
            color: colors.textSecondary,
            fontFamily: 'monospace',
            marginTop: '4px',
          }}
        >
          ID: {nodeData.id.slice(0, 8)}
        </div>
      )}

      {/* Metadata section */}
      {nodeData.metadata && Object.keys(nodeData.metadata).length > 0 && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '6px',
            fontSize: '11px',
            color: colors.textSecondary,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Terminals:</span>
            <span style={{ color: colors.text, fontWeight: '600' }}>
              {(nodeData.metadata.terminalCount as number) || 0}
            </span>
          </div>
          {nodeData.metadata.activeTerminals !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span>Active:</span>
              <span style={{ color: '#037f0c', fontWeight: '600' }}>
                {nodeData.metadata.activeTerminals as number}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Output Handle */}
      {isSession && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            width: '12px',
            height: '12px',
            background: colors.accent,
            border: '2px solid #fff',
            bottom: '-6px',
          }}
        />
      )}
    </div>
  );
});

SessionNode.displayName = 'SessionNode';
