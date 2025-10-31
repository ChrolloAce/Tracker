/**
 * Flow Path Calculator
 * 
 * Calculates the branch and spine paths that connect anchor points
 * through smooth curves. Handles edge-emerging effects and path merging.
 */

import { FLOW_CONFIG } from './flow-config';
import { GeometryUtils, PathGenerator, type Point } from './flow-geometry';
import type { AnchorPoints } from './flow-anchors';

export interface FlowPaths {
  leftBranch: string;
  rightBranch: string;
  spine: string;
  leftBranchPoints: Point[];
  rightBranchPoints: Point[];
}

/**
 * Calculates smooth curved paths for the flow system
 */
export class FlowPathCalculator {
  private readonly pathGenerator: PathGenerator;

  constructor() {
    this.pathGenerator = new PathGenerator();
  }

  /**
   * Calculates all flow paths including branches and spine
   */
  calculatePaths(
    anchors: AnchorPoints,
    containerWidth: number,
    containerHeight: number
  ): FlowPaths {
    const { edge } = FLOW_CONFIG;

    // Edge start points (off-screen)
    const leftEdgeStart: Point = {
      x: -edge.startOffset,
      y: containerHeight * edge.verticalPosition,
    };

    const rightEdgeStart: Point = {
      x: containerWidth + edge.startOffset,
      y: containerHeight * edge.verticalPosition,
    };

    // Guide points that pull rails inward toward hero
    const leftGuide = GeometryUtils.offsetPoint(
      anchors.heroLeft,
      -edge.curveStrength,
      -20
    );

    const rightGuide = GeometryUtils.offsetPoint(
      anchors.heroRight,
      edge.curveStrength,
      -20
    );

    // Left branch: edge → hero → platforms → merge
    const leftBranchPoints = [
      leftEdgeStart,
      leftGuide,
      anchors.heroLeft,
      anchors.platform1,
      anchors.platform3,
      anchors.merge,
    ];

    // Right branch: edge → hero → platforms → merge
    const rightBranchPoints = [
      rightEdgeStart,
      rightGuide,
      anchors.heroRight,
      anchors.platform2,
      anchors.platform4,
      anchors.merge,
    ];

    // Generate smooth curves
    const leftBranch = this.pathGenerator.generateCatmullRomPath(
      leftBranchPoints,
      1.1
    );

    const rightBranch = this.pathGenerator.generateCatmullRomPath(
      rightBranchPoints,
      1.1
    );

    // Spine: merge point → timeline (single smooth curve)
    const spine = this.pathGenerator.generateBezierPath(
      anchors.merge,
      anchors.timeline,
      { x: 0, y: 60 },
      { x: 0, y: -60 }
    );

    return {
      leftBranch,
      rightBranch,
      spine,
      leftBranchPoints,
      rightBranchPoints,
    };
  }

  /**
   * Calculates edge fade gradient stops for smooth appearance
   */
  calculateFadeGradient(): { offset: string; opacity: number }[] {
    return [
      { offset: '0%', opacity: 0 },
      { offset: '5%', opacity: 1 },
      { offset: '95%', opacity: 1 },
      { offset: '100%', opacity: 0 },
    ];
  }
}

