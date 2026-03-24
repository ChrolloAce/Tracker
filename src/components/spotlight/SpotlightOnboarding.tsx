import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';

// Lazy load Lottie component and animation data
const LottieComponent = lazy(() => import('lottie-react'));

export interface SpotlightStep {
  target: string; // CSS selector, or 'center' for centered modal
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  padding?: number;
  ctaLabel?: string;
  expandSection?: string; // CSS selector of a section header to click/expand before highlighting
  onEnter?: () => void; // called when this step becomes active (e.g. to navigate to a tab)
  delay?: number; // ms to wait after onEnter before positioning (for page transitions)
}

interface SpotlightOnboardingProps {
  steps: SpotlightStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const SpotlightOnboarding: React.FC<SpotlightOnboardingProps> = ({
  steps,
  isActive,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<{ top: number; left: number; width: number; height: number; right: number; bottom: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isAnimating, setIsAnimating] = useState(true);
  const scrollLockRef = useRef(false);

  // Lazy load animation data
  const [robotAnimation, setRobotAnimation] = useState<any>(null);
  useEffect(() => {
    import('./robot.json').then(module => setRobotAnimation(module.default));
  }, []);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = step?.target === 'center';

  // Refs to always have latest handlers in event listeners
  const handleNextRef = useRef<() => void>(() => {});
  const onSkipRef = useRef<() => void>(() => {});

  // Lock scrolling and navigation when spotlight is active
  useEffect(() => {
    if (!isActive) {
      scrollLockRef.current = false;
      return;
    }

    scrollLockRef.current = true;
    document.body.style.overflow = 'hidden';

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkipRef.current();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNextRef.current();
        return;
      }
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-spotlight-ui]')) return;
      e.stopPropagation();
    };

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isActive]);

  const updatePosition = useCallback(() => {
    if (!step) return;

    if (step.target === 'center') {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) return;

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Clamp to visible viewport
    const rect = {
      top: Math.max(r.top, 0),
      left: Math.max(r.left, 0),
      right: Math.min(r.right, vw),
      bottom: Math.min(r.bottom, vh),
      width: Math.min(r.right, vw) - Math.max(r.left, 0),
      height: Math.min(r.bottom, vh) - Math.max(r.top, 0),
    };
    setTargetRect(rect);

    const padding = step.padding ?? 8;
    const tooltipWidth = Math.min(360, vw - 32);
    const gap = vw < 640 ? 8 : 16;

    const tooltipEl = document.querySelector('[data-spotlight-tooltip]') as HTMLElement;
    const tooltipHeight = tooltipEl?.offsetHeight || 180;

    // Auto-pick position that fits
    const preferred = step.position || 'bottom';
    const fits: Record<string, boolean> = {
      bottom: rect.bottom + padding + gap + tooltipHeight < vh - 16,
      top: rect.top - padding - gap - tooltipHeight > 16,
      right: rect.right + padding + gap + tooltipWidth < vw - 16,
      left: rect.left - padding - gap - tooltipWidth > 16,
    };
    const opposite: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    const pos = fits[preferred] ? preferred : fits[opposite[preferred]] ? opposite[preferred] : fits.bottom ? 'bottom' : fits.right ? 'right' : 'bottom';

    let top = 0;
    let left = 0;

    switch (pos) {
      case 'bottom':
        top = rect.bottom + padding + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - padding - gap - tooltipHeight;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding + gap;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - padding - gap - tooltipWidth;
        break;
    }

    // Clamp tooltip to viewport
    left = Math.max(16, Math.min(left, vw - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, vh - tooltipHeight - 16));

    setTooltipPos({ top, left });
  }, [step]);

  // Run onEnter, expand sections, then position
  useEffect(() => {
    if (!isActive || !step) return;

    // Call onEnter if defined (e.g. navigate to a tab)
    if (step.onEnter) {
      step.onEnter();
    }

    // If step needs a section expanded first, click it
    if (step.expandSection) {
      const sectionBtn = document.querySelector(step.expandSection) as HTMLElement;
      if (sectionBtn) {
        const parentDiv = sectionBtn.closest('[class*="space-y"]');
        const itemsContainer = parentDiv?.querySelector('.space-y-1.pl-2');
        if (!itemsContainer) {
          sectionBtn.click();
        }
      }
    }

    const delay = step.delay || 100;
    const timer = setTimeout(() => {
      updatePosition();
      setIsAnimating(false);
      // Re-measure after tooltip renders to get accurate height
      requestAnimationFrame(() => updatePosition());
    }, delay);

    window.addEventListener('resize', updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, currentStep, step, updatePosition]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setIsAnimating(true);
    setCurrentStep(prev => prev + 1);
  };

  // Keep refs up to date
  handleNextRef.current = handleNext;
  onSkipRef.current = onSkip;

  const handleBack = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isActive || !step) return null;

  const padding = step.padding ?? 8;

  return createPortal(
    <div className="fixed inset-0 z-[99998]" data-spotlight-ui>
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={12}
                ry={12}
                fill="black"
                style={{ transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.82)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
        />
      </svg>

      {/* Subtle glow ring around target */}
      {targetRect && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            left: targetRect.left - padding,
            top: targetRect.top - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 0 20px rgba(0, 123, 255, 0.15)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        data-spotlight-ui
        className={isCentered
          ? 'fixed inset-0 flex items-center justify-center pointer-events-auto px-4'
          : 'fixed pointer-events-auto px-4 sm:px-0'
        }
        style={isCentered ? {} : {
          top: tooltipPos.top,
          left: Math.max(8, tooltipPos.left),
          right: 'auto',
          maxWidth: 'calc(100vw - 16px)',
        }}
      >
        <div
          className="w-full"
          style={{
            maxWidth: isCentered ? 420 : 360,
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating ? 'translateY(10px) scale(0.98)' : 'translateY(0) scale(1)',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}
        >
          <div className="relative">
            {/* Robot peeking behind card — top left */}
            <div className="absolute -top-6 -left-5 w-14 h-14 pointer-events-none hidden sm:block" style={{ zIndex: 0 }}>
              {robotAnimation && (
                <Suspense fallback={<div className="w-full h-full" />}>
                  <LottieComponent animationData={robotAnimation} loop />
                </Suspense>
              )}
            </div>
            <div
              data-spotlight-tooltip
              className="rounded-2xl shadow-2xl"
              style={{
                position: 'relative',
                zIndex: 1,
              padding: isCentered ? 24 : 16,
              background: isCentered
                ? 'linear-gradient(135deg, #0D0D0D 0%, #141414 100%)'
                : '#111111',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Step indicator dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    height: 4,
                    width: i === currentStep ? 24 : 12,
                    background: i === currentStep
                      ? 'linear-gradient(90deg, #007BFF, #2583FF)'
                      : i < currentStep
                      ? 'rgba(0, 123, 255, 0.35)'
                      : 'rgba(255, 255, 255, 0.06)',
                  }}
                />
              ))}
              <span className="ml-auto text-[11px] text-white/25 font-medium tabular-nums">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            {/* Content */}
            <h3 className="text-white font-semibold tracking-tight mb-1.5 text-sm sm:text-[15px]">
              {step.title}
            </h3>
            {step.description && (
              <p
                className="text-white/60 leading-relaxed mb-4 sm:mb-5 text-xs sm:text-[13px] [&>strong]:text-white [&>strong]:font-medium"
                dangerouslySetInnerHTML={{ __html: step.description }}
              />
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {currentStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-[13px] text-white/35 hover:text-white/60 transition-colors rounded-lg hover:bg-white/5"
                  >
                    Back
                  </button>
                )}
              </div>
              <button
                onClick={handleNext}
                className="group text-white font-semibold rounded-lg transition-all duration-200 hover:brightness-110 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 text-xs sm:text-[13px]"
                style={{
                  background: 'linear-gradient(135deg, #007BFF 0%, #2583FF 100%)',
                  boxShadow: '0 2px 12px rgba(0, 123, 255, 0.25)',
                }}
              >
                {step.ctaLabel || (isLastStep ? 'Get Started' : 'Next')}
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SpotlightOnboarding;
