/**
 * Flow System Component
 * 
 * Renders animated flow rails that connect hero elements through creator chips
 * and platform icons to a timeline. Manages real-time geometry calculations,
 * responsive updates, and reduced-motion support.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FLOW_CONFIG } from '../lib/flow-config';
import { AnchorManager } from '../lib/flow-anchors';
import { FlowPathCalculator } from '../lib/flow-paths';
import { PathPointExtractor, PathGenerator, type Point } from '../lib/flow-geometry';
import FlowRenderer from './FlowRenderer';
import FlowChips from './FlowChips';

interface FlowSystemState {
  viewBox: { width: number; height: number };
  leftPath: string;
  rightPath: string;
  spinePath: string;
  chipPoints: Point[];
  error: string | null;
}

const INITIAL_STATE: FlowSystemState = {
  viewBox: { width: 0, height: 0 },
  leftPath: '',
  rightPath: '',
  spinePath: '',
  chipPoints: [],
  error: null,
};

/**
 * Main flow system orchestrator component
 */
export default function FlowSystem() {
  const containerRef = useRef<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<FlowSystemState>(INITIAL_STATE);

  // Mount container reference
  useLayoutEffect(() => {
    const root = document.getElementById('flow-container') as HTMLElement | null;
    console.log('FlowSystem mounted, container:', root);
    containerRef.current = root;

    if (!root) {
      console.error('#flow-container not found');
      setState((prev) => ({ ...prev, error: '#flow-container not found' }));
    }
  }, []);

  // Compute geometry with requestAnimationFrame throttling
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let ticking = false;

    const computeGeometry = () => {
      if (ticking) return;
      
      ticking = true;
      requestAnimationFrame(() => {
        try {
          const anchorManager = new AnchorManager(root);
          const pathCalculator = new FlowPathCalculator();

          // Validate anchors
          const validation = anchorManager.validateAnchors();
          console.log('Anchor validation:', validation);
          if (!validation.valid) {
            console.error('Missing anchors:', validation.missing);
            setState((prev) => ({
              ...prev,
              error: `Missing anchors: ${validation.missing.join(', ')}`,
            }));
            ticking = false;
            return;
          }

          // Calculate paths
          const anchors = anchorManager.getAnchorPoints();
          const dimensions = anchorManager.getContainerDimensions();
          const paths = pathCalculator.calculatePaths(
            anchors,
            dimensions.width,
            dimensions.height
          );

          // Extract chip positions along branches
          const chipPoints = extractChipPositions(
            paths.leftBranchPoints,
            paths.rightBranchPoints,
            svgRef.current!
          );

          console.log('Flow paths calculated:', {
            viewBox: dimensions,
            leftPathLength: paths.leftBranch.length,
            rightPathLength: paths.rightBranch.length,
            spinePathLength: paths.spine.length,
            chipCount: chipPoints.length
          });

          setState({
            viewBox: dimensions,
            leftPath: paths.leftBranch,
            rightPath: paths.rightBranch,
            spinePath: paths.spine,
            chipPoints,
            error: null,
          });
        } catch (error) {
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Calculation error',
          }));
        }

        ticking = false;
      });
    };

    computeGeometry();

    // Observe container changes
    const resizeObserver = new ResizeObserver(computeGeometry);
    resizeObserver.observe(root);

    window.addEventListener('resize', computeGeometry);
    window.addEventListener('scroll', computeGeometry, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', computeGeometry);
      window.removeEventListener('scroll', computeGeometry);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-[2]"
      width={state.viewBox.width}
      height={state.viewBox.height}
      viewBox={`0 0 ${state.viewBox.width} ${state.viewBox.height}`}
      aria-hidden
      style={{ border: '2px solid red' }}
    >
      {/* Debug: visible test circle */}
      <circle cx="100" cy="100" r="50" fill="red" opacity="0.5" />
      <text x="120" y="110" fill="white" fontSize="14">FLOW SYSTEM ACTIVE</text>
      
      <FlowRenderer
        leftPath={state.leftPath}
        rightPath={state.rightPath}
        spinePath={state.spinePath}
        error={state.error}
      />
      <FlowChips points={state.chipPoints} />
    </svg>
  );
}

/**
 * Extracts chip positions along the branch paths
 */
function extractChipPositions(
  leftBranchPoints: Point[],
  rightBranchPoints: Point[],
  svg: SVGSVGElement
): Point[] {
  const extractor = new PathPointExtractor();
  const pathGen = new PathGenerator();
  const chipCount = FLOW_CONFIG.chip.countPerBranch;
  const allPoints: Point[] = [];

  // Create temporary path elements to extract positions
  const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.appendChild(tempPath);

  try {
    // Extract from left branch
    const leftPathData = pathGen.generateCatmullRomPath(leftBranchPoints, 1.1);
    tempPath.setAttribute('d', leftPathData);
    const leftPoints = extractor.getPointsAlongPath(tempPath, chipCount);
    allPoints.push(...leftPoints);

    // Extract from right branch
    const rightPathData = pathGen.generateCatmullRomPath(rightBranchPoints, 1.1);
    tempPath.setAttribute('d', rightPathData);
    const rightPoints = extractor.getPointsAlongPath(tempPath, chipCount);
    allPoints.push(...rightPoints);
  } finally {
    svg.removeChild(tempPath);
  }

  return allPoints;
}

