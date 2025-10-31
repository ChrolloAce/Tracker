/**
 * Flow Anchor Manager
 * 
 * Manages anchor point discovery and validation within the flow container.
 * Anchors are DOM elements marked with data-flow attributes that define
 * connection points for the flow system.
 */

import { FLOW_ANCHORS, type FlowAnchor } from './flow-config';
import { CoordinateSystem, type Point } from './flow-geometry';

export interface AnchorValidationResult {
  valid: boolean;
  missing: string[];
}

export interface AnchorPoints {
  heroLeft: Point;
  heroRight: Point;
  platform1: Point;
  platform2: Point;
  platform3: Point;
  platform4: Point;
  merge: Point;
  timeline: Point;
}

/**
 * Manages discovery and coordinate extraction of anchor elements
 */
export class AnchorManager {
  private readonly coordinateSystem: CoordinateSystem;

  constructor(private readonly rootElement: HTMLElement) {
    this.coordinateSystem = new CoordinateSystem(rootElement);
  }

  /**
   * Finds an anchor element by its identifier
   */
  private findAnchor(anchorId: FlowAnchor): HTMLElement | null {
    return this.rootElement.querySelector(
      `[data-flow="${anchorId}"]`
    ) as HTMLElement | null;
  }

  /**
   * Validates that all required anchors exist in the DOM
   */
  validateAnchors(): AnchorValidationResult {
    const required = Object.values(FLOW_ANCHORS);
    const missing: string[] = [];

    for (const anchorId of required) {
      if (!this.findAnchor(anchorId)) {
        missing.push(anchorId);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Extracts center points for all anchor elements
   * @throws Error if any required anchor is missing
   */
  getAnchorPoints(): AnchorPoints {
    const validation = this.validateAnchors();
    
    if (!validation.valid) {
      throw new Error(`Missing anchors: ${validation.missing.join(', ')}`);
    }

    return {
      heroLeft: this.getAnchorPoint(FLOW_ANCHORS.HERO_LEFT),
      heroRight: this.getAnchorPoint(FLOW_ANCHORS.HERO_RIGHT),
      platform1: this.getAnchorPoint(FLOW_ANCHORS.PLATFORM_1),
      platform2: this.getAnchorPoint(FLOW_ANCHORS.PLATFORM_2),
      platform3: this.getAnchorPoint(FLOW_ANCHORS.PLATFORM_3),
      platform4: this.getAnchorPoint(FLOW_ANCHORS.PLATFORM_4),
      merge: this.getAnchorPoint(FLOW_ANCHORS.MERGE),
      timeline: this.getAnchorPoint(FLOW_ANCHORS.TIMELINE),
    };
  }

  /**
   * Gets the center point of a specific anchor
   */
  private getAnchorPoint(anchorId: FlowAnchor): Point {
    const element = this.findAnchor(anchorId);
    
    if (!element) {
      throw new Error(`Anchor not found: ${anchorId}`);
    }

    return this.coordinateSystem.centerOf(element);
  }

  /**
   * Gets the dimensions of the container
   */
  getContainerDimensions(): { width: number; height: number } {
    return this.coordinateSystem.getDimensions();
  }
}

