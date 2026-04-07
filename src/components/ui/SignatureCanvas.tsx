import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SignatureCanvasProps {
  onSignatureChange: (signatureData: string | null) => void;
  className?: string;
}

type SignatureMode = 'draw' | 'type';

interface Point {
  x: number;
  y: number;
  time: number;
}

const SIGNATURE_LINE_Y_RATIO = 0.72;
const MIN_LINE_WIDTH = 1.2;
const MAX_LINE_WIDTH = 4.5;
const VELOCITY_FILTER_WEIGHT = 0.7;
const CURSIVE_FONTS = '"Dancing Script", "Brush Script MT", "Segoe Script", "Comic Sans MS", cursive';

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSignatureChange, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [typedName, setTypedName] = useState('');
  const lastPointRef = useRef<Point | null>(null);
  const lastVelocityRef = useRef(0);
  const lastWidthRef = useRef((MIN_LINE_WIDTH + MAX_LINE_WIDTH) / 2);

  const drawSignatureLine = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const lineY = height * SIGNATURE_LINE_Y_RATIO;
    const lineStartX = 40;
    const lineEndX = width - 24;

    // Signature line
    ctx.beginPath();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.moveTo(lineStartX, lineY);
    ctx.lineTo(lineEndX, lineY);
    ctx.stroke();

    // "X" mark
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textBaseline = 'bottom';
    ctx.fillText('✕', 16, lineY - 4);

    // "Sign above the line" label
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Sign above the line', width / 2, lineY + 6);
    ctx.textAlign = 'start';
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw the signature line and placeholder
    drawSignatureLine(ctx, rect.width, rect.height);

    // Drawing styles
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [drawSignatureLine]);

  useEffect(() => {
    if (mode === 'draw') {
      initCanvas();
    }
  }, [mode, initCanvas]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (mode === 'draw' && !hasSignature) {
        initCanvas();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mode, hasSignature, initCanvas]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const calculateWidth = (currentPoint: Point, lastPoint: Point): number => {
    const timeDelta = Math.max(currentPoint.time - lastPoint.time, 1);
    const dx = currentPoint.x - lastPoint.x;
    const dy = currentPoint.y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const rawVelocity = distance / timeDelta;

    // Smooth the velocity
    const velocity = VELOCITY_FILTER_WEIGHT * rawVelocity + (1 - VELOCITY_FILTER_WEIGHT) * lastVelocityRef.current;
    lastVelocityRef.current = velocity;

    // Map velocity to width (inverse: faster = thinner)
    const newWidth = Math.max(MIN_LINE_WIDTH, MAX_LINE_WIDTH - velocity * 2.5);
    // Smooth the width transition
    const smoothedWidth = lastWidthRef.current + (newWidth - lastWidthRef.current) * 0.4;
    lastWidthRef.current = smoothedWidth;

    return smoothedWidth;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      e.preventDefault();
    }

    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);

    const point: Point = { x: coords.x, y: coords.y, time: Date.now() };
    lastPointRef.current = point;
    lastVelocityRef.current = 0;
    lastWidthRef.current = (MIN_LINE_WIDTH + MAX_LINE_WIDTH) / 2;

    // If this is the first stroke, clear the placeholder text
    if (!hasSignature) {
      ctx.fillStyle = '#ffffff';
      const rect = canvas.getBoundingClientRect();
      ctx.fillRect(0, 0, rect.width, rect.height);
      drawSignatureLine(ctx, rect.width, rect.height);
    }

    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = lastWidthRef.current;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    // Draw a dot for single clicks/taps
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, lastWidthRef.current / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      e.preventDefault();
    }
    if (!isDrawing) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPoint: Point = { x: coords.x, y: coords.y, time: Date.now() };
    const lastPoint = lastPointRef.current;

    if (lastPoint) {
      const width = calculateWidth(currentPoint, lastPoint);

      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);

      // Use quadratic curve for smoother lines
      const midX = (lastPoint.x + currentPoint.x) / 2;
      const midY = (lastPoint.y + currentPoint.y) / 2;
      ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
      ctx.stroke();
    }

    lastPointRef.current = currentPoint;
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL('image/png');
    onSignatureChange(signatureData);
  };

  const clearSignature = () => {
    if (mode === 'draw') {
      initCanvas();
    }
    setTypedName('');
    setHasSignature(false);
    onSignatureChange(null);
  };

  // Generate typed signature as canvas data
  const handleTypedNameChange = (value: string) => {
    setTypedName(value);

    if (!value.trim()) {
      setHasSignature(false);
      onSignatureChange(null);
      return;
    }

    setHasSignature(true);

    // Render typed name to an offscreen canvas to produce image data
    const offscreen = document.createElement('canvas');
    offscreen.width = 600;
    offscreen.height = 200;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Signature line
    const lineY = offscreen.height * SIGNATURE_LINE_Y_RATIO;
    ctx.beginPath();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.moveTo(40, lineY);
    ctx.lineTo(offscreen.width - 24, lineY);
    ctx.stroke();

    // Typed name in cursive
    ctx.font = `36px ${CURSIVE_FONTS}`;
    ctx.fillStyle = '#1a1a2e';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'center';
    ctx.fillText(value, offscreen.width / 2, lineY - 8);

    onSignatureChange(offscreen.toDataURL('image/png'));
  };

  const switchMode = (newMode: SignatureMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setHasSignature(false);
    setTypedName('');
    onSignatureChange(null);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Mode Tabs */}
      <div className="flex border-b border-gray-200 mb-0">
        <button
          type="button"
          onClick={() => switchMode('draw')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors relative ${
            mode === 'draw'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Draw
          {mode === 'draw' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
          )}
        </button>
        <button
          type="button"
          onClick={() => switchMode('type')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors relative ${
            mode === 'type'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Type
          {mode === 'type' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
          )}
        </button>
      </div>

      {/* Canvas / Input Area */}
      <div
        className={`relative rounded-b-lg border-x border-b transition-all ${
          isDrawing
            ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]'
            : 'border-gray-200 shadow-sm'
        }`}
      >
        {mode === 'draw' ? (
          <>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-48 bg-white rounded-b-lg cursor-crosshair"
              style={{ touchAction: 'none' }}
            />
            {/* Overlay placeholder — only visible when empty */}
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                {/* intentionally empty — placeholder is drawn on canvas */}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-48 bg-white rounded-b-lg flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-md relative">
              <input
                type="text"
                value={typedName}
                onChange={(e) => handleTypedNameChange(e.target.value)}
                placeholder="Type your full name"
                className="w-full text-center text-3xl bg-transparent border-none outline-none pb-2 text-gray-900"
                style={{ fontFamily: CURSIVE_FONTS }}
                maxLength={50}
              />
              <div className="w-full h-px bg-slate-300 mt-1" />
              <p className="text-xs text-slate-400 text-center mt-1.5">
                Sign above the line
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Clear Button */}
      {hasSignature && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={clearSignature}
            className="text-sm text-gray-500 hover:text-red-500 font-medium transition-colors px-3 py-1 rounded hover:bg-red-50"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default SignatureCanvas;
