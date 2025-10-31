/**
 * Flow System Configuration
 * 
 * Centralized configuration for the visual flow system that connects
 * hero elements through creator chips and platform icons to the timeline.
 */

export interface FlowGradientConfig {
  colors: string[];
  stops: number[];
}

export interface FlowRailConfig {
  baseColor: string;
  baseWidth: number;
  mainWidth: number;
  shimmerOpacity: number;
  shimmerDashArray: string;
  shimmerDuration: string;
}

export interface FlowChipConfig {
  countPerBranch: number;
  size: number;
  borderWidth: number;
  borderOpacity: number;
  imagePadding: number;
}

export interface FlowEdgeConfig {
  startOffset: number;
  verticalPosition: number;
  curveStrength: number;
}

export interface FlowAnimationConfig {
  shimmerSpeed: number;
  updateThrottle: number;
  enableReducedMotion: boolean;
}

export interface FlowConfig {
  gradient: FlowGradientConfig;
  rail: FlowRailConfig;
  chip: FlowChipConfig;
  edge: FlowEdgeConfig;
  animation: FlowAnimationConfig;
}

/**
 * Default flow system configuration
 */
export const FLOW_CONFIG: FlowConfig = {
  gradient: {
    colors: ['#4F46E5', '#22D3EE', '#60A5FA'], // indigo → cyan → blue
    stops: [0, 50, 100],
  },
  
  rail: {
    baseColor: 'rgba(79,70,229,0.18)',
    baseWidth: 6,
    mainWidth: 3.5,
    shimmerOpacity: 0.5,
    shimmerDashArray: '1 14',
    shimmerDuration: '2.4s',
  },
  
  chip: {
    countPerBranch: 3,
    size: 22,
    borderWidth: 1.5,
    borderOpacity: 0.8,
    imagePadding: 3,
  },
  
  edge: {
    startOffset: 100, // pixels beyond viewport edge
    verticalPosition: 0.25, // 25% down the container
    curveStrength: 50, // guide point offset
  },
  
  animation: {
    shimmerSpeed: 2.4, // seconds
    updateThrottle: 16, // ms (60fps)
    enableReducedMotion: true,
  },
};

/**
 * Required anchor point identifiers
 */
export const FLOW_ANCHORS = {
  HERO_LEFT: 'hero-left',
  HERO_RIGHT: 'hero-right',
  PLATFORM_1: 'platform-1',
  PLATFORM_2: 'platform-2',
  PLATFORM_3: 'platform-3',
  PLATFORM_4: 'platform-4',
  MERGE: 'merge',
  TIMELINE: 'timeline',
} as const;

export type FlowAnchor = typeof FLOW_ANCHORS[keyof typeof FLOW_ANCHORS];

