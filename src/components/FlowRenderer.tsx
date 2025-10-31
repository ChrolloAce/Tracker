/**
 * Flow Renderer Component
 * 
 * Renders the SVG paths, gradients, and effects for the flow system.
 * Handles base rails, gradient overlays, shimmer effects, and fade masks.
 */

import { FLOW_CONFIG } from '../lib/flow-config';

interface FlowRendererProps {
  leftPath: string;
  rightPath: string;
  spinePath: string;
  error: string | null;
}

/**
 * SVG rendering component for flow paths
 */
export default function FlowRenderer({
  leftPath,
  rightPath,
  spinePath,
  error,
}: FlowRendererProps) {
  const { gradient, rail } = FLOW_CONFIG;
  const [g0, g1, g2] = gradient.colors;

  return (
    <>
      {/* Definitions: gradients, filters, masks */}
      <defs>
        {/* Main gradient for rails */}
        <linearGradient id="flowG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={g0} />
          <stop offset="50%" stopColor={g1} />
          <stop offset="100%" stopColor={g2} />
        </linearGradient>

        {/* Glow filter for depth effect */}
        <filter id="flowGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Edge fade mask for smooth appearance */}
        <mask id="fadeMask">
          <rect width="100%" height="100%" fill="url(#fadeGrad)" />
        </mask>

        <linearGradient id="fadeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="5%" stopColor="black" stopOpacity="1" />
          <stop offset="95%" stopColor="black" stopOpacity="1" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </linearGradient>

        {/* Clip path for creator chips */}
        <clipPath id="chipClip">
          <circle cx="50%" cy="50%" r="48%" />
        </clipPath>
      </defs>

      {/* Main path group with fade mask */}
      <g mask="url(#fadeMask)">
        {/* Base rails (wider, semi-transparent foundation) */}
        <path
          d={leftPath}
          fill="none"
          stroke={rail.baseColor}
          strokeWidth={rail.baseWidth}
          strokeLinecap="round"
        />
        <path
          d={rightPath}
          fill="none"
          stroke={rail.baseColor}
          strokeWidth={rail.baseWidth}
          strokeLinecap="round"
        />
        <path
          d={spinePath}
          fill="none"
          stroke={rail.baseColor}
          strokeWidth={rail.baseWidth}
          strokeLinecap="round"
        />

        {/* Gradient rails (main visual paths) */}
        <path
          d={leftPath}
          fill="none"
          stroke="url(#flowG)"
          strokeWidth={rail.mainWidth}
          strokeLinecap="round"
          filter="url(#flowGlow)"
        />
        <path
          d={rightPath}
          fill="none"
          stroke="url(#flowG)"
          strokeWidth={rail.mainWidth}
          strokeLinecap="round"
          filter="url(#flowGlow)"
        />
        <path
          d={spinePath}
          fill="none"
          stroke="url(#flowG)"
          strokeWidth={rail.mainWidth}
          strokeLinecap="round"
          filter="url(#flowGlow)"
        />

        {/* Shimmer effect (respects reduced motion) */}
        <g className="[&_*]:motion-reduce:animate-none">
          <path
            d={leftPath}
            fill="none"
            stroke="url(#flowG)"
            strokeWidth={2}
            strokeDasharray={rail.shimmerDashArray}
            strokeOpacity={rail.shimmerOpacity}
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-60"
              dur={rail.shimmerDuration}
              repeatCount="indefinite"
            />
          </path>
          <path
            d={rightPath}
            fill="none"
            stroke="url(#flowG)"
            strokeWidth={2}
            strokeDasharray={rail.shimmerDashArray}
            strokeOpacity={rail.shimmerOpacity}
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-60"
              dur={rail.shimmerDuration}
              repeatCount="indefinite"
            />
          </path>
          <path
            d={spinePath}
            fill="none"
            stroke="url(#flowG)"
            strokeWidth={2}
            strokeDasharray="1 18"
            strokeOpacity={0.45}
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-90"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      </g>

      {/* Debug error display */}
      {error && (
        <text
          x="12"
          y="24"
          fill="#ef4444"
          fontSize="12"
          fontFamily="ui-sans-serif"
        >
          {error}
        </text>
      )}
    </>
  );
}

