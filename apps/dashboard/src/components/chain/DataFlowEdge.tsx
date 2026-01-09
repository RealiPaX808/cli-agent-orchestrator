"use client";

import { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import { FlowDirection } from '@/types/chain';

// Cloudscape color palette
const colors = {
  default: '#4a5568',
  active: '#4299e1',
  success: '#037f0c',
  error: '#d91515',
  warning: '#8c6700',
  labelBg: '#0b1d2e',
  text: '#f9f9f9',
};

export const DataFlowEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) => {
  const edgeData = data as {
    direction?: FlowDirection;
    label?: string;
    active?: boolean;
    dataFlow?: {
      bytesTransferred?: number;
      lastTransfer?: string;
      transferRate?: number;
    };
  } | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isActive = edgeData?.active ?? false;
  const direction = edgeData?.direction ?? FlowDirection.BIDIRECTIONAL;
  const label = edgeData?.label;

  // Edge color based on state
  const getStrokeColor = () => {
    if (isActive) return colors.active;
    return colors.default;
  };

  // Animated dash array for active edges
  const strokeDasharray = isActive ? '8 4' : 'none';
  const animation = isActive ? 'dashFlow 1s linear infinite' : 'none';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: getStrokeColor(),
          strokeWidth: selected ? 3 : 2,
          strokeDasharray,
          animation,
        }}
        markerEnd={markerEnd}
      />

      {/* Direction indicators */}
      {direction === FlowDirection.BIDIRECTIONAL && (
        <BaseEdge
          id={`${id}-reverse`}
          path={edgePath}
          style={{
            stroke: getStrokeColor(),
            strokeWidth: selected ? 3 : 2,
            strokeDasharray: '4 4',
            opacity: 0.5,
          }}
        />
      )}

      {/* Edge Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: colors.labelBg,
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              color: colors.text,
              border: `1px solid ${getStrokeColor()}`,
              pointerEvents: 'all',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Active flow indicator dot */}
      {isActive && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: colors.active,
              boxShadow: `0 0 8px ${colors.active}`,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
});

DataFlowEdge.displayName = 'DataFlowEdge';
