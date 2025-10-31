/**
 * Flow Geometry Utilities
 * 
 * Handles all geometric calculations for the flow system including
 * point transformations, path generation, and coordinate math.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Manages coordinate transformations relative to a container
 */
export class CoordinateSystem {
  constructor(private readonly rootElement: HTMLElement) {}

  /**
   * Finds center point of an element relative to the root container
   */
  centerOf(element: HTMLElement): Point {
    const elementRect = element.getBoundingClientRect();
    const rootRect = this.rootElement.getBoundingClientRect();
    
    return {
      x: elementRect.left - rootRect.left + elementRect.width / 2,
      y: elementRect.top - rootRect.top + elementRect.height / 2,
    };
  }

  /**
   * Gets the dimensions of the root container
   */
  getDimensions(): { width: number; height: number } {
    return {
      width: this.rootElement.clientWidth,
      height: this.rootElement.scrollHeight,
    };
  }

  /**
   * Creates a point at a specific position relative to container
   */
  createPoint(x: number, y: number): Point {
    return { x, y };
  }
}

/**
 * Generates smooth curved paths using Catmull-Rom spline interpolation
 */
export class PathGenerator {
  /**
   * Converts an array of points into a smooth Catmull-Rom curve
   * represented as an SVG path string
   * 
   * @param points - Array of control points
   * @param tension - Curve tension (0-1, default 1.0)
   * @returns SVG path data string
   */
  generateCatmullRomPath(points: Point[], tension: number = 1.0): string {
    if (points.length < 2) {
      return '';
    }

    const pathSegments: string[] = [`M ${points[0].x},${points[0].y}`];

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1 = this.calculateControlPoint(p0, p1, p2, tension, false);
      const cp2 = this.calculateControlPoint(p1, p2, p3, tension, true);

      pathSegments.push(
        `C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`
      );
    }

    return pathSegments.join(' ');
  }

  /**
   * Generates a simple cubic bezier curve between two points
   */
  generateBezierPath(
    start: Point,
    end: Point,
    startControlOffset: Point,
    endControlOffset: Point
  ): string {
    const cp1 = {
      x: start.x + startControlOffset.x,
      y: start.y + startControlOffset.y,
    };
    const cp2 = {
      x: end.x + endControlOffset.x,
      y: end.y + endControlOffset.y,
    };

    return `M ${start.x},${start.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${end.x},${end.y}`;
  }

  /**
   * Calculates control point for Catmull-Rom interpolation
   */
  private calculateControlPoint(
    p0: Point,
    p1: Point,
    p2: Point,
    tension: number,
    isSecond: boolean
  ): Point {
    const factor = tension / 6;
    const offset = {
      x: (p2.x - p0.x) * factor,
      y: (p2.y - p0.y) * factor,
    };

    if (isSecond) {
      return {
        x: p1.x - offset.x,
        y: p1.y - offset.y,
      };
    } else {
      return {
        x: p1.x + offset.x,
        y: p1.y + offset.y,
      };
    }
  }
}

/**
 * Extracts points along an SVG path for positioning elements
 */
export class PathPointExtractor {
  /**
   * Gets evenly spaced points along an SVG path
   * 
   * @param pathElement - SVG path element
   * @param count - Number of points to extract
   * @param startFraction - Starting position (0-1)
   * @param endFraction - Ending position (0-1)
   * @returns Array of points along the path
   */
  getPointsAlongPath(
    pathElement: SVGPathElement,
    count: number,
    startFraction: number = 0,
    endFraction: number = 1
  ): Point[] {
    const totalLength = pathElement.getTotalLength();
    const points: Point[] = [];
    
    const startLength = totalLength * startFraction;
    const endLength = totalLength * endFraction;
    const segmentLength = endLength - startLength;

    for (let i = 1; i <= count; i++) {
      const fraction = i / (count + 1);
      const length = startLength + segmentLength * fraction;
      const point = pathElement.getPointAtLength(length);
      
      points.push({ x: point.x, y: point.y });
    }

    return points;
  }
}

/**
 * Utility functions for geometric calculations
 */
export class GeometryUtils {
  /**
   * Calculates distance between two points
   */
  static distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculates midpoint between two points
   */
  static midpoint(p1: Point, p2: Point): Point {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

  /**
   * Offsets a point by a given amount
   */
  static offsetPoint(point: Point, dx: number, dy: number): Point {
    return {
      x: point.x + dx,
      y: point.y + dy,
    };
  }

  /**
   * Interpolates between two points
   */
  static interpolate(p1: Point, p2: Point, t: number): Point {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    };
  }
}

