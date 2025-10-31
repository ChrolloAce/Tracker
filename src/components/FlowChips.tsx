/**
 * Flow Chips Component
 * 
 * Renders creator avatar chips positioned along the flow paths.
 * Each chip displays a circular avatar with a gradient border.
 */

import { FLOW_CONFIG } from '../lib/flow-config';
import type { Point } from '../lib/flow-geometry';

interface FlowChipsProps {
  points: Point[];
}

/**
 * Creator chip avatars riding along flow rails
 */
export default function FlowChips({ points }: FlowChipsProps) {
  const { chip } = FLOW_CONFIG;
  const halfSize = chip.size / 2;
  const imageSize = chip.size - chip.imagePadding * 2;
  const borderRadius = halfSize - 1;

  // Generate placeholder avatars with different gradients
  const avatarGradients = [
    ['#3B82F6', '#1D4ED8'], // blue
    ['#8B5CF6', '#6D28D9'], // purple
    ['#EC4899', '#BE185D'], // pink
    ['#F59E0B', '#D97706'], // amber
    ['#10B981', '#059669'], // emerald
    ['#EF4444', '#DC2626'], // red
  ];

  return (
    <>
      {points.map((point, index) => {
        const gradientId = `chipGrad-${index}`;
        const [color1, color2] = avatarGradients[index % avatarGradients.length];

        return (
          <g
            key={index}
            transform={`translate(${point.x - halfSize},${point.y - halfSize})`}
          >
            {/* Gradient definition for this chip */}
            <defs>
              <linearGradient
                id={gradientId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={color1} />
                <stop offset="100%" stopColor={color2} />
              </linearGradient>
            </defs>

            {/* White background circle */}
            <circle
              cx={halfSize}
              cy={halfSize}
              r={halfSize}
              fill="#fff"
            />

            {/* Avatar content (gradient placeholder) */}
            <circle
              cx={halfSize}
              cy={halfSize}
              r={(chip.size - chip.imagePadding * 2) / 2}
              fill={`url(#${gradientId})`}
            />

            {/* Gradient border */}
            <circle
              cx={halfSize}
              cy={halfSize}
              r={borderRadius}
              fill="none"
              stroke="url(#flowG)"
              strokeWidth={chip.borderWidth}
              opacity={chip.borderOpacity}
            />
          </g>
        );
      })}
    </>
  );
}

