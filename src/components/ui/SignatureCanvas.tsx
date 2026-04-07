import React, { useRef, useState, useEffect } from 'react';

interface SignatureCanvasProps {
  onSignatureChange: (signatureData: string | null) => void;
  className?: string;
  initialName?: string;
}

const CURSIVE_FONTS = '"Dancing Script", "Brush Script MT", "Segoe Script", cursive';

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSignatureChange, className = '', initialName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(initialName || '');
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Auto-fill typed name when initialName changes
  useEffect(() => {
    if (initialName && mode === 'type') {
      setTypedName(initialName);
      renderTypedSignature(initialName);
    }
  }, [initialName]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set to actual pixel dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Signature line
    const lineY = canvas.height * 0.75;
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, lineY);
    ctx.lineTo(canvas.width - 20, lineY);
    ctx.stroke();

    // "Sign here" text
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Sign here', canvas.width / 2, lineY + 6);
    ctx.textAlign = 'start';

    // Drawing defaults
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    if (mode === 'draw') initCanvas();
  }, [mode]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (!e.touches.length) return null;
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Clear placeholder on first stroke
    if (!hasSignature) {
      const canvas = canvasRef.current!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const lineY = canvas.height * 0.75;
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, lineY);
      ctx.lineTo(canvas.width - 20, lineY);
      ctx.stroke();
    }

    setIsDrawing(true);
    lastPos.current = pos;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) onSignatureChange(canvas.toDataURL('image/png'));
  };

  const renderTypedSignature = (name: string) => {
    if (!name.trim()) { setHasSignature(false); onSignatureChange(null); return; }
    setHasSignature(true);

    const c = document.createElement('canvas');
    c.width = 500;
    c.height = 160;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    const lineY = c.height * 0.75;
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, lineY);
    ctx.lineTo(c.width - 20, lineY);
    ctx.stroke();

    ctx.font = `32px ${CURSIVE_FONTS}`;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'center';
    ctx.fillText(name, c.width / 2, lineY - 6);

    onSignatureChange(c.toDataURL('image/png'));
  };

  const clear = () => {
    if (mode === 'draw') initCanvas();
    setTypedName('');
    setHasSignature(false);
    onSignatureChange(null);
  };

  const switchMode = (m: 'draw' | 'type') => {
    if (m === mode) return;
    setMode(m);
    setHasSignature(false);
    setTypedName(m === 'type' && initialName ? initialName : '');
    onSignatureChange(null);
    if (m === 'type' && initialName) {
      setTimeout(() => renderTypedSignature(initialName), 0);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Tabs */}
      <div className="flex border border-neutral-200 rounded-t-lg overflow-hidden">
        {(['draw', 'type'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              mode === m ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {m === 'draw' ? 'Draw' : 'Type'}
          </button>
        ))}
      </div>

      {/* Canvas / Input */}
      <div className="border-x border-b border-neutral-200 rounded-b-lg overflow-hidden bg-white">
        {mode === 'draw' ? (
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-36 cursor-crosshair"
            style={{ touchAction: 'none' }}
          />
        ) : (
          <div className="h-36 flex flex-col items-center justify-center px-4">
            <input
              type="text"
              value={typedName}
              onChange={(e) => { setTypedName(e.target.value); renderTypedSignature(e.target.value); }}
              placeholder="Type your name"
              className="w-full text-center text-2xl bg-transparent border-none outline-none pb-1 text-neutral-900"
              style={{ fontFamily: CURSIVE_FONTS }}
              maxLength={50}
            />
            <div className="w-3/4 h-px bg-neutral-300 mt-1" />
          </div>
        )}
      </div>

      {hasSignature && (
        <button type="button" onClick={clear} className="mt-1.5 text-xs text-neutral-400 hover:text-red-500 transition-colors">
          Clear
        </button>
      )}
    </div>
  );
};

export default SignatureCanvas;
