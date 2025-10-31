# Flow System Implementation Guide

## Overview

The Flow System creates animated visual rails that flow from the hero section through creator chips and platform icons, merging into a timeline spine. The system is fully responsive, respects reduced motion preferences, and maintains coordinate stability during resize and scroll operations.

## Architecture

The implementation follows strict OOP principles with single-responsibility classes and clear separation of concerns:

### Core Components

#### 1. Configuration Layer (`src/lib/flow-config.ts`)
- `FLOW_CONFIG`: Centralized configuration for all flow parameters
- Defines gradients, rail styling, chip properties, edge effects, and animations
- `FLOW_ANCHORS`: Constants for required anchor point identifiers

#### 2. Geometry Utilities (`src/lib/flow-geometry.ts`)
- `CoordinateSystem`: Manages coordinate transformations relative to container
- `PathGenerator`: Generates smooth Catmull-Rom and Bezier curves
- `PathPointExtractor`: Extracts evenly-spaced points along SVG paths
- `GeometryUtils`: Helper functions for point calculations

#### 3. Anchor Management (`src/lib/flow-anchors.ts`)
- `AnchorManager`: Discovers and validates anchor elements in the DOM
- Validates all required anchors exist before rendering
- Extracts center points for each anchor element

#### 4. Path Calculation (`src/lib/flow-paths.ts`)
- `FlowPathCalculator`: Calculates branch and spine paths
- Implements edge-emerging effect (rails start off-screen)
- Generates smooth curves connecting all anchor points

#### 5. React Components
- `FlowSystem` (`src/components/FlowSystem.tsx`): Main orchestrator
- `FlowRenderer` (`src/components/FlowRenderer.tsx`): SVG rendering layer
- `FlowChips` (`src/components/FlowChips.tsx`): Creator avatar chips

## How It Works

### 1. Container Setup
All flow elements must be within a container with `id="flow-container"`:

```tsx
<section id="flow-container" className="relative">
  {/* All content with anchors goes here */}
  <FlowSystem />
</section>
```

### 2. Anchor Points
Anchor points are marked with `data-flow` attributes:

```tsx
<div data-flow="hero-left" className="absolute left-[8%] top-[56%] h-px w-px" />
```

**Required Anchors:**
- `hero-left`: Left exit point from hero
- `hero-right`: Right exit point from hero
- `platform-1` through `platform-4`: Four platform icons
- `merge`: Point where branches merge
- `timeline`: Start of timeline spine

### 3. Flow Path Generation

The system creates three main paths:

1. **Left Branch**: 
   - Starts off-screen (left edge - 100px)
   - Curves inward toward `hero-left`
   - Passes through `platform-1` and `platform-3`
   - Ends at `merge` point

2. **Right Branch**:
   - Starts off-screen (right edge + 100px)
   - Curves inward toward `hero-right`
   - Passes through `platform-2` and `platform-4`
   - Ends at `merge` point

3. **Spine**:
   - Continues from `merge` to `timeline`
   - Smooth bezier curve

### 4. Creator Chips
- Positioned along branch paths using `getPointAtLength`
- 3 chips per branch (configurable)
- Gradient-filled circles with borders
- Automatically positioned to never drift

### 5. Responsive Updates
The system recalculates geometry when:
- Container resizes (ResizeObserver)
- Window resizes
- User scrolls

Updates are throttled using `requestAnimationFrame` for smooth 60fps performance.

## Styling Features

### Gradients
Three-color gradient flows along all paths:
- Indigo (#4F46E5) → Cyan (#22D3EE) → Blue (#60A5FA)

### Visual Effects
1. **Base Rails**: Wide, semi-transparent foundation
2. **Main Rails**: Narrower gradient rails with glow filter
3. **Shimmer**: Animated dash offset for flowing effect
4. **Edge Fade**: Gradient mask fades rails at viewport edges

### Reduced Motion Support
All animations automatically stop when user has `prefers-reduced-motion` enabled:

```css
.motion-reduce:animate-none
```

## Configuration

Edit `src/lib/flow-config.ts` to customize:

```typescript
export const FLOW_CONFIG: FlowConfig = {
  gradient: {
    colors: ['#4F46E5', '#22D3EE', '#60A5FA'],
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
    startOffset: 100, // pixels beyond viewport
    verticalPosition: 0.25, // 25% down container
    curveStrength: 50, // guide point offset
  },
};
```

## Testing

### Responsive Behavior
1. Resize browser window → Rails should maintain alignment
2. Scroll page → Rails should stay anchored correctly
3. Change platform icon positions → Rails auto-adjust

### Reduced Motion
1. Enable "Reduce motion" in system preferences
2. Reload page
3. Verify shimmer animations stop (static rails remain)

### Anchor Validation
Missing anchors will display an error message in red at the top of the SVG overlay.

## File Structure

```
src/
├── lib/
│   ├── flow-config.ts       # Configuration constants
│   ├── flow-geometry.ts     # Geometry calculations
│   ├── flow-anchors.ts      # Anchor discovery/validation
│   └── flow-paths.ts        # Path generation logic
└── components/
    ├── FlowSystem.tsx       # Main orchestrator
    ├── FlowRenderer.tsx     # SVG rendering
    └── FlowChips.tsx        # Creator chip avatars
```

## Performance Optimization

1. **Single Container**: All math relative to one container prevents coordinate drift
2. **RAF Throttling**: Geometry updates throttled via `requestAnimationFrame`
3. **Lazy Updates**: Only recalculates when necessary (resize/scroll)
4. **Efficient Observers**: Single ResizeObserver for container monitoring

## Troubleshooting

### Rails Don't Appear
- Check `#flow-container` exists
- Verify all 8 required anchors present
- Check browser console for errors

### Rails Misaligned
- Ensure anchors have `position: relative` parent
- Verify container has proper positioning context

### Performance Issues
- Reduce `chip.countPerBranch` in config
- Simplify gradient (fewer stops)
- Check for other expensive re-renders in page

## Future Enhancements

Potential improvements:
1. Parallax effects during scroll
2. Interactive hover states on chips
3. Dynamic color themes
4. Particle effects along rails
5. Timeline event markers

## Browser Support

- Modern browsers with SVG 2 support
- CSS Custom Properties
- ResizeObserver API
- Reduced motion media queries

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

